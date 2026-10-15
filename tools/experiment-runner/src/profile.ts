import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

import { PersistenceBackend } from '@sportsbook/persistence';
import { ServiceProtocol } from '@sportsbook/service-transport';
import type { SchemaObject } from 'ajv';
import { Ajv } from 'ajv';
import { parseDocument } from 'yaml';

import type { IExperimentProfile } from './experiment.model.js';
import {
  ConcurrencyStrategy,
  DeviceKind,
  DimensionKind,
  ExperimentKind,
  LoadMode,
  OrmLane,
  OrmOperation,
  Scenario,
  ServiceName,
} from './experiment.model.js';

const text = { type: 'string', minLength: 1, maxLength: 256 };

const integer = (minimum: number, maximum: number): SchemaObject => ({ type: 'integer', minimum, maximum });

const choice = (values: readonly string[]): SchemaObject => ({ type: 'string', enum: values });

const object = (properties: Record<string, SchemaObject>, required = Object.keys(properties)): SchemaObject =>
  ({ type: 'object', additionalProperties: false, properties, required });

const array = (items: SchemaObject, maxItems: number, minItems = 0): SchemaObject =>
  ({ type: 'array', items, minItems, maxItems });

const service = choice(Object.values(ServiceName));

export const profileSchema = object(
  {
    version: { const: 1 },
    name: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$' },
    kind: choice(Object.values(ExperimentKind)),
    seed: { type: 'string', pattern: '^(0|[1-9][0-9]{0,18})$' },
    repetitions: integer(3, 100),
    services: array(
      object(
        {
          service,
          replicas: integer(1, 4),
          cpu: { type: 'number', minimum: 0.1, maximum: 64 },
          memoryMb: integer(128, 65536),
          configuration: { type: 'string', pattern: '^[a-zA-Z0-9_./-]+\\.json$' },
          database: object(
            {
              backend: choice(Object.values(PersistenceBackend)),
              poolMax: integer(1, 64),
              connectionBudget: integer(1, 512),
              concurrency: choice(Object.values(ConcurrencyStrategy)),
            },
            ['backend', 'poolMax', 'connectionBudget'],
          ),
        },
        ['service', 'replicas', 'cpu', 'memoryMb', 'configuration'],
      ),
      5,
    ),
    edges: array(
      object({ from: service, to: service, protocol: choice(Object.values(ServiceProtocol)) }),
      7,
    ),
    workload: object(
      {
        scenario: choice(Object.values(Scenario)),
        mode: choice(Object.values(LoadMode)),
        offeredRps: integer(1, 1000000),
        concurrency: integer(1, 10000),
        warmupSeconds: integer(0, 3600),
        durationSeconds: integer(1, 3600),
        maxInFlight: integer(1, 10000),
        devices: array(
          object(
            {
              name: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,31}$' },
              kind: choice(Object.values(DeviceKind)),
              endpoint: text,
            },
            ['name', 'kind'],
          ),
          16,
          1,
        ),
      },
      ['scenario', 'mode', 'warmupSeconds', 'durationSeconds', 'maxInFlight', 'devices'],
    ),
    dimensions: array(
      object(
        {
          kind: choice(Object.values(DimensionKind)),
          service,
          edge: object({ from: service, to: service }),
          values: array(text, 64, 1),
        },
        ['kind', 'values'],
      ),
      1,
    ),
    fixture: { type: 'string', pattern: '^[a-zA-Z0-9_./-]+\\.json$' },
    telemetry: object(
      {
        enabled: { type: 'boolean' },
        traceSampleRatio: { type: 'number', minimum: 0, maximum: 1 },
        intervalMs: integer(100, 60000),
      },
    ),
    orm: object(
      {
        backend: choice(Object.values(PersistenceBackend)),
        lane: choice(Object.values(OrmLane)),
        operation: choice(Object.values(OrmOperation)),
        poolMax: integer(1, 64),
        rows: integer(100, 1000000),
        batchSize: integer(1, 1000),
        pageSize: integer(1, 200),
        maxOperations: integer(1, 1000000),
      },
    ),
  },
  [
    'version',
    'name',
    'kind',
    'seed',
    'repetitions',
    'services',
    'edges',
    'workload',
    'dimensions',
    'telemetry',
  ],
);

const validate = new Ajv(
  {
    strict: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
  },
).compile<IExperimentProfile>(
  profileSchema,
);

