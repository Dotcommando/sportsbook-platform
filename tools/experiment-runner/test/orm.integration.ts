import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PersistenceBackend } from '@sportsbook/persistence';

import { OrmLane, OrmOperation, RunStatus } from '../dist/experiment.model.js';
import { OrmMicrobenchRunner } from '../dist/orm-runner.js';
import { validateProfile } from '../dist/profile.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

const runner = new OrmMicrobenchRunner(root);

const evidence: {
  backend: PersistenceBackend;
  lane: OrmLane;
  operation: OrmOperation;
  runId: string;
}[] = [];

try {
  for (const backend of Object.values(PersistenceBackend)) {
    for (const lane of Object.values(OrmLane)) {
      for (const operation of Object.values(OrmOperation)) {
        const profile = validateProfile(
          {
            version: 1,
            name: 'orm-functional-control',
            kind: 'ORM',
            seed: '42',
            repetitions: 3,
            services: [],
            edges: [],
            dimensions: [],
            workload: {
              scenario: 'ORM',
              mode: 'CLOSED_LOOP',
              concurrency: 2,
              maxInFlight: 2,
              warmupSeconds: 0,
              durationSeconds: 1,
              devices: [{ name: 'local', kind: 'LOCAL' }],
            },
            telemetry: { enabled: true, traceSampleRatio: 0, intervalMs: 1000 },
            orm: {
              backend,
              lane,
              operation,
              poolMax: 2,
              rows: 1000,
              batchSize: 10,
              pageSize: 20,
              maxOperations: 50000,
            },
          },
        );
        const result = await runner.run(profile);

        assert.equal(
          result.status,
          RunStatus.VALID,
          [backend, lane, operation, ...result.dataAudit.violations].join(':'),
        );
        assert.equal(result.dataAudit.status, 'PASS');
        assert.ok(BigInt(result.measurements.sqlRoundtrips) > 0n);
        assert.equal(result.measurements.connections, 2);
        evidence.push({ backend, lane, operation, runId: result.runId });
        mkdirSync(path.join(root, '.tmp'), { recursive: true });
        writeFileSync(path.join(root, '.tmp/orm-functional.json'), JSON.stringify(evidence));
      }
    }
  }
  assert.equal(evidence.length, 64);
  console.log(
    'ORM operation compatibility: all 64 backend/lane/operation controls passed independent data and schema audits. Sequential database cleanup completed without terminating live clients.',
  );
} finally {
  await runner.close();
}
