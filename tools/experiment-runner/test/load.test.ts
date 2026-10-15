import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Latencies, materialize, runLoad, stableId } from '../src/load.js';
import { validateFixture } from '../src/runner.js';
import { fixture } from './profile.test.js';

test(
  'closed load keeps bounded concurrency and preserves each terminal outcome',
  async () => {
    const scenario = fixture().workload;

    scenario.concurrency = 4;
    scenario.maxInFlight = 4;
    let active = 0;
    let maximum = 0;
    const result = await runLoad(
      scenario,
      async (sequence) => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise(resolve => setTimeout(resolve, 30));
        active--;

        switch (sequence % 4) {
          case 0: return { status: 200, body: {} };
          case 1: return { status: 409, body: {} };
          case 2: return { status: 202, body: { outcome: 'PENDING' } };
          default: return { status: 503, body: {} };
        }
      },
    );

    assert.equal(maximum, 4);
    assert.equal(active, 0);
    assert.equal(
      BigInt(result.offered),
      BigInt(result.completed) + BigInt(result.businessRejected) + BigInt(result.technicalFailed)
      + BigInt(result.unknown),
    );
    assert.equal(BigInt(result.latency.count), BigInt(result.offered));
    assert.ok(BigInt(result.unknown) > 0n);
  },
);

test(
  'latencies remain bounded and deterministic IDs never pass seed through number',
  () => {
    const latency = new Latencies();

    for (let i = 0; i < 10000; i++) {
      latency.record(i);
    }
    const summary = latency.summary();

    assert.ok(summary.p99 >= 9899 && summary.p99 <= 9999);
    assert.equal(latency.counts.length, 1402);
    assert.equal(
      stableId('9007199254740993', 1, 'request'),
      stableId('9007199254740993', 1, 'request'),
    );
    assert.notEqual(
      stableId('9007199254740993', 1, 'request'),
      stableId('9007199254740992', 1, 'request'),
    );
    assert.deepEqual(
      materialize({ request_id: '$REQUEST_ID' }, '42', 1, 'now'),
      { request_id: stableId('42', 1, 'request') },
    );
  },
);

test(
  'fixture rejects workload targeting an internal API or arbitrary origin',
  () => {
    const actor = { operatorId: 'operator', actorId: 'player', actorKind: 'PLAYER', capabilities: ['READ'] };

    assert.throws(
      () =>
        validateFixture(
          {
            version: 1,
            setup: [],
            actions: [{ method: 'GET', path: '/internal/v1/wallet', actor }],
            auditActor: actor,
          },
        ),
    );
    assert.throws(
      () =>
        validateFixture(
          {
            version: 1,
            setup: [],
            actions: [{ method: 'GET', path: 'https://outside.test', actor }],
            auditActor: actor,
          },
        ),
    );
  },
);
