import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as Wire from '@sportsbook/events-client';
import * as LedgerWire from '@sportsbook/ledger-client';
import type { ISchemaManifest } from '@sportsbook/persistence';
import { applyMigrations, assertSchema, PersistenceBackend, readMigrations } from '@sportsbook/persistence';
import * as PlayerWire from '@sportsbook/player-client';
import type { IDurableConsumerSettings } from '@sportsbook/service-transport';
import {
  BrokerCredentialKind,
  configureJetStream,
  DeliveryDisposition,
  DurableConsumer,
  DurablePublisher,
  jsonWire,
  MessagingMetrics,
} from '@sportsbook/service-transport';
import { connect } from 'nats';
import { Pool } from 'pg';

import { EventResultConsumer } from '../../../apps/betting/src/adapters/inbound/nats/event-result.consumer.js';
import { decodeInput } from '../../../apps/betting/src/adapters/outbound/clients/betting-client.dto.js';
import { BettingPublication } from '../../../apps/betting/src/adapters/outbound/nats/betting-publication.js';
import * as B from '../../../apps/betting/src/domain/betting.model.js';
import * as Output from '../../../apps/betting/src/domain/betting-output.policy.js';
import type {
  IBettingApplicationSettings,
  IBettingClients,
} from '../../../apps/betting/src/infra/betting-application.factory.js';
import { createBettingApplication } from '../../../apps/betting/src/infra/betting-application.factory.js';
import { EventsPublication } from '../../../apps/event-simulator/src/adapters/outbound/nats/events-publication.js';
import * as E from '../../../apps/event-simulator/src/domain/events.model.js';
import { createEventsApplication } from '../../../apps/event-simulator/src/infra/events-application.factory.js';
import { LedgerPublication } from '../../../apps/ledger/src/adapters/outbound/nats/ledger-publication.js';
import * as L from '../../../apps/ledger/src/domain/ledger.model.js';
import { PlayerPublication } from '../../../apps/player/src/adapters/outbound/nats/player-publication.js';
import * as P from '../../../apps/player/src/domain/player.model.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

const stamp = String(process.pid);

const pgName = 'sportsbook-delivery-pg-' + stamp;

const natsName = 'sportsbook-delivery-nats-' + stamp;

const natsImage = 'nats:2.12.4-alpine@sha256:31c6ed3b2da61645aaa3ad9217b5a52b34b6ebd555ecb71259cd7723c59ae1ea';

const pgImage = 'postgres:17.9@sha256:2a0d0fe14825b0939f78a8cad5cd4e6aa68bf94d0e5dd96e24b6d23af4315545';

function docker(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.error?.message || 'Isolated Docker command failed');
  }

  return result.stdout.trim();
}

const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const clock = { now: () => new Date().toISOString() };

let serial = 20000;

const id = (): string => '00000000-0000-4000-8000-' + String(serial++).padStart(12, '0');

const operatorId = id();

const playerId = id();

const actorId = id();

const eventsActor = id();

const runId = id();

const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const pgStarted = docker(
  [
    'run',
    '--rm',
    '--detach',
    '--name',
    pgName,
    '-e',
    'POSTGRES_USER=migration_owner',
    '-e',
    'POSTGRES_PASSWORD=password',
    '-p',
    '127.0.0.1::5432',
    pgImage,
  ],
);

let natsStarted = false;

let admin: Pool | undefined;

const owners: Pool[] = [];

const publishers: DurablePublisher[] = [];

let eventsApp: Awaited<ReturnType<typeof createEventsApplication>> | undefined;

let bettingApp: Awaited<ReturnType<typeof createBettingApplication>> | undefined;

let consumer: DurableConsumer | undefined;

let child: ReturnType<typeof spawn> | undefined;