export function deepFreeze(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);

    for (const item of Object.values(value)) {
      deepFreeze(item);
    }
  }
}

export function canonicalJson(value: unknown): string {
  function normalize(item: unknown): unknown {
    if (Array.isArray(item)) {
      return item.map(normalize);
    }
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(
          ([key, entry]) => [key, normalize(entry)],
        ),
      );
    }
    if (typeof item === 'bigint' || typeof item === 'number' && !Number.isFinite(item)
      || item === undefined) {
      throw new Error('JSON-safe finite manifest values required');
    }

    return item;
  }

  return JSON.stringify(normalize(value));
}

export function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function confinedPath(root: string, relative: string, mustExist = true): string {
  if (path.isAbsolute(relative)) {
    throw new Error('Relative confined path required');
  }

  const base = realpathSync(root);
  const candidate = path.resolve(base, relative);
  const resolved = mustExist || existsSync(candidate)
    ? realpathSync(candidate)
    : path.join(realpathSync(path.dirname(candidate)), path.basename(candidate));
  const difference = path.relative(base, resolved);

  if (!difference || difference === '..' || difference.startsWith('..' + path.sep)
    || path.isAbsolute(difference)) {
    throw new Error('Path leaves approved directory');
  }

  return resolved;
}

export function validateProfile(raw: unknown): IExperimentProfile {
  if (!validate(raw)) {
    throw new Error('Invalid experiment profile: ' + JSON.stringify(validate.errors));
  }

  const profile = structuredClone(raw);

  if (BigInt(profile.seed) > 9223372036854775807n) {
    throw new Error('Seed exceeds signed int64');
  }

  const load = profile.workload;

  if (load.mode === LoadMode.OPEN_LOOP
    ? (load.offeredRps === undefined || load.concurrency !== undefined)
    : (load.concurrency === undefined || load.offeredRps !== undefined)) {
    throw new Error('Select exactly the rate or concurrency matching load mode');
  }
  if (load.concurrency !== undefined && load.concurrency > load.maxInFlight) {
    throw new Error('Concurrency exceeds in-flight budget');
  }
  if (new Set(load.devices.map(d => d.name)).size !== load.devices.length) {
    throw new Error('Duplicate load device');
  }

  for (const device of load.devices) {
    if (device.kind === DeviceKind.LOCAL && device.endpoint !== undefined
      || device.kind === DeviceKind.REMOTE && device.endpoint === undefined) {
      throw new Error('Explicit remote device endpoint required');
    }
    if (device.endpoint) {
      const url = new URL(device.endpoint);

      if (url.protocol !== 'ssh:' || url.password || url.search || url.hash) {
        throw new Error('Remote generators require an explicit credential-free SSH endpoint');
      }
    }
  }

  if (profile.kind === ExperimentKind.ORM) {
    if (profile.fixture || profile.services.length || profile.edges.length
      || profile.workload.scenario !== Scenario.ORM
      || !profile.orm) {
      throw new Error('Pure ORM profiles cannot start sportsbook services or RPC edges');
    }
    if (profile.orm.rows
      + (profile.orm.operation === OrmOperation.BATCH_INSERT
        ? profile.orm.batchSize
        : profile.orm.operation === OrmOperation.INSERT ? 1 : 0)
      * profile.orm.maxOperations
      > 1000000) {
      throw new Error('ORM row budget exceeded');
    }
    if (profile.orm.batchSize > profile.orm.rows || profile.orm.pageSize > profile.orm.rows) {
      throw new Error('Dataset is smaller than operation batch');
    }
  } else {
    if (!profile.fixture || profile.orm || profile.workload.scenario === Scenario.ORM
      || profile.services.length !== 5) {
      throw new Error('Complete five-service topology required');
    }
    if (new Set(profile.services.map(s => s.service)).size !== 5) {
      throw new Error('Duplicate or missing service');
    }

    for (const resource of profile.services) {
      const db = resource.database;

      if (resource.configuration.split('/').includes('..')) {
        throw new Error('Configuration escapes approved root');
      }
      if (resource.service === ServiceName.GATEWAY) {
        if (db) {
          throw new Error('Gateway has no database');
        }
      } else {
        if (!db) {
          throw new Error('Explicit owner database required');
        }
        if (resource.service === ServiceName.EVENTS && db.backend !== PersistenceBackend.Pg
          || [ServiceName.PLAYER, ServiceName.BETTING].includes(resource.service)
          && db.backend === PersistenceBackend.Pg) {
          throw new Error('Unsupported owner persistence provider');
        }
        if (resource.service === ServiceName.LEDGER ? !db.concurrency : db.concurrency !== undefined) {
          throw new Error('Ledger alone selects a concurrency strategy');
        }
        if (db.poolMax * resource.replicas > db.connectionBudget) {
          throw new Error('Aggregate connection budget exceeded');
        }
      }
    }
    const expected = [
      'api-gateway:ledger',
      'api-gateway:player',
      'api-gateway:betting',
      'api-gateway:event-simulator',
      'betting:ledger',
      'betting:player',
      'betting:event-simulator',
    ];
    const actual = profile.edges.map(e => e.from + ':' + e.to);

    if (actual.length !== 7 || new Set(actual).size !== 7
      || actual.some(edge => !expected.includes(edge))) {
      throw new Error('Exact supported call-edge topology required');
    }
  }
  deepFreeze(profile);

  return profile;
}

