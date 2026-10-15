import assert from 'node:assert/strict';

import {PersistenceBackend} from '@sportsbook/persistence';
import type {Pool} from 'pg';

import {losslessJson} from '../src/adapters/outbound/ids/command-fingerprint.js';
import {UuidGenerator} from '../src/adapters/outbound/ids/uuid-generator.js';
import {seededFixtures} from '../src/adapters/outbound/persistence/seeded-fixtures.js';
import * as M from '../src/domain/events.model.js';
import type {IEventsApplicationSettings} from '../src/infra/events-application.factory.js';
import {createEventsApplication} from '../src/infra/events-application.factory.js';

export async function verifyEventsPersistence(owner:Pool, connectionString:string):Promise<void> {
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';const ids = new UuidGenerator(namespace);let counter = 100;const next = ():string=>`00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
  const operatorId = next();const actorId = next();const runId = next();const otherOperator = next();let time = Date.parse('2026-10-15T12:00:00Z');const clock = {now:()=>new Date(time).toISOString()};
  const context:M.ICallContext = {operatorId, actorId, actorKind:M.ActorKind.SYSTEM, capabilities:Object.values(M.Capability), correlationId:next(), deadlineAt:'2026-10-16T12:00:00Z'};
  const fixture = {operatorId, runId, seed:9223372036854775807n, startsAt:clock.now(), eventCount:3, quoteValidityMs:60000, period:M.MarketPeriod.NORMAL_TIME};
  const config:IEventsApplicationSettings = {namespace, persistence:{backend:PersistenceBackend.Pg, connectionString, poolMax:4, replicaCount:1, connectionBudget:4, acquisitionTimeoutMs:10000, transactionTimeoutMs:30000, statementTimeoutMs:10000, lockTimeoutMs:1000, retryAttempts:20, outboxLeaseMs:1000}, fixtures:[fixture, {...fixture, operatorId:otherOperator, runId:next()}], operators:[operatorId, otherOperator].map(operatorId=>({operatorId, trustedActors:[{actorId, actorKind:M.ActorKind.SYSTEM, capabilities:Object.values(M.Capability)}, {actorId:operatorId, actorKind:M.ActorKind.SERVICE, capabilities:[M.Capability.QUOTE_VALIDATE]}]})), outboxRetryMs:10};
  let failPublication = true;const messages:M.IEventEnvelope[] = [];const publication = {publish:async(_context:M.ICallContext, message:M.IEventEnvelope):Promise<M.IPublicationReceipt>=>{messages.push(message);

if (failPublication) {failPublication = false;throw new Error('Synthetic broker outage');}

 return {messageId:message.messageId, acceptedAt:clock.now(), durable:true};}};
  const seeds = seededFixtures(fixture, ids);

assert.deepEqual(seeds, seededFixtures(structuredClone(fixture), new UuidGenerator(namespace)));const first = seeds[0];const second = seeds[1];

assert.ok(first && second);
  let app = await createEventsApplication(config, clock, publication);
  const value = <T>(result:M.IResult<T>):T=>{assert.ok(result.ok, losslessJson(result));

return result.value;};

  try {
    const page = value(await app.operations.listEvents.execute({context, page:{limit:1}}));

assert.equal(page.events.length, 1);assert.ok(page.nextCursor);
    const page2 = value(await app.operations.listEvents.execute({context, page:{limit:1, cursor:page.nextCursor}}));

assert.notEqual(page.events[0]?.eventId, page2.events[0]?.eventId);
    assert.equal((await app.operations.listEvents.execute({context:{...context, operatorId:otherOperator}, page:{limit:1, cursor:page.nextCursor}})).ok, false);
    assert.equal((await app.operations.getEvent.execute({context:{...context, operatorId:otherOperator}, eventId:first.event.eventId})).ok, false);
    assert.equal((await app.operations.getEvent.execute({context:{...context, actorId:next()}, eventId:first.event.eventId})).ok, false);
    assert.equal(value(await app.operations.getEventResult.execute({context, eventId:first.event.eventId})).ready, false);
    const quote = first.quotes[0];

assert.ok(quote);const delegated = {...context, actorId:operatorId, actorKind:M.ActorKind.SERVICE, playerId:next()};
    const quoteInput = {context:delegated, playerId:delegated.playerId, eventId:quote.eventId, marketId:quote.marketId, selectionId:quote.selectionId, quoteId:quote.quoteId, quoteVersion:quote.quoteVersion};

    assert.equal(value(await app.operations.validateSelectionQuote.execute(quoteInput)).acceptedQuote.odds, quote.odds);
    const input:M.IEventsAdvanceMatchPhaseInput = {context, requestId:next(), eventId:first.event.eventId, expectedPhaseSeq:1n, nextPhase:M.EventPhase.LIVE, simulatedAt:clock.now()};
    const races = await Promise.all(Array.from({length:20}, ()=>app.operations.advanceMatchPhase.execute(input)));

for (const result of races)assert.equal(value(result).event.phaseSeq, 2n);
    assert.equal((await owner.query('SELECT event_outbox_event_id FROM event_outbox_events WHERE operator_id=$1', [operatorId])).rowCount, 1);
    assert.equal((await app.operations.advanceMatchPhase.execute({...input, nextPhase:M.EventPhase.SUSPENDED})).ok, false);
    const stored = await owner.query('SELECT semantic_input,stable_child_ids FROM event_commands WHERE operator_id=$1 AND request_id=$2', [operatorId, input.requestId]);

assert.equal(stored.rows[0]?.semantic_input.eventId, input.eventId);assert.equal(stored.rows[0]?.stable_child_ids[0].id, ids.derive(operatorId, input.requestId, 'events:AdvanceMatchPhase:message'));
    assert.equal((await app.operations.validateSelectionQuote.execute(quoteInput)).ok, false);
    const current = value(await app.operations.getMarkets.execute({context, eventId:first.event.eventId})).markets[0]?.selections[0];

assert.ok(current);assert.equal(current.quoteVersion, 2n);
    await app.close();app = await createEventsApplication(config, clock, publication);assert.equal(value(await app.operations.getEvent.execute({context, eventId:first.event.eventId})).event.phaseSeq, 2n);
    const suspend = {...input, requestId:next(), expectedPhaseSeq:2n, nextPhase:M.EventPhase.SUSPENDED};

value(await app.operations.advanceMatchPhase.execute(suspend));
    const suspended = value(await app.operations.getMarkets.execute({context, eventId:first.event.eventId})).markets[0]?.selections[0];

assert.ok(suspended);
    assert.equal((await app.operations.validateSelectionQuote.execute({...quoteInput, ...suspended, playerId:delegated.playerId})).ok, false);
    const completion:M.IEventsCompleteEventInput = {context, requestId:next(), eventId:first.event.eventId, expectedPhaseSeq:3n, result:{resultId:next(), eventId:first.event.eventId, runId, resultSeq:1n, homeGoals:2, awayGoals:1, outcome:M.ResultOutcome.HOME, occurredAt:clock.now()}};

    assert.equal((await app.operations.completeEvent.execute({...completion, result:{...completion.result, outcome:M.ResultOutcome.AWAY}})).ok, false);
    const completed = value(await app.operations.completeEvent.execute(completion));

assert.equal(completed.event.resultRef, completion.result.resultId);assert.equal(completed.delivery, M.DeliveryState.PENDING);
    assert.deepEqual(value(await app.operations.completeEvent.execute({...completion, context:{...context, correlationId:next()}})), completed);
    assert.deepEqual(value(await app.operations.getEventResult.execute({context, eventId:first.event.eventId})).result, completion.result);
    await assert.rejects(owner.query('UPDATE event_results SET payload_hash=$1 WHERE operator_id=$2', ['changed', operatorId]), /immutable/);
    await assert.rejects(owner.query('DELETE FROM event_quote_snapshots WHERE operator_id=$1', [operatorId]), /immutable/);
    // Fault at the final local write must roll back phase, quotes and command claim.
    await owner.query("CREATE FUNCTION fail_event_intent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic outbox failure'; END; $$");await owner.query('CREATE TRIGGER fail_event_intent BEFORE INSERT ON event_outbox_events FOR EACH ROW EXECUTE FUNCTION fail_event_intent()');
    const rollback = {...input, requestId:next(), eventId:second.event.eventId};

assert.equal((await app.operations.advanceMatchPhase.execute(rollback)).ok, false);
    assert.equal(value(await app.operations.getEvent.execute({context, eventId:second.event.eventId})).event.phaseSeq, 1n);assert.equal((await owner.query('SELECT request_id FROM event_commands WHERE operator_id=$1 AND request_id=$2', [operatorId, rollback.requestId])).rowCount, 0);
    assert.equal((await owner.query('SELECT quote_id FROM event_quote_snapshots WHERE operator_id=$1 AND event_id=$2', [operatorId, second.event.eventId])).rowCount, 3);
    await owner.query('DROP TRIGGER fail_event_intent ON event_outbox_events');await owner.query('DROP FUNCTION fail_event_intent()');value(await app.operations.advanceMatchPhase.execute(rollback));
    const published = value(await app.operations.publishOutboxBatch.execute({input:{context, batchId:next(), limit:200, cutoff:clock.now()}}));

assert.equal(published.report.pending, 1);time += 20;
    const retried = value(await app.operations.publishOutboxBatch.execute({input:{context, batchId:next(), limit:200, cutoff:clock.now()}}));

assert.equal(retried.report.applied, 1);assert.equal(messages.at(-1)?.messageId, messages[0]?.messageId);
    assert.equal((await owner.query("SELECT conname FROM pg_constraint WHERE contype='f'")).rowCount, 0);
    console.log('Events PG: deterministic fixtures, scoped reads, concurrent replay, quote versions, suspension, immutable results, restart, atomic rollback and outbox retry passed.');
  } finally {await app.close();}
}
