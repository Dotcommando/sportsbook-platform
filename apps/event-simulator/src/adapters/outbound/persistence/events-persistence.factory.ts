import { createHash } from 'node:crypto';

import type { ITransactionalRuntime, ITransactionalSettings } from '@sportsbook/persistence';
import { createTransactionalRuntime, PersistenceBackend, TransactionIsolation } from '@sportsbook/persistence';

import * as M from '../../../domain/events.model.js';
import { requireRule, validUuid } from '../../../domain/events.policy.js';
import type {
  ClockPort,
  EventUnitOfWorkPort,
  IdGeneratorPort,
  OutboxDeliveryPort,
} from '../../../ports/outbound/events.port.js';
import { canonicalJson, losslessJson } from '../ids/command-fingerprint.js';
import { EventsOutboxDelivery } from './events-outbox.js';
import { EventSqlUnitOfWork } from './events-unit-of-work.js';
import type { IFixtureSettings } from './seeded-fixtures.js';
import { seededFixtures } from './seeded-fixtures.js';

export interface IEventsPersistenceSettings extends ITransactionalSettings {
  retryAttempts: number;
  outboxLeaseMs: number;
}

export interface IEventsPersistence {
  unitOfWork: EventUnitOfWorkPort;
  outbox: OutboxDeliveryPort;
  ready(): Promise<void>;
  close(): Promise<void>;
}

async function seed(
  runtime: ITransactionalRuntime,
  settings: IFixtureSettings,
  ids: IdGeneratorPort,
): Promise<void> {
  const fixtures = seededFixtures(settings, ids);
  const hash = createHash('sha256').update(canonicalJson(settings)).digest('hex');

  await runtime.run(
    TransactionIsolation.READ_COMMITTED,
    async (session) => {
      await session.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [settings.operatorId + ':' + settings.runId],
      );
      const existing = await session.query(
        'SELECT operator_id,profile_hash FROM event_runs WHERE run_id=$1',
        [settings.runId],
      );

      if (existing.length) {
        requireRule(
          existing[0]?.operator_id === settings.operatorId && existing[0]?.profile_hash === hash,
          M.ErrorCode.IDEMPOTENCY_CONFLICT,
        );

        return;
      }
      await session.query(
        "INSERT INTO event_runs(run_id,operator_id,seed,profile_hash,simulated_at,clock_seq,status,created_at) VALUES($1,$2,$3::bigint,$4,$5,1,'ACTIVE',$5) RETURNING run_id",
        [settings.runId, settings.operatorId, settings.seed.toString(), hash, settings.startsAt],
      );

      for (const fixture of fixtures) {
        const event = fixture.event;

        await session.query(
          'INSERT INTO event_match_states(event_state_id,operator_id,run_id,event_id,phase,phase_seq,snapshot) VALUES($1,$2,$3,$4,$5,1,$6::jsonb) RETURNING event_id',
          [
            ids.derive(settings.operatorId, event.eventId, 'events:state'),
            settings.operatorId,
            settings.runId,
            event.eventId,
            event.phase,
            losslessJson(event),
          ],
        );

        for (const quote of fixture.quotes) {
          await session.query(
            'INSERT INTO event_quote_snapshots(quote_id,operator_id,run_id,event_id,market_id,selection_id,quote_version,odds,state,valid_until) VALUES($1,$2,$3,$4,$5,$6,1,$7::numeric,$8,$9) RETURNING quote_id',
            [
              quote.quoteId,
              settings.operatorId,
              settings.runId,
              event.eventId,
              quote.marketId,
              quote.selectionId,
              quote.odds,
              quote.state,
              quote.validUntil,
            ],
          );
        }
      }
    },
  );
}

export async function createEventsPersistence(
  settings: IEventsPersistenceSettings,
  fixtures: readonly IFixtureSettings[],
  operators: readonly M.IEventsOperatorSettings[],
  ids: IdGeneratorPort,
  clock: ClockPort,
): Promise<IEventsPersistence> {
  requireRule(
    settings.backend === PersistenceBackend.Pg && Number.isInteger(settings.retryAttempts)
    && settings.retryAttempts >= 1
    && settings.retryAttempts <= 100
    && Number.isInteger(settings.outboxLeaseMs)
    && settings.outboxLeaseMs >= 1
    && settings.outboxLeaseMs <= 60000,
  );
  requireRule(
    operators.length > 0 && new Set(operators.map(o => o.operatorId)).size === operators.length
    && fixtures.length === operators.length
    && new Set(fixtures.map(f => f.operatorId)).size === fixtures.length,
  );

  for (const operator of operators) {
    requireRule(
      validUuid(operator.operatorId) && fixtures.some(f => f.operatorId === operator.operatorId)
      && operator.trustedActors.length > 0,
    );

    for (const actor of operator.trustedActors) {
      requireRule(
        validUuid(actor.actorId) && [M.ActorKind.SERVICE, M.ActorKind.SYSTEM].includes(actor.actorKind)
        && actor.capabilities.length > 0
        && actor.capabilities.every(c => Object.values(M.Capability).includes(c)),
      );
    }
  }

  for (const fixture of fixtures) {
    seededFixtures(fixture, ids);
  }
  const runtime = await createTransactionalRuntime(settings);

  try {
    for (const fixture of fixtures) {
      await seed(runtime, fixture, ids);
    }

    return {
      unitOfWork: new EventSqlUnitOfWork(
        runtime,
        ids,
        clock,
        fixtures,
        settings.retryAttempts,
        settings.statementTimeoutMs,
        settings.lockTimeoutMs,
      ),
      outbox: new EventsOutboxDelivery(runtime, ids, clock, settings.outboxLeaseMs),
      ready: async () => {
        await runtime.run(
          TransactionIsolation.READ_COMMITTED,
          async (session) => {
            await session.query('SELECT 1');
          },
        );
      },
      close: () => runtime.close(),
    };
  } catch (error) {
    await runtime.close();
    throw error;
  }
}
