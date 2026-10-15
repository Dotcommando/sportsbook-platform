import assert from 'node:assert/strict';
import { test } from 'node:test';

import { closeAll, startWorkerLoop, validateOperationsSettings, validateWorkerLoopSettings } from '../src/index.js';

test(
  'cleanup attempts every resource after an earlier close failure',
  async () => {
    const closed: string[] = [];

    await assert.rejects(
      closeAll([
        () => {
          closed.push('listener');
          throw new Error('Drain failed');
        },
        async () => {
          closed.push('database');
        },
        () => {
          closed.push('broker');
        },
      ]),
      AggregateError,
    );
    assert.deepEqual(closed, ['listener', 'database', 'broker']);
  },
);

test(
  'pure preflight rejects unusable operational bindings and unbounded workers',
  () => {
    assert.throws(() => validateOperationsSettings({ host: '0.0.0.0', port: 9000, key: 's'.repeat(32) }));
    assert.throws(() => validateWorkerLoopSettings({ intervalMs: 0, timeoutMs: 10000 }));
    validateOperationsSettings({ host: '127.0.0.1', port: 0, key: 's'.repeat(32) });
  },
);

test(
  'synchronous worker failures are reported and the loop remains stoppable',
  async () => {
    let failures = 0;
    const loop = startWorkerLoop(
      { intervalMs: 10, timeoutMs: 1000 },
      () => {
        throw new Error('Synchronous callback failure');
      },
      () => {
        failures++;
      },
    );

    await new Promise(resolve => setTimeout(resolve, 35));
    await loop.close();
    assert.ok(failures >= 1);
    const count = failures;

    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(failures, count);
  },
);
