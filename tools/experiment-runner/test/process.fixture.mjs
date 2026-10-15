import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const stringify = JSON.stringify;

import * as G from '../../../apps/api-gateway/dist/domain/gateway.model.js';
import * as B from '../../../apps/betting/dist/domain/betting.model.js';
import * as E from '../../../apps/event-simulator/dist/domain/events.model.js';
import { UuidGenerator } from '../../../apps/ledger/dist/adapters/outbound/ids/uuid-generator.js';
import * as L from '../../../apps/ledger/dist/domain/ledger.model.js';
import * as P from '../../../apps/player/dist/domain/player.model.js';
import { stableId } from '../dist/load.js';

process.chdir(fileURLToPath(new URL('../../../', import.meta.url)));

const folder = '.tmp/process-control';

mkdirSync(folder, { recursive: true });

const json = (name, value) => writeFileSync(
  folder + '/' + name + '.json',
  JSON.stringify(
    value,
    (key, value) => {
      if (key === 'trustedActors') {
        return value.map(actor => Object.fromEntries(Object.entries(actor).filter(([key]) => key !== 'operatorId')));
      }

      return typeof value === 'bigint' ? String(value) : value;
    },
    2,
  ),
);

const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const ids = new UuidGenerator(namespace);

const id = (name) => stableId('42', 0, name);

const operatorId = id('operator');

const system = id('system');

const gateway = id('gateway');

const betting = id('betting');

const recorder = id('recorder');

const events = id('events');

const registration = id('registration');

const playerId = ids.derive(operatorId, registration, 'player:player');

const walletId = ids.derive(
  operatorId,
  ids.derive(operatorId, ids.derive(operatorId, registration, 'player:event'), 'ledger:provision-wallet:USD'),
  'ledger:wallet',
);

const now = new Date().toISOString();

const identity = {
  issuer: 'synthetic-private',
  audience: 'synthetic-private',
  key: '$RUN_IDENTITY_KEY',
  maximumDeadlineMs: 60000,
};

const graph = {
  maximumBytes: 65536,
  maximumResponseBytes: 1048576,
  maximumDepth: 8,
  maximumRootFields: 20,
  maximumSelectedFields: 1000,
  introspection: false,
};

const broker = (owner) => ({
  servers: ['nats://nats:4222'],
  credentials: { kind: 'USER', user: owner, password: '$RUN_BROKER_PASSWORD' },
  timeoutMs: 5000,
});

const ops = { host: '$RUN_BIND', port: 9100, key: '$RUN_SCRAPE_KEY' };

const actor = (caps) => ({ operatorId, actorId: system, actorKind: 'SYSTEM', capabilities: caps });

const worker = (caps) => ({ intervalMs: 100, timeoutMs: 10000, limit: 100, actors: [actor(caps)] });

const host = (owner) => ({
  host: '$RUN_BIND',
  httpPort: 8080,
  grpcPort: 9090,
  protoPath: '/workspace/packages/contracts/proto/sportsbook/' + owner + '/v1/' + owner + '.proto',
  protobufPackage: 'sportsbook.' + owner + '.v1',
});

const persistence = {
  backend: 'TYPEORM',
  connectionString: '$RUN_DATABASE_URL',
  poolMax: 4,
  replicaCount: 1,
  connectionBudget: 8,
  acquisitionTimeoutMs: 5000,
  transactionTimeoutMs: 10000,
  statementTimeoutMs: 5000,
  lockTimeoutMs: 1000,
  retryAttempts: 10,
  outboxLeaseMs: 1000,
};

const client = (caps, actorId = gateway) => ({
  issuer: identity.issuer,
  audience: identity.audience,
  key: identity.key,
  actorId,
  operators: [operatorId],
  capabilities: caps,
  timeoutMs: 5000,
  endpoint: 'unused:9090',
  protocol: 'GRPC',
  tls: false,
});

