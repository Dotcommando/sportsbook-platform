import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

import {
  AdmissionError,
  AdmissionGate,
  beginObservation,
  observeMessage,
  observeOperation,
  observePublication,
  traceHeaders,
} from '../src/runtime-telemetry.js';

test(
  'admission bounds active work, expires queued commands before dispatch and retains slots through completion',
  async () => {
    const gate = new AdmissionGate(1, 1, 20);
    let complete: () => void = () => { };
    const running = gate.run(
      Date.now() + 1000,
      () => new Promise<void>(resolve => {
        complete = resolve;
      }),
    );
    let dispatched = false;
    const queued = gate.run(Date.now() + 1000, async () => {
      dispatched = true;
    });
    const expired = assert.rejects(
      queued,
      (error: unknown) => error instanceof AdmissionError && error.code === 'OVERLOADED',
    );

    await assert.rejects(gate.run(Date.now() + 1000, async () => { }), AdmissionError);
    assert.deepEqual(gate.snapshot(), { active: 1, queued: 1 });
    await expired;
    assert.equal(dispatched, false);
    assert.deepEqual(gate.snapshot(), { active: 1, queued: 0 });
    complete();
    await running;
    assert.deepEqual(gate.snapshot(), { active: 0, queued: 0 });
    await assert.rejects(
      gate.run(Date.now() - 1, async () => {
        dispatched = true;
      }),
      AdmissionError,
    );
    assert.equal(dispatched, false);
  },
);

test(
  'W3C context spans request path and message boundaries; failures retain original identity and metrics',
  async () => {
    let exports = 0;
    const server = createServer(
      (request, response) => {
        exports++;
        request.resume();
        request.on(
          'end',
          () => {
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end('{}');
          },
        );
      },
    );

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    assert.ok(address && typeof address === 'object');
    const observation = beginObservation(
      'test',
      {
        traceEndpoint: `http://127.0.0.1:${address.port}/v1/traces`,
        sampleRate: 1,
        maxActive: 4,
        maxQueued: 2,
        queueWaitMs: 20,
      },
    );
    const deadline = new Date(Date.now() + 5000).toISOString();
    const ids: string[] = [];

    try {
      await observeOperation(
        'api-gateway',
        'PlaceBet',
        {},
        deadline,
        async () => {
          ids.push(traceHeaders().traceparent ?? '');

          return observeOperation(
            'betting',
            'PlaceBet',
            traceHeaders(),
            deadline,
            async () => {
              ids.push(traceHeaders().traceparent ?? '');

              return observeOperation(
                'ledger',
                'ReserveStake',
                traceHeaders(),
                deadline,
                async () => {
                  ids.push(traceHeaders().traceparent ?? '');

                  return { ok: true };
                },
              );
            },
          );
        },
      );
      await observePublication(
        'sportsbook.player.v1.registered publish',
        async () =>
          observeMessage(
            'sportsbook.player.v1.registered consume',
            traceHeaders(),
            async () => {
              ids.push(traceHeaders().traceparent ?? '');
            },
          ),
      );
      assert.equal(new Set(ids.slice(0, 3).map(value => value.split('-')[1])).size, 1);
      assert.equal(new Set(ids.slice(0, 3).map(value => value.split('-')[2])).size, 3);
      assert.ok(ids.every(value => /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/.test(value)));
      const original = new Error('original');

      await assert.rejects(
        observeOperation(
          'ledger',
          'ReserveStake',
          {},
          deadline,
          async () => {
            throw original;
          },
        ),
        error => error === original,
      );
      assert.match(
        observation.render(),
        /sportsbook_operation_outcomes_total\{service="ledger",operation="ReserveStake",code="ADAPTER_FAILURE"\} 1/,
      );
    } finally {
      await observation.close();
      await new Promise<void>(
        (resolve, reject) => server.close(error => error ? reject(error) : resolve()),
      );
    }
    assert.ok(exports > 0);
  },
);