export function readProfile(root: string, profilePath: string): IExperimentProfile {
  const file = confinedPath(root, profilePath);
  const input = readFileSync(file, 'utf8');

  if (Buffer.byteLength(input) > 65536) {
    throw new Error('Profile exceeds 64 KiB');
  }

  const document = parseDocument(input, { strict: true, uniqueKeys: true, version: '1.2' });

  if (document.errors.length || document.warnings.length) {
    throw new Error('Invalid or ambiguous YAML profile');
  }

  return validateProfile(document.toJS({ maxAliasCount: 0 }));
}

export function resolveMatrix(profile: IExperimentProfile): IExperimentProfile[] {
  if (profile.dimensions.length === 0) {
    return [profile];
  }

  const dimension = profile.dimensions[0];

  if (!dimension) {
    throw new Error('Missing dimension');
  }
  if (new Set(dimension.values).size !== dimension.values.length) {
    throw new Error('Duplicate matrix point');
  }

  return dimension.values.map(
    value => {
      const next = structuredClone(profile);

      next.dimensions = [];
      const resource = next.services.find(s => s.service === dimension.service);
      const edge = next.edges.find(e => e.from === dimension.edge?.from && e.to === dimension.edge.to);

      switch (dimension.kind) {
        case DimensionKind.BACKEND: {
          const backend = Object.values(PersistenceBackend).find(v => v === value);

          if (!backend) {
            throw new Error('Unsupported matrix backend');
          }
          if (next.orm) {
            next.orm.backend = backend;
          } else if (resource?.database) {
            resource.database.backend = backend;
          } else {
            throw new Error('Backend dimension requires a database owner');
          }
          break;
        }
        case DimensionKind.CONCURRENCY: {
          const strategy = Object.values(ConcurrencyStrategy).find(v => v === value);

          if (!strategy || resource?.service !== ServiceName.LEDGER || !resource.database) {
            throw new Error('Concurrency dimension requires Ledger');
          }
          resource.database.concurrency = strategy;
          break;
        }
        case DimensionKind.POOL:
        case DimensionKind.REPLICAS: {
          if (!/^[1-9][0-9]*$/.test(value)) {
            throw new Error('Canonical integer matrix point required');
          }
          if (dimension.kind === DimensionKind.POOL) {
            if (next.orm) {
              next.orm.poolMax = Number(value);
            } else if (resource?.database) {
              resource.database.poolMax = Number(value);
            } else {
              throw new Error('Pool dimension requires a database owner');
            }
          } else {
            if (!resource) {
              throw new Error('Replica dimension requires a service');
            }
            resource.replicas = Number(value);
          }
          break;
        }
        case DimensionKind.TRANSPORT: {
          const protocol = Object.values(ServiceProtocol).find(v => v === value);

          if (!edge || !protocol) {
            throw new Error('Transport dimension requires a supported edge');
          }
          edge.protocol = protocol;
          break;
        }
        case DimensionKind.LANE: {
          const lane = Object.values(OrmLane).find(v => v === value);

          if (!next.orm || !lane) {
            throw new Error('Lane dimension requires ORM benchmark');
          }
          next.orm.lane = lane;
          break;
        }
        case DimensionKind.OPERATION: {
          const operation = Object.values(OrmOperation).find(v => v === value);

          if (!next.orm || !operation) {
            throw new Error('Operation dimension requires ORM benchmark');
          }
          next.orm.operation = operation;
          break;
        }
      }

      return validateProfile(next);
    },
  );
}