json(
  'ledger',
  {
    service: 'ledger',
    namespace,
    persistence: {
      backend: 'PG',
      connectionString: '$RUN_DATABASE_URL',
      poolMax: 4,
      replicaCount: 1,
      aggregateConnectionBudget: 8,
      acquisitionTimeoutMs: 5000,
      transactionTimeoutMs: 10000,
      strategy: 'rc_conditional',
      retry: {
        serializationAttempts: 5,
        deadlockAttempts: 5,
        versionAttempts: 10,
        retryBaseMs: 1,
        retryMaxMs: 16,
        statementTimeoutMs: 5000,
        lockTimeoutMs: 1000,
      },
      outboxLeaseMs: 1000,
    },
    policies: [
      {
        operatorId,
        currencies: [{ currency: 'USD', minimumMinor: 1n, maximumMinor: 9223372036854775807n }],
        providerNames: ['synthetic'],
        rejectionReasons: ['PAYMENT_REJECTED'],
        trustedActors: [
          { ...actor(Object.values(L.Capability)), providerName: 'synthetic' },
          {
            actorId: gateway,
            actorKind: 'SERVICE',
            capabilities: [
              L.Capability.READ_WALLET,
              L.Capability.READ_JOURNAL,
              L.Capability.FUND_SYNTHETIC,
              L.Capability.WITHDRAW,
            ],
            providerName: 'synthetic',
          },
          {
            actorId: betting,
            actorKind: 'SERVICE',
            capabilities: [
              L.Capability.READ_WALLET,
              L.Capability.RESERVE_STAKE,
              L.Capability.CANCEL_RESERVATION,
              L.Capability.SETTLE_BET,
            ],
          },
          { actorId: recorder, actorKind: 'SERVICE', capabilities: [L.Capability.CREATE_WALLET] },
        ],
      },
    ],
    outboxRetryMs: 10,
    identity,
    host: host('ledger'),
    graphql: graph,
    broker: broker('ledger'),
    consumer: {
      ...broker('ledger'),
      stream: 'SPORTSBOOK_PLAYER',
      durable: 'LEDGER_PLAYERS',
      subject: 'sportsbook.player.v1.registered',
      pullExpiresMs: 1000,
      retryDelayMs: 100,
    },
    registrationRoutes: [{ operatorId, actorId: system, currencies: ['USD'] }],
    worker: worker(Object.values(L.Capability)),
    syntheticPayments: {
      seed: '42',
      rejectionsPerMillion: 0,
      rejectionReason: 'PAYMENT_REJECTED',
      providers: [{ operatorId, actorId: system, name: 'synthetic' }],
    },
    operations: ops,
  },
);

json(
  'player',
  {
    service: 'player',
    application: {
      namespace,
      persistence,
      protection: {
        activeKeyId: 'synthetic',
        encryptionKeys: { synthetic: '1'.repeat(64) },
        contactHmacKey: '2'.repeat(64),
      },
      operators: [
        {
          operatorId,
          businessTimeZone: 'UTC',
          countries: ['US'],
          reasonCodes: ['ACTIVATE', 'APPROVED', 'KYC_PASSED'],
          casePolicyCapabilities: [{ level: P.KycLevel.BASIC, capability: P.PlayerCapability.PLACE_BET }],
          policies: Object.values(P.PlayerCapability).map(capability => ({
            capability,
            allowedStatuses: [P.PlayerStatus.ACTIVE],
            policyVersion: 'SYNTHETIC_V1',
            requiredLevel: P.KycLevel.BASIC,
            requiredChecks: Object.values(P.KycCheckType),
            minimumAge: 18,
            maxValidityDays: 30,
            blockingRestrictions: [],
          })),
          trustedActors: [
            actor(Object.values(P.Capability)),
            {
              actorId: gateway,
              actorKind: 'SERVICE',
              capabilities: [
                P.Capability.REGISTER_PLAYER,
                P.Capability.PROFILE_READ,
                P.Capability.PROFILE_WRITE,
                P.Capability.EVALUATE_ELIGIBILITY,
              ],
            },
            {
              actorId: betting,
              actorKind: 'SERVICE',
              capabilities: [P.Capability.EVALUATE_ELIGIBILITY],
            },
            { actorId: recorder, actorKind: 'SERVICE', capabilities: [P.Capability.SYNTHETIC_KYC] },
          ],
        },
      ],
      proofs: [],
      checks: [],
      recordActors: [{ operatorId, actorId: recorder }],
      outboxRetryMs: 10,
    },
    identity,
    host: host('player'),
    graphql: graph,
    broker: broker('player'),
    worker: worker(Object.values(P.Capability)),
    operations: ops,
  },
);

json(
  'betting',
  {
    service: 'betting',
    application: {
      namespace,
      persistence,
      operators: [
        {
          operatorId,
          currencies: ['USD'],
          marketPeriod: 'NORMAL_TIME',
          trustedActors: [
            actor(Object.values(B.Capability)),
            {
              actorId: gateway,
              actorKind: 'SERVICE',
              capabilities: [B.Capability.PLACE_BET, B.Capability.CANCEL_BET, B.Capability.BET_READ],
            },
            { actorId: events, actorKind: 'SERVICE', capabilities: [B.Capability.SETTLE_BET] },
          ],
        },
      ],
      outboxRetryMs: 10,
    },
    identity,
    host: host('betting'),
    graphql: graph,
    broker: broker('betting'),
    clients: {
      player: client([P.Capability.EVALUATE_ELIGIBILITY], betting),
      events: client([E.Capability.QUOTE_VALIDATE, E.Capability.EVENT_READ], betting),
      ledger: client(
        [
          L.Capability.READ_WALLET,
          L.Capability.RESERVE_STAKE,
          L.Capability.CANCEL_RESERVATION,
          L.Capability.SETTLE_BET,
        ],
        betting,
      ),
    },
    consumer: {
      ...broker('betting'),
      stream: 'SPORTSBOOK_EVENTS',
      durable: 'BETTING_RESULTS',
      subject: 'sportsbook.events.v1.event_result',
      pullExpiresMs: 1000,
      retryDelayMs: 100,
    },
    resultRoutes: [{ operatorId, actorId: events }],
    worker: worker(Object.values(B.Capability)),
    operations: ops,
  },
);

