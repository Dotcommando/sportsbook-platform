import { performance } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';

import { OrmOperation } from '../experiment.model.js';
import { Latencies } from '../latency.js';
import { DriverCounter } from './driver-counter.js';
import type { IOrmInvocation, IOrmOperation, IOrmWorkerInput, IOrmWorkerResult } from './orm.types.js';

async function selected(input: IOrmWorkerInput): Promise<IOrmOperation> {
  const settings = input.profile.orm;

  if (!settings) {
    throw new Error('ORM settings missing');
  }

  switch (settings.backend) {
    case 'PG': return (await import('./pg.operation.js')).createOperation(input);
    case 'TYPEORM': return (await import('./typeorm.operation.js')).createOperation(input);
    case 'PRISMA': return (await import('./prisma.operation.js')).createOperation(input);
    case 'SEQUELIZE': return (await import('./sequelize.operation.js')).createOperation(input);
    default: throw new Error('Unsupported ORM');
  }
}

function code(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'code' in error
    && typeof error.code === 'string'
    && /^[A-Z0-9_]{1,64}$/.test(error.code)) {
    return error.code;
  }

  return error instanceof Error ? error.message.slice(0, 128) : 'WORKER_FAILURE';
}

async function phase(
  input: IOrmWorkerInput,
  operation: IOrmOperation,
  seconds: number,
  maxOperations: number,
): Promise<{
  completed: number;
  latency: Latencies;
  elapsed: number;
  errors: {
    code: string;
    count: number;
  }[];
}> {
  const settings = input.profile.orm;

  if (!settings) {
    throw new Error('ORM settings missing');
  }

  const concurrency = input.profile.workload.concurrency ?? 1;
  const partitionSize = Math.floor(input.accountIds.length / concurrency);

  if (partitionSize < 1) {
    throw new Error('Dataset smaller than concurrency');
  }

  let sequence = 0;
  let completed = 0;
  const errors = new Map<string, number>();
  const latency = new Latencies();
  const started = performance.now();
  const stop = started + seconds * 1000;
  const batch = settings.operation === OrmOperation.BATCH_INSERT
    ? settings.batchSize
    : settings.operation === OrmOperation.INSERT ? 1 : 0;
  const createdAt = new Date('2026-01-01T00:00:00.000Z');

  await Promise.all(
    Array.from(
      { length: concurrency },
      async (_, slot) => {
        let local = 0;

        while (performance.now() < stop && sequence < maxOperations) {
          const index = sequence++;
          const accountId = input.accountIds[slot + (local++ % partitionSize) * concurrency];
          const cursor = input.accountIds.length === settings.pageSize
            ? '00000000-0000-0000-0000-000000000000'
            : input.accountIds[index % (input.accountIds.length - settings.pageSize)];

          if (!accountId || !cursor) {
            throw new Error('Fixture identity missing');
          }

          const insertIds = input.insertIds.slice(index * batch, (index + 1) * batch);

          if (insertIds.length !== batch) {
            throw new Error('Insertion budget exhausted');
          }

          const invocation: IOrmInvocation = {
            operatorId: input.operatorId,
            accountId,
            cursor,
            insertIds,
            pageSize: settings.pageSize,
            createdAt,
          };
          const at = performance.now();

          try {
            await operation.execute(invocation);
            completed++;
          } catch (error) {
            const failure = code(error);

            errors.set(failure, (errors.get(failure) ?? 0) + 1);
          } finally {
            latency.record(performance.now() - at);
          }
        }
      },
    ),
  );

  return {
    completed,
    latency,
    elapsed: (performance.now() - started) / 1000,
    errors: [...errors].map(([code, count]) => ({ code, count })),
  };
}

async function run(input: IOrmWorkerInput): Promise<void> {
  if (input.profile.kind !== 'ORM' || !input.profile.orm || !input.accountIds.length
    || !['127.0.0.1', 'localhost'].includes(new URL(input.connectionString).hostname)) {
    throw new Error('Explicit isolated ORM input required');
  }

  const counter = new DriverCounter(input.diagnostic);
  let operation: IOrmOperation | undefined;

  try {
    operation = await selected(input);
    await operation.prime();

    if (input.diagnostic) {
      counter.reset();
      const result = await phase(input, operation, 10, 1);

      if (result.errors.length || result.completed !== 1 || counter.calls === 0) {
        throw new Error('Diagnostic operation failed: ' + JSON.stringify(result.errors));
      }
      process.send?.({ kind: 'diagnostic', queries: counter.queries, roundtrips: counter.calls });

      return;
    }
    if (input.profile.workload.warmupSeconds) {
      const warmup =
        await phase(
          input,
          operation,
          input.profile.workload.warmupSeconds,
          input.profile.orm.maxOperations,
        );

      if (warmup.errors.length) {
        throw new Error('Warmup failed: ' + JSON.stringify(warmup.errors));
      }
    }
    process.send?.({ kind: 'ready' });
    await new Promise<void>(
      (resolve, reject) => {
        process.once(
          'message',
          (message: unknown) => {
            if (message !== null && typeof message === 'object' && 'kind' in message
              && message.kind === 'measure') {
              resolve();
            } else {
              reject(new Error('Measurement handshake failed'));
            }
          },
        );
      },
    );
    global.gc?.();
    counter.reset();
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const result = await phase(
      input,
      operation,
      input.profile.workload.durationSeconds,
      input.profile.orm.maxOperations,
    );
    const usage = process.cpuUsage(cpu);
    const final = process.memoryUsage();

    if (!result.completed || counter.calls === 0) {
      throw new Error('No measured driver work');
    }

    const output: IOrmWorkerResult = {
      measurements: {
        throughputPerSecond: result.completed / result.elapsed,
        latency: result.latency.summary(),
        operations: String(result.completed),
        cpuUserMicros: usage.user,
        cpuSystemMicros: usage.system,
        heapAllocatedBytes: getHeapStatistics().total_heap_size,
        heapUsedBytes: final.heapUsed,
        heapDeltaBytes: final.heapUsed - memory.heapUsed,
        rssBytes: final.rss,
        connections: 0,
        sqlRoundtrips: String(counter.calls),
        elapsedSeconds: result.elapsed,
      },
      errors: result.errors,
      queries: [],
      completed: result.completed,
      latency: result.latency.summary(),
    };

    process.send?.({ kind: 'result', value: output });
  } finally {
    await operation?.close();
    counter.close();
  }
}

process.once(
  'message',
  (input: IOrmWorkerInput) => {
    void run(input).catch(
      (error: unknown) => {
        process.send?.({ kind: 'failure', code: code(error) });
        process.exitCode = 1;
      },
    ).finally(
      () => {
        process.disconnect?.();
      },
    );
  },
);
