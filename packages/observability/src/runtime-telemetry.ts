import { monitorEventLoopDelay } from 'node:perf_hooks';

import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

export interface IObservationSettings {
  traceEndpoint: string;
  sampleRate: number;
  maxActive: number;
  maxQueued: number;
  queueWaitMs: number;
}

export interface ITraceHeaders {
  traceparent?: unknown;
  tracestate?: unknown;
}

export class AdmissionError extends Error {
  constructor(readonly code: 'OVERLOADED' | 'DEADLINE_EXCEEDED') {
    super(code);
  }
}

export class AdmissionGate {
  private active = 0;
  private readonly queue: {
    enter: () => void;
    reject: (error: AdmissionError) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];

  constructor(readonly maximum: number, readonly capacity: number, readonly waitMs: number) {
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 10000 || !Number.isInteger(capacity)
      || capacity < 0
      || capacity > 10000
      || !Number.isInteger(waitMs)
      || waitMs < 1
      || waitMs > 60000) {
      throw new Error('Invalid bounded admission settings');
    }
  }

  snapshot(): {
    active: number;
    queued: number;
  } {
    return { active: this.active, queued: this.queue.length };
  }

  async run<T>(deadline: number, work: () => Promise<T>): Promise<T> {
    if (!Number.isFinite(deadline) || deadline <= Date.now()) {
      throw new AdmissionError('DEADLINE_EXCEEDED');
    }
    if (this.active < this.maximum) {
      this.active++;
    } else {
      if (this.queue.length >= this.capacity) {
        throw new AdmissionError('OVERLOADED');
      }
      await new Promise<void>(
        (resolve, reject) => {
          const delay = Math.min(this.waitMs, deadline - Date.now());
          const item = {
            enter: resolve,
            reject,
            timer: setTimeout(
              () => {
                const index = this.queue.indexOf(item);

                if (index >= 0) {
                  this.queue.splice(index, 1);
                }
                reject(new AdmissionError(Date.now() >= deadline ? 'DEADLINE_EXCEEDED' : 'OVERLOADED'));
              },
              delay,
            ),
          };

          this.queue.push(item);
        },
      );
    }

    try {
      if (Date.now() >= deadline) {
        throw new AdmissionError('DEADLINE_EXCEEDED');
      }

      return await work();
    } finally {
      const next = this.queue.shift();

      if (next) {
        clearTimeout(next.timer);
        next.enter();
      } else {
        this.active--;
      }
    }
  }
}

const buckets = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];

const operations = new Map<string, {
  count: number;
  sum: number;
  histogram: number[];
  failures: Map<string, number>;
}>();

const httpCounts = new Map<string, number>();

export function recordHttpRequest(method: string, status: number): void {
  const labels =
    `method="${[
      'GET',
      'POST',
      'PATCH',
      'PUT',
      'DELETE',
    ].includes(
      method,
    )
      ? method
      : 'OTHER'}",status="${Math.floor(
      status
        / 100,
    )}xx"`;

  httpCounts.set(labels, (httpCounts.get(labels) ?? 0) + 1);
}

const workerReports = new Map<string, {
  selected: number;
  applied: number;
  replayed: number;
  rejected: number;
  pending: number;
  failed: number;
}>();

export function recordWorkerBatch(
  worker: string,
  report: {
    selected: number;
    applied: number;
    replayed: number;
    rejected: number;
    pending: number;
    failed: number;
  },
): void {
  if (!/^[a-z-]{1,64}$/.test(worker)
    || Object.values(report).some(value => !Number.isInteger(value) || value < 0)) {
    throw new Error('Invalid worker observation');
  }
  workerReports.set(worker, { ...report });
}

let gate = new AdmissionGate(128, 128, 1000);

export function traceHeaders(): Record<string, string> {
  const carrier: Record<string, string> = {};

  propagation.inject(context.active(), carrier);

  return carrier;
}

export async function traceWork<T>(
  name: string,
  headers: ITraceHeaders,
  kind: SpanKind,
  work: () => Promise<T>,
): Promise<T> {
  const carrier: Record<string, string> = {};

  for (const key of ['traceparent', 'tracestate'] as const) {
    const value = headers[key];

    if (typeof value === 'string' && value.length <= 512) {
      carrier[key] = value;
    }
  }
  const parent = propagation.extract(context.active(), carrier);

  return context.with(
    parent,
    () =>
      trace.getTracer('sportsbook.boundaries').startActiveSpan(
        name,
        { kind },
        async (span) => {
          try {
            const result = await work();

            if (result !== null && typeof result === 'object' && 'ok' in result && result.ok === false) {
              span.setStatus({ code: SpanStatusCode.ERROR });
            }

            return result;
          } catch (error) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
          } finally {
            span.end();
          }
        },
      ),
  );
}

export function observeMessage<T>(name: string, headers: ITraceHeaders, work: () => Promise<T>): Promise<T> {
  return traceWork(name, headers, SpanKind.CONSUMER, work);
}

export function observePublication<T>(name: string, work: () => Promise<T>): Promise<T> {
  return traceWork(name, {}, SpanKind.PRODUCER, work);
}

