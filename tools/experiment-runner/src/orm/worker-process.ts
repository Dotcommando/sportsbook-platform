import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { ILatencySummary, IOrmBenchMeasurements } from '../experiment.model.js';
import type { IOrmWorkerInput, IOrmWorkerResult, IQuerySample } from './orm.types.js';

export interface IDiagnosticResult {
  queries: IQuerySample[];
  roundtrips: number;
}

export function workerProcess(input: IOrmWorkerInput, onReady: () => Promise<void>): Promise<{
  value?: IOrmWorkerResult;
  diagnostic?: IDiagnosticResult;
}> {
  return new Promise(
    (resolve, reject) => {
      const worker = fork(
        fileURLToPath(new URL('./orm-worker.js', import.meta.url)),
        [],
        {
          execArgv: ['--expose-gc', '--max-old-space-size=512'],
          stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
          serialization: 'advanced',
        },
      );
      let failure: unknown;
      let response: {
        value?: IOrmWorkerResult;
        diagnostic?: IDiagnosticResult;
      } | undefined;
      let errors = '';
      let readyWork = Promise.resolve();
      const timeout = setTimeout(
        () => {
          failure = new Error('ORM worker deadline exceeded');
          worker.kill();
        },
        (input.profile.workload.warmupSeconds + input.profile.workload.durationSeconds + 30) * 1000,
      );

      worker.stderr?.on(
        'data',
        (value: Buffer) => {
          errors = (errors + value.toString()).slice(-4096);
        },
      );
      worker.on('error', error => {
        failure = error;
      });
      worker.on(
        'message',
        (message: unknown) => {
          if (message === null || typeof message !== 'object' || !('kind' in message)) {
            failure = new Error('Malformed worker message');
            worker.kill();

            return;
          }
          if (message.kind === 'ready') {
            readyWork =
              onReady().then(
                () => {
                  if (!worker.connected) {
                    throw new Error('Worker disconnected during fixture reset');
                  }
                  worker.send(
                    { kind: 'measure' },
                    error => {
                      if (error) {
                        failure = error;
                        worker.kill();
                      }
                    },
                  );
                },
              ).catch(
                (error: unknown) => {
                  failure = error;
                  worker.kill();
                },
              );
          } else if (message.kind === 'failure') {
            failure =
              new Error('ORM worker failed: ' + ('code' in message ? String(message.code) : 'unknown'));
          } else if (message.kind === 'diagnostic' && 'queries' in message && Array.isArray(message.queries)
            && message.queries.length > 0
            && message.queries.length <= 1000
            && message.queries.every(isQuerySample)
            && 'roundtrips' in message
            && typeof message.roundtrips === 'number'
            && Number.isSafeInteger(message.roundtrips)
            && message.roundtrips > 0) {
            response = { diagnostic: { queries: message.queries, roundtrips: message.roundtrips } };
          } else if (message.kind === 'result' && 'value' in message && isWorkerResult(message.value)) {
            response = { value: message.value };
          } else {
            failure = new Error('Unknown or malformed worker message');
            worker.kill();
          }
        },
      );
      worker.on(
        'close',
        code => {
          clearTimeout(timeout);
          void readyWork.then(
            () => {
              if (failure || code !== 0 || !response) {
                reject(failure ?? new Error('ORM worker exited: ' + code + ' ' + errors));
              } else {
                resolve(response);
              }
            },
          );
        },
      );
      worker.send(
        input,
        error => {
          if (error) {
            failure = error;
            worker.kill();
          }
        },
      );
    },
  );
}

function isQuerySample(value: unknown): value is IQuerySample {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const data = Object.fromEntries(Object.entries(value));

  return typeof data.sql === 'string' && data.sql.length <= 1048576 && Array.isArray(data.parameters)
    && data.parameters.length <= 10000;
}

function isLatency(value: unknown): value is ILatencySummary {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const data = Object.fromEntries(Object.entries(value));

  return data.unit === 'milliseconds' && typeof data.count === 'number'
    && Number.isSafeInteger(data.count)
    && data.count >= 0
    && ['p50', 'p95', 'p99', 'maximum'].every(
      key => typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] >= 0,
    );
}

function isMeasurements(value: unknown): value is IOrmBenchMeasurements {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const data = Object.fromEntries(Object.entries(value));

  return isLatency(data.latency) && typeof data.operations === 'string'
    && /^[1-9][0-9]*$/.test(data.operations)
    && typeof data.sqlRoundtrips === 'string'
    && /^[1-9][0-9]*$/.test(data.sqlRoundtrips)
    && [
      'throughputPerSecond',
      'cpuUserMicros',
      'cpuSystemMicros',
      'heapAllocatedBytes',
      'heapUsedBytes',
      'rssBytes',
      'connections',
      'elapsedSeconds',
    ].every(
      key => typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] >= 0,
    )
    && typeof data.heapDeltaBytes === 'number'
    && Number.isFinite(data.heapDeltaBytes);
}

function isWorkerResult(value: unknown): value is IOrmWorkerResult {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const data = Object.fromEntries(Object.entries(value));

  return typeof data.completed === 'number' && Number.isSafeInteger(data.completed)
    && data.completed > 0
    && isMeasurements(data.measurements)
    && data.measurements.operations === String(data.completed)
    && Array.isArray(data.errors)
    && data.errors.every(
      value => {
        if (value === null || typeof value !== 'object') {
          return false;
        }

        const error = Object.fromEntries(Object.entries(value));

        return typeof error.code === 'string' && error.code.length <= 128 && typeof error.count === 'number'
          && Number.isSafeInteger(error.count)
          && error.count > 0;
      },
    )
    && Array.isArray(data.queries)
    && data.queries.every(isQuerySample)
    && isLatency(data.latency)
    && data.latency.count >= data.completed;
}