try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (spawnSync(
      'docker',
      ['exec', pgStarted, 'pg_isready', '-h', '127.0.0.1', '-U', 'migration_owner'],
    ).status
      === 0) {
      break;
    }
    if (attempt === 59) {
      throw new Error('PostgreSQL startup timed out');
    }
    await pause(100);
  }
  const pgAddress = docker(['port', pgStarted, '5432/tcp']);

  assert.match(pgAddress, /^127\.0\.0\.1:\d+$/);
  admin =
    new Pool(
      { connectionString: 'postgresql://migration_owner:password@' + pgAddress + '/postgres' },
    );
  await admin.query("CREATE ROLE runtime_user LOGIN PASSWORD 'password'");
  const urls: Record<string, string> = {};

  for (const [service, database] of [['event-simulator', 'events_delivery'], ['betting', 'betting_delivery']]) {
    if (!service || !database) {
      throw new Error('Missing database');
    }
    await admin.query('CREATE DATABASE ' + database);
    const owner = new Pool(
      { connectionString: 'postgresql://migration_owner:password@' + pgAddress + '/' + database },
    );

    owners.push(owner);
    await applyMigrations(owner, readMigrations(path.join(root, 'apps', service, 'migrations')));
    const manifest: ISchemaManifest =
      JSON.parse(
        readFileSync(
          path.join(
            root,
            'apps',
            service,
            'migrations/schema.json',
          ),
          'utf8',
        ),
      );

    await assertSchema(owner, manifest);
    await owner.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await owner.query('GRANT USAGE ON SCHEMA public TO runtime_user');
    await owner.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO runtime_user');
    urls[service] = 'postgresql://runtime_user:password@' + pgAddress + '/' + database;
  }
  const socket = createServer();

  await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve));
  const bound = socket.address();

  assert.ok(bound && typeof bound === 'object');
  const brokerPort = bound.port;

  await new Promise<void>(resolve => socket.close(() => resolve()));
  docker(
    [
      'run',
      '--detach',
      '--name',
      natsName,
      '-p',
      '127.0.0.1:' + brokerPort + ':4222',
      '-v',
      path.join(root, 'infra/nats/server.conf') + ':/etc/nats/server.conf:ro',
      ...['TOPOLOGY', 'EVENTS', 'PLAYER', 'LEDGER', 'BETTING'].flatMap(
        role => ['-e', 'NATS_' + role + '_PASSWORD=password'],
      ),
      natsImage,
      '--config',
      '/etc/nats/server.conf',
    ],
  );
  natsStarted = true;
  const address = docker(['port', natsName, '4222/tcp']);
  const servers = ['nats://' + address];
  const adminConnection = await readyConnection(servers);
  const topology = {
    duplicateWindowMs: 250,
    retentionMs: 60000,
    maxMessages: 1000,
    maxBytes: 10485760,
    ackWaitMs: 200,
    maxDeliver: 3,
    backoffMs: [200, 400],
    maxAckPending: 20,
  };

  await configureJetStream(await adminConnection.jetstreamManager(), topology);
  await configureJetStream(await adminConnection.jetstreamManager(), topology);
  await assert.rejects(
    configureJetStream(
      await adminConnection.jetstreamManager(),
      { ...topology, maxMessages: 1001 },
    ),
    /drift/,
  );
  await adminConnection.drain();
  async function publisher(user: string): Promise<DurablePublisher> {
    const instance = await DurablePublisher.connect(
      {
        servers,
        credentials: { kind: BrokerCredentialKind.USER, user, password: 'password' },
        timeoutMs: 500,
      },
      MessagingMetrics.forService(user),
    );

    publishers.push(instance);

    return instance;
  }
  let eventsPublisher = await publisher('events');
  let eventsPublication = new EventsPublication(eventsPublisher, clock);
  const bettingPublisher = await publisher('betting');
  const bettingPublication = new BettingPublication(bettingPublisher, clock);
  const unused = async (): Promise<never> => {
    throw new Error('Unexpected port');
  };
  const settings = {
    backend: PersistenceBackend.Pg,
    connectionString: urls['event-simulator'] ?? '',
    poolMax: 2,
    replicaCount: 1,
    connectionBudget: 2,
    acquisitionTimeoutMs: 5000,
    transactionTimeoutMs: 10000,
    statementTimeoutMs: 5000,
    lockTimeoutMs: 1000,
    retryAttempts: 10,
    outboxLeaseMs: 5000,
  };
  const start = clock.now();
  const eventContext = (): E.ICallContext =>
    ({
      operatorId,
      actorId,
      actorKind: E.ActorKind.SYSTEM,
      capabilities: Object.values(E.Capability),
      correlationId: id(),
      deadlineAt: new Date(Date.now() + 10000).toISOString(),
    });
  let losePublishAck = false;

  eventsApp =
    await createEventsApplication(
      {
        namespace,
        persistence: settings,
        fixtures: [
          {
            operatorId,
            runId,
            seed: 1n,
            startsAt: start,
            eventCount: 1,
            quoteValidityMs: 300000,
            period: E.MarketPeriod.NORMAL_TIME,
          },
        ],
        operators: [
          {
            operatorId,
            trustedActors: [
              { actorId, actorKind: E.ActorKind.SYSTEM, capabilities: Object.values(E.Capability) },
              {
                actorId: eventsActor,
                actorKind: E.ActorKind.SERVICE,
                capabilities: [E.Capability.EVENT_READ, E.Capability.QUOTE_VALIDATE],
              },
            ],
          },
        ],
        outboxRetryMs: 20,
      },
      clock,
      {
        publish: async (context, event) => {
          const receipt = await eventsPublication.publish(context, event);

          if (losePublishAck) {
            losePublishAck = false;
            throw new Error('Synthetic lost publish reply');
          }

          return receipt;
        },
      },
    );
  function value<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
    assert.ok(
      result.ok,
      JSON.stringify(
        result,
        (_key, item: unknown) => typeof item === 'bigint' ? item.toString() : item,
      ),
    );

    return result.value;
  }
  const event = value(
    await eventsApp.operations.listEvents.execute({ context: eventContext(), page: { limit: 1 } }),
  ).events[0];

  assert.ok(event);
  const quote = value(
    await eventsApp.operations.getMarkets.execute({ context: eventContext(), eventId: event.eventId }),
  ).markets[0]?.selections[0];

  assert.ok(quote);
  const bContext = (): B.ICallContext =>
    ({
      operatorId,
      actorId,
      actorKind: B.ActorKind.SYSTEM,
      capabilities: Object.values(B.Capability),
      correlationId: id(),
      deadlineAt: new Date(Date.now() + 10000).toISOString(),
    });
  const playerContext = (): B.ICallContext => ({ ...bContext(), actorKind: B.ActorKind.SERVICE, playerId });
  const eventRead = (): E.ICallContext =>
    ({
      ...eventContext(),
      actorId: eventsActor,
      actorKind: E.ActorKind.SERVICE,
      capabilities: [E.Capability.EVENT_READ, E.Capability.QUOTE_VALIDATE],
    });
  let financial: B.IReservationView | undefined;
  let financialEffects = 0;
  const walletId = id();
  const posted = (requestId: string, betId: string): B.ILedgerReserveStakeOutput => {
    assert.ok(financial);

    return {
      reservation: structuredClone(financial),
      outcome: {
        requestId,
        state: B.FinancialOutcomeState.COMPLETED,
        transactionId: financial.settlementTransactionId ?? financial.reservationTransactionId,
        businessRef: betId,
        wallet: {
          walletId,
          playerId,
          currency: 'USD',
          status: B.WalletStatus.ACTIVE,
          availableMinor: 100000n,
          reservedMinor: 0n,
          withdrawalHoldMinor: 0n,
          version: 1n,
          observedAt: clock.now(),
        },
        replayed: false,
      },
    };
  };
  const clients: IBettingClients = {
    eligibility: {
      check: async () =>
        ({
          eligibility: {
            allowed: true,
            reasonCode: B.EligibilityReason.ELIGIBLE,
            policyVersion: 'TEST',
            evaluatedAt: clock.now(),
            validUntil: new Date(Date.now() + 300000).toISOString(),
            playerVersion: 1n,
          },
        }),
    },
    quotes: {
      validateSelection: async (
        _context,
        playerId,
        eventId,
        marketId,
        selectionId,
        quoteId,
        quoteVersion,
      ) => {
        assert.ok(eventsApp);
        const result = value(
          await eventsApp.operations.validateSelectionQuote.execute(
            { context: eventRead(), playerId, eventId, marketId, selectionId, quoteId, quoteVersion },
          ),
        );
        const output = decodeInput('IEventsValidateSelectionQuoteOutput', jsonWire(result), false);

        assert.ok(Output.isIEventsValidateSelectionQuoteOutput(output));

        return output;
      },
      getEvent: unused,
    },
    reservations: {
      reserve: async (_context, requestId, betId, _playerId, stake) => {
        assert.equal(financial, undefined);
        financial =
          { betId, walletId, stake, state: B.ReservationState.RESERVED, reservationTransactionId: id() };
        financialEffects++;

        return posted(requestId, betId);
      },
      getStatus: async () =>
        ({ observedAt: clock.now(), ...(financial ? { reservation: structuredClone(financial) } : {}) }),
      cancel: unused,
    },
    settlements: {
      getStatus: async () =>
        ({ observedAt: clock.now(), ...(financial ? { reservation: structuredClone(financial) } : {}) }),
      settleWin: async (_context, requestId, betId, settlementSeq, payout) => {
        assert.ok(financial);

        if (financial.state === B.ReservationState.RESERVED) {
          financial =
            {
              ...financial,
              state: B.ReservationState.WON,
              settlementSeq,
              settlementTransactionId: id(),
              grossPayoutMinor: payout.amountMinor,
            };
          financialEffects++;
        }

        return posted(requestId, betId);
      },
      settleLoss: unused,
      void: unused,
    },
  };
  const bettingConfig: IBettingApplicationSettings = {
    namespace,
    persistence: {
      ...settings,
      backend: PersistenceBackend.TypeOrm,
      connectionString: urls.betting ?? '',
      replicaCount: 2,
      connectionBudget: 4,
    },
    operators: [
      {
        operatorId,
        currencies: ['USD'],
        marketPeriod: B.MarketPeriod.NORMAL_TIME,
        trustedActors: [
          { actorId, actorKind: B.ActorKind.SYSTEM, capabilities: Object.values(B.Capability) },
          {
            actorId,
            actorKind: B.ActorKind.SERVICE,
            capabilities: [B.Capability.PLACE_BET, B.Capability.BET_READ],
          },
          {
            actorId: eventsActor,
            actorKind: B.ActorKind.SERVICE,
            capabilities: [B.Capability.SETTLE_BET],
          },
        ],
      },
    ],
    outboxRetryMs: 20,
  };

  bettingApp = await createBettingApplication(bettingConfig, clock, clients, bettingPublication);
  const bet = value(
    await bettingApp.operations.placeBet.execute(
      {
        context: playerContext(),
        requestId: id(),
        playerId,
        type: B.BetType.SINGLE,
        stake: { amountMinor: 101n, currency: 'USD' },
        selection: {
          eventId: event.eventId,
          marketId: quote.marketId,
          selectionId: quote.selectionId,
          quoteId: quote.quoteId,
          quoteVersion: quote.quoteVersion,
        },
      },
    ),
  );

  assert.equal(bet.outcome, B.PlaceOutcome.ACCEPTED);
  assert.equal(financialEffects, 1);
  const live = value(
    await eventsApp.operations.advanceMatchPhase.execute(
      {
        context: eventContext(),
        requestId: id(),
        eventId: event.eventId,
        expectedPhaseSeq: 1n,
        nextPhase: E.EventPhase.LIVE,
        simulatedAt: clock.now(),
      },
    ),
  );

  value(
    await eventsApp.operations.publishOutboxBatch.execute(
      { input: { context: eventContext(), batchId: id(), limit: 20, cutoff: clock.now() } },
    ),
  );
  docker(['stop', '--time', '1', natsName]);
  const result: E.IEventResult = {
    resultId: id(),
    eventId: event.eventId,
    runId,
    resultSeq: 1n,
    homeGoals: 2,
    awayGoals: 0,
    outcome: E.ResultOutcome.HOME,
    occurredAt: clock.now(),
  };

  value(
    await eventsApp.operations.completeEvent.execute(
      {
        context: eventContext(),
        requestId: id(),
        eventId: event.eventId,
        expectedPhaseSeq: live.event.phaseSeq,
        result,
      },
    ),
  );
  const offline = value(
    await eventsApp.operations.publishOutboxBatch.execute(
      { input: { context: eventContext(), batchId: id(), limit: 20, cutoff: clock.now() } },
    ),
  );

  assert.equal(offline.report.pending, 1);
  assert.equal(
    (await owners[0]?.query('SELECT message_id FROM event_outbox_events WHERE published_at IS NULL'))?.rowCount,
    1,
  );
  const closeStarted = performance.now();

  await eventsPublisher.close().catch(() => { });
  assert.ok(
    performance.now() - closeStarted < 2000,
    'Publisher shutdown exceeded its bound during outage',
  );
  console.log('Broker outage retained committed result; publisher shutdown was bounded.');
  docker(['start', natsName]);
  const ready = await readyConnection(servers);

  await ready.close();
  eventsPublisher = await publisher('events');
  eventsPublication = new EventsPublication(eventsPublisher, clock);
  losePublishAck = true;
  await pause(30);
  assert.equal(
    value(
      await eventsApp.operations.publishOutboxBatch.execute(
        { input: { context: eventContext(), batchId: id(), limit: 20, cutoff: clock.now() } },
      ),
    ).report.pending,
    1,
  );
  const consumerSettings: IDurableConsumerSettings = {
    servers,
    credentials: { kind: BrokerCredentialKind.USER, user: 'betting', password: 'password' },
    timeoutMs: 1000,
    stream: 'SPORTSBOOK_EVENTS',
    durable: 'BETTING_RESULTS',
    subject: 'sportsbook.events.v1.event_result',
    pullExpiresMs: 1000,
    retryDelayMs: 50,
  };
  const route = { operatorId, actorId: eventsActor };
  const childFile = path.join(root, 'tools/messaging/test/consumer-child.fixture.ts');

  child =
    spawn(
      process.execPath,
      ['--import', 'tsx', childFile],
      {
        cwd: root,
        env: {
          ...process.env,
          TEST_BETTING_CONFIG: JSON.stringify(bettingConfig),
          TEST_CONSUMER_SETTINGS: JSON.stringify(consumerSettings),
          TEST_EVENT_ROUTE: JSON.stringify(route),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  await new Promise<void>(
    (resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Consumer did not commit before kill')), 15000);

      child?.stdout?.on(
        'data',
        data => {
          output += String(data);

          if (output.includes('COMMITTED')) {
            clearTimeout(timer);
            resolve();
          }
        },
      );
      child?.on(
        'exit',
        () => {
          if (!output.includes('COMMITTED')) {
            clearTimeout(timer);
            reject(new Error('Consumer exited before commit'));
          }
        },
      );
      child?.stderr?.on('data', data => process.stderr.write(String(data)));
    },
  );
  child.kill('SIGKILL');
  await new Promise<void>(resolve => child?.once('exit', () => resolve()));
  child = undefined;
  const bettingOwner = owners[1];

  assert.ok(bettingOwner);
  assert.equal((await bettingOwner.query('SELECT * FROM bet_inbox_events')).rowCount, 1);
  assert.equal((await bettingOwner.query('SELECT * FROM bet_settlement_sweeps')).rowCount, 1);
  await pause(300);
  consumer =
    await DurableConsumer.connect(consumerSettings, MessagingMetrics.forService('betting'));
  const handler = new EventResultConsumer(bettingApp.operations.recordEventResult, [route], clock, 10000);

  assert.equal(
    (await consumer.consumeBatch(1, delivery => handler.handle(delivery))).acknowledged,
    1,
  );
  // Retry after the broker's deduplication window: a second stored message is still one DB effect.
  await pause(300);
  value(
    await eventsApp.operations.publishOutboxBatch.execute(
      { input: { context: eventContext(), batchId: id(), limit: 20, cutoff: clock.now() } },
    ),
  );
  assert.equal(
    (await consumer.consumeBatch(1, delivery => handler.handle(delivery))).acknowledged,
    1,
  );
  assert.equal((await bettingOwner.query('SELECT * FROM bet_inbox_events')).rowCount, 1);
  const sweep = await bettingOwner.query<{ bet_settlement_sweep_id: string }>(
    'SELECT bet_settlement_sweep_id FROM bet_settlement_sweeps',
  );
  const sweepId = sweep.rows[0]?.bet_settlement_sweep_id;

  assert.ok(sweepId);
  value(
    await bettingApp.operations.scheduleEventSettlements.execute(
      { context: bContext(), sweepId, page: { limit: 20 } },
    ),
  );
  value(
    await bettingApp.operations.retryPendingSettlement.execute(
      { context: bContext(), batchId: id(), page: { limit: 20 }, pendingBefore: clock.now() },
    ),
  );
  assert.equal(financialEffects, 2);
  const terminal = value(
    await bettingApp.operations.getBet.execute(
      { context: playerContext(), playerId, betId: bet.bet.betId },
    ),
  ).bet;

  assert.equal(terminal.status, B.BetStatus.WON);
  assert.equal(terminal.actualPayoutMinor, bet.bet.potentialPayoutMinor);
  const messages = await owners[0]?.query<{ payload: unknown }>(
    'SELECT payload FROM event_outbox_events WHERE event_type=\'EVENT_RESULT\'',
  );
  const message = messages?.rows[0]?.payload;

  assert.ok(message && typeof message === 'object');
  const decoded = objectValue(message);
  const payload = objectValue(decoded.payload);
  const encoded = (change = false): Uint8Array =>
    Wire.EventEnvelope.encode(
      Wire.EventEnvelope.fromJSON(
        {
          ...decoded,
          source: 'EVENT_ENVELOPE_SOURCE_EVENTS',
          eventType: 'EVENT_TYPE_EVENT_RESULT',
          payload: {
            eventResult: { ...payload, ...(change ? { homeGoals: 3 } : {}), outcome: 'EVENT_RESULT_OUTCOME_HOME' },
          },
        },
      ),
    ).finish();
  const messageId = String(decoded.messageId);

  await pause(300);
  await eventsPublisher.publish('sportsbook.events.v1.event_result', messageId, encoded(), 1000);
  assert.equal((await consumer.consumeBatch(1, async () => DeliveryDisposition.RETRY)).retried, 1);
  await pause(100);
  assert.equal(
    (await consumer.consumeBatch(1, delivery => handler.handle(delivery))).acknowledged,
    1,
  );
  assert.equal(financialEffects, 2);
  await pause(300);
  await eventsPublisher.publish('sportsbook.events.v1.event_result', messageId, encoded(true), 1000);
  assert.equal((await consumer.consumeBatch(1, delivery => handler.handle(delivery))).poison, 1);
  await eventsPublisher.publish('sportsbook.events.v1.event_result', id(), new Uint8Array([255]), 1000);
  assert.equal((await consumer.consumeBatch(1, delivery => handler.handle(delivery))).poison, 1);
  await pause(300);
  await eventsPublisher.publish('sportsbook.events.v1.event_result', messageId, encoded(), 1000);

  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal((await consumer.consumeBatch(1, async () => DeliveryDisposition.RETRY)).retried, 1);
    await pause(100);
  }
  assert.equal(
    (await consumer.consumeBatch(1, async () => DeliveryDisposition.RETRY)).selected,
    0,
  );
  await pause(50);
  // All owner publishers encode the same versioned external envelope contracts.
  const ledgerPublisher = await publisher('ledger');
  const ledgerPublication = new LedgerPublication(ledgerPublisher, clock);
  const ledgerContext: L.ICallContext = {
    operatorId,
    actorId,
    actorKind: L.ActorKind.SYSTEM,
    capabilities: [L.Capability.PUBLISH_EVENTS],
    correlationId: id(),
    deadlineAt: new Date(Date.now() + 10000).toISOString(),
  };
  const ledgerMessageId = id();

  await ledgerPublication.publish(
    ledgerContext,
    {
      messageId: ledgerMessageId,
      source: L.EventSource.LEDGER,
      eventType: L.EventType.LEDGER_POSTED,
      schemaVersion: 1,
      operatorId,
      correlationId: ledgerContext.correlationId,
      occurredAt: clock.now(),
      payload: {
        transactionId: id(),
        requestId: id(),
        businessRef: id(),
        transactionType: L.TransactionType.DEPOSIT,
        currency: 'USD',
        amountMinor: 9007199254740993n,
      },
    },
  );
  const playerPublisher = await publisher('player');
  const playerPublication = new PlayerPublication(playerPublisher, clock);
  const playerContextForEvent: P.ICallContext = {
    operatorId,
    actorId,
    actorKind: P.ActorKind.SYSTEM,
    capabilities: [P.Capability.PUBLISH_EVENTS],
    correlationId: id(),
    deadlineAt: new Date(Date.now() + 10000).toISOString(),
  };

  await playerPublication.publish(
    playerContextForEvent,
    {
      messageId: id(),
      source: P.EventSource.PLAYER,
      eventType: P.EventType.PLAYER_REGISTERED,
      schemaVersion: 1,
      operatorId,
      correlationId: playerContextForEvent.correlationId,
      occurredAt: clock.now(),
      payload: { playerId, registeredAt: clock.now() },
    },
  );
  const verify = await connect({ servers, user: 'topology', pass: 'password' });
  const manager = await verify.jetstreamManager();
  const ledgerLast = await manager.streams.getMessage(
    'SPORTSBOOK_LEDGER',
    { last_by_subj: 'sportsbook.ledger.v1.posted' },
  );
  const ledgerDecoded = LedgerWire.EventEnvelope.decode(ledgerLast.data).payload?.payload;

  assert.ok(ledgerDecoded?.$case === 'ledgerPostedEvent');
  assert.equal(ledgerDecoded.ledgerPostedEvent.amountMinor, 9007199254740993n);
  const playerLast = await manager.streams.getMessage(
    'SPORTSBOOK_PLAYER',
    { last_by_subj: 'sportsbook.player.v1.registered' },
  );
  const playerDecoded = PlayerWire.EventEnvelope.decode(playerLast.data).payload?.payload;

  assert.ok(playerDecoded?.$case === 'playerRegisteredEvent');
  assert.equal(playerDecoded.playerRegisteredEvent.playerId, playerId);
  await verify.drain();
  await assert.rejects(
    bettingPublisher.publish('sportsbook.events.v1.event_result', id(), encoded(), 200),
  );
  value(
    await bettingApp.operations.publishOutboxBatch.execute(
      { input: { context: bContext(), batchId: id(), limit: 200, cutoff: clock.now() } },
    ),
  );
  const metrics = MessagingMetrics.forService('betting').render()
    + MessagingMetrics.forService('events').render();

  assert.match(metrics, /redeliveries_total\{service="betting"\} [1-9]/);
  assert.match(metrics, /poison_total\{service="betting"\} 2/);
  assert.match(metrics, /advisories_total\{service="betting"\} [1-9]/);
  assert.match(metrics, /publish_failures_total\{service="events"\} [1-9]/);
  assert.match(metrics, /outbox_backlog\{service="events"\} 0/);
  assert.equal(financialEffects, 2);
  console.log(
    'JetStream: real consumer killed after DB commit, redelivery after restart, duplicate beyond dedup window, broker outage, lost publish ACK, bounded retries, poison/advisories, source permissions and one financial settlement passed.',
  );
  console.log(metrics);
} finally {
  if (child) {
    child.kill('SIGKILL');
    await new Promise<void>(resolve => child?.once('exit', () => resolve()));
  }
  await consumer?.close().catch(() => { });
  await bettingApp?.close();
  await eventsApp?.close();

  for (const publisher of publishers) {
    await publisher.close().catch(() => { });
  }

  for (const owner of owners) {
    await owner.end();
  }
  await admin?.end();

  if (natsStarted) {
    docker(['rm', '--force', natsName]);
  }
  docker(['stop', pgStarted]);
}

async function readyConnection(servers: string[]): Promise<Awaited<ReturnType<typeof connect>>> {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      return await connect({ servers, user: 'topology', pass: 'password', timeout: 500 });
    } catch (error) {
      if (attempt === 29) {
        throw error;
      }
      await pause(100);
    }
  }
  throw new Error('NATS readiness timeout');
}

function objectValue(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid record');
  }

  return Object.fromEntries(Object.entries(value));
}
