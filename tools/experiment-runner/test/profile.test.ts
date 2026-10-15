import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PersistenceBackend } from '@sportsbook/persistence';

import type { IExperimentProfile } from '../src/experiment.model.js';
import {
  DeviceKind,
  DimensionKind,
  ExperimentKind,
  LoadMode,
  OrmLane,
  OrmOperation,
  Scenario,
} from '../src/experiment.model.js';
import { canonicalJson, digest, resolveMatrix, validateProfile } from '../src/profile.js';

export function fixture(): IExperimentProfile {
  return {
    version: 1,
    name: 'orm-control',
    kind: ExperimentKind.ORM,
    seed: '9007199254740993',
    repetitions: 3,
    services: [],
    edges: [],
    workload: {
      scenario: Scenario.ORM,
      mode: LoadMode.CLOSED_LOOP,
      concurrency: 1,
      warmupSeconds: 0,
      durationSeconds: 1,
      maxInFlight: 4,
      devices: [{ name: 'local', kind: DeviceKind.LOCAL }],
    },
    dimensions: [],
    telemetry: { enabled: true, traceSampleRatio: 1, intervalMs: 1000 },
    orm: {
      backend: PersistenceBackend.Pg,
      lane: OrmLane.EQUIVALENT_SQL,
      operation: OrmOperation.LOOKUP,
      poolMax: 1,
      rows: 100,
      batchSize: 10,
      pageSize: 10,
      maxOperations: 10000,
    },
  };
}

test(
  'profile preserves exact seed, rejects unknown fields and freezes effective settings',
  () => {
    const input = fixture();
    const profile = validateProfile(input);

    assert.equal(profile.seed, '9007199254740993');
    input.name = 'mutated';
    assert.equal(profile.name, 'orm-control');
    assert.ok(Object.isFrozen(profile.workload));
    assert.throws(() => validateProfile({ ...fixture(), secret: 'must-not-enter-profile' }));
    assert.throws(() => validateProfile({ ...fixture(), seed: Number('9007199254740993') }));
    assert.throws(() => validateProfile({ ...fixture(), repetitions: 1 }));
  },
);

test(
  'pure ORM profile cannot accidentally launch service RPCs or claim ambiguous load settings',
  () => {
    assert.throws(() => validateProfile({ ...fixture(), services: [{}] }));
    const profile = fixture();

    profile.workload.offeredRps = 10;
    assert.throws(() => validateProfile(profile));
  },
);

test(
  'one-dimensional matrix validates every point before work and canonical provenance is stable',
  () => {
    const profile = fixture();

    profile.dimensions =
      [{ kind: DimensionKind.BACKEND, values: Object.values(PersistenceBackend) }];
    assert.deepEqual(
      resolveMatrix(validateProfile(profile)).map(p => p.orm?.backend),
      Object.values(PersistenceBackend),
    );
    profile.dimensions[0]?.values.push('UNKNOWN');
    assert.throws(() => resolveMatrix(validateProfile(profile)));
    assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
    assert.equal(canonicalJson({ seed: profile.seed }), '{"seed":"9007199254740993"}');
    assert.throws(() => canonicalJson({ money: 1n }));
  },
);