export async function observeOperation<T>(
  service: string,
  operation: string,
  headers: ITraceHeaders,
  deadline: string,
  work: () => Promise<T>,
): Promise<T> {
  const key = /^[a-z-]{1,32}$/.test(service) && /^[A-Za-z]{1,64}$/.test(operation)
    ? `service="${service}",operation="${operation}"`
    : 'service="unknown",operation="unknown"';
  let metric = operations.get(key);

  if (!metric) {
    if (operations.size >= 256) {
      throw new AdmissionError('OVERLOADED');
    }
    metric = { count: 0, sum: 0, histogram: buckets.map(() => 0), failures: new Map() };
    operations.set(key, metric);
  }

  const start = performance.now();
  let category = 'OK';

  try {
    return await traceWork(
      service + '.' + operation,
      headers,
      SpanKind.SERVER,
      async () =>
        gate.run(
          Date.parse(deadline),
          async () => {
            const result = await work();

            if (result !== null && typeof result === 'object' && 'ok' in result && result.ok === false
              && 'error' in result
              && result.error !== null
              && typeof result.error === 'object'
              && 'code' in result.error
              && typeof result.error.code === 'string') {
              category = result.error.code;
            }

            return result;
          },
        ),
    );
  } catch (error) {
    category = error instanceof AdmissionError ? error.code : 'ADAPTER_FAILURE';
    throw error;
  } finally {
    const elapsed = (performance.now() - start) / 1000;

    metric.count++;
    metric.sum += elapsed;
    buckets.forEach(
      (bound, index) => {
        if (elapsed <= bound) {
          metric.histogram[index] = (metric.histogram[index] ?? 0) + 1;
        }
      },
    );
    metric.failures.set(category, (metric.failures.get(category) ?? 0) + 1);
  }
}

export function beginObservation(service: string, settings?: IObservationSettings): {
  render(): string;
  close(): Promise<void>;
} {
  let provider: NodeTracerProvider | undefined;

  if (settings) {
    const endpoint = new URL(settings.traceEndpoint);

    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password
      || !Number.isFinite(settings.sampleRate)
      || settings.sampleRate < 0
      || settings.sampleRate > 1) {
      throw new Error('Invalid trace export settings');
    }
    gate = new AdmissionGate(settings.maxActive, settings.maxQueued, settings.queueWaitMs);
    provider =
      new NodeTracerProvider(
        {
          resource: resourceFromAttributes({ 'service.name': service }),
          sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(settings.sampleRate) }),
          spanProcessors: [
            new BatchSpanProcessor(
              new OTLPTraceExporter({ url: settings.traceEndpoint, timeoutMillis: 2000 }),
              {
                maxQueueSize: 2048,
                maxExportBatchSize: 256,
                scheduledDelayMillis: 1000,
                exportTimeoutMillis: 3000,
              },
            ),
          ],
        },
      );
    provider.register({ propagator: new W3CTraceContextPropagator() });
  }

  const lag = monitorEventLoopDelay({ resolution: 20 });

  lag.enable();

  return {
    render: () => {
      const cpu = process.cpuUsage();
      const memory = process.memoryUsage();
      const admission = gate.snapshot();
      const lines = [
        `sportsbook_process_cpu_seconds_total ${(cpu.user + cpu.system) / 1000000}`,
        `sportsbook_process_rss_bytes ${memory.rss}`,
        `sportsbook_process_heap_used_bytes ${memory.heapUsed}`,
        `sportsbook_process_event_loop_lag_seconds ${Number.isFinite(lag.mean) ? lag.mean / 1e9 : 0}`,
        `sportsbook_requests_active ${admission.active}`,
        `sportsbook_requests_queued ${admission.queued}`,
      ];

      lag.reset();

      for (const [labels, metric] of operations) {
        lines.push(
          `sportsbook_operations_total{${labels}} ${metric.count}`,
          `sportsbook_operation_duration_seconds_count{${labels}} ${metric.count}`,
          `sportsbook_operation_duration_seconds_sum{${labels}} ${metric.sum}`,
        );
        buckets.forEach(
          (bound, index) =>
            lines.push(
              `sportsbook_operation_duration_seconds_bucket{${labels},le="${bound}"} ${metric.histogram[index]}`,
            ),
        );
        lines.push(`sportsbook_operation_duration_seconds_bucket{${labels},le="+Inf"} ${metric.count}`);

        for (const [category, count] of metric.failures) {
          lines.push(
            `sportsbook_operation_outcomes_total{${labels},code="${/^[A-Z_]{1,64}$/.test(category) ? category : 'OTHER'}"} ${count}`,
          );
        }
      }

      for (const [labels, value] of httpCounts) {
        lines.push(`sportsbook_http_requests_total{${labels}} ${value}`);
      }

      for (const [worker, report] of workerReports) {
        for (const [result, value] of Object.entries(report)) {
          lines.push(`sportsbook_worker_last_batch{worker="${worker}",result="${result}"} ${value}`);
        }
      }

      return lines.join('\n') + '\n';
    },
    close: async () => {
      lag.disable();
      await provider?.shutdown();
    },
  };
}