json(
  'event-simulator',
  {
    service: 'event-simulator',
    application: {
      namespace,
      persistence: { ...persistence, backend: 'PG' },
      fixtures: [
        {
          operatorId,
          runId: id('events-run'),
          seed: 42n,
          startsAt: now,
          eventCount: 1,
          quoteValidityMs: 3600000,
          period: E.MarketPeriod.NORMAL_TIME,
        },
      ],
      operators: [
        {
          operatorId,
          trustedActors: [
            actor(Object.values(E.Capability)),
            { actorId: gateway, actorKind: 'SERVICE', capabilities: [E.Capability.EVENT_READ] },
            {
              actorId: betting,
              actorKind: 'SERVICE',
              capabilities: [E.Capability.QUOTE_VALIDATE, E.Capability.EVENT_READ],
            },
          ],
        },
      ],
      outboxRetryMs: 10,
    },
    identity,
    host: host('events'),
    graphql: graph,
    broker: broker('events'),
    worker: { ...worker(Object.values(E.Capability)), schedule: [], startsAt: now },
    operations: ops,
  },
);

json(
  'api-gateway',
  {
    service: 'api-gateway',
    namespace,
    operators: [
      {
        operatorId,
        currencies: ['USD'],
        syntheticProvider: 'synthetic',
        trustedRegistrationActors: [{ actorId: system, actorKind: 'SYSTEM' }],
      },
    ],
    clients: {
      players: client([
        P.Capability.REGISTER_PLAYER,
        P.Capability.PROFILE_READ,
        P.Capability.PROFILE_WRITE,
        P.Capability.EVALUATE_ELIGIBILITY,
      ]),
      wallet: client([
        L.Capability.READ_WALLET,
        L.Capability.READ_JOURNAL,
        L.Capability.FUND_SYNTHETIC,
        L.Capability.WITHDRAW,
      ]),
      bets: client([B.Capability.PLACE_BET, B.Capability.CANCEL_BET, B.Capability.BET_READ]),
      events: client([E.Capability.EVENT_READ]),
    },
    identity: { ...identity, issuer: 'synthetic-public', audience: 'synthetic-public' },
    host: '$RUN_BIND',
    port: 8080,
    operations: ops,
  },
);

const readActor = {
  operatorId,
  actorId: playerId,
  actorKind: 'PLAYER',
  playerId,
  capabilities: Object.values(G.Capability),
};

json(
  'fixture',
  {
    version: 1,
    setup: [
      {
        service: 'player',
        action: {
          method: 'POST',
          path: '/internal/v1/players',
          actor: actor(Object.values(P.Capability)),
          body: {
            request_id: registration,
            external_ref: 'synthetic:control',
            locale: 'en-US',
            time_zone: 'UTC',
          },
        },
        expectedStatus: 201,
      },
      {
        service: 'ledger',
        action: {
          method: 'POST',
          path: '/internal/v1/wallets/' + walletId + '/deposits',
          actor: actor(Object.values(L.Capability)),
          body: {
            request_id: id('fund'),
            amount: { amount_minor: '100000', currency: 'USD' },
            provider_ref: 'synthetic:control',
          },
        },
        expectedStatus: 200,
      },
    ],
    actions: [
      { method: 'GET', path: '/v1/wallet?currency=USD', actor: readActor },
      { method: 'GET', path: '/v1/events?limit=10', actor: readActor },
    ],
    auditActor: actor(Object.values(L.Capability)),
  },
);

const names = ['api-gateway', 'ledger', 'player', 'betting', 'event-simulator'];

const edges = [
  ...names.filter(n => n !== 'api-gateway').map(to => ({ from: 'api-gateway', to, protocol: 'GRPC' })),
  ...['ledger', 'player', 'event-simulator'].map(to => ({ from: 'betting', to, protocol: 'GRPC' })),
];

writeFileSync(
  folder + '/profile.yaml',
  stringify({
    version: 1,
    name: 'control',
    kind: 'PLATFORM',
    seed: '42',
    repetitions: 3,
    services: names.map(service => ({
      service,
      replicas: 1,
      cpu: .5,
      memoryMb: 256,
      configuration: folder + '/' + service + '.json',
      ...(service === 'api-gateway' ? {} : {
        database: {
          backend: ['ledger', 'event-simulator'].includes(service) ? 'PG' : 'TYPEORM',
          poolMax: 4,
          connectionBudget: 8,
          ...(service === 'ledger' ? { concurrency: 'rc_conditional' } : {}),
        },
      }),
    })),
    edges,
    fixture: folder + '/fixture.json',
    workload: {
      scenario: 'CONTROL',
      mode: 'CLOSED_LOOP',
      concurrency: 2,
      warmupSeconds: 0,
      durationSeconds: 2,
      maxInFlight: 4,
      devices: [{ name: 'local', kind: 'LOCAL' }],
    },
    dimensions: [],
    telemetry: { enabled: true, traceSampleRatio: 1, intervalMs: 1000 },
  }),
);
