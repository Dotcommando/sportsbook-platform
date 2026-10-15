import assert from 'node:assert/strict';
import test from 'node:test';

import {UuidGenerator} from '../src/adapters/outbound/ids/uuid-generator.js';
import {seededFixtures} from '../src/adapters/outbound/persistence/seeded-fixtures.js';
import * as M from '../src/domain/events.model.js';
import {Match, Quote} from '../src/domain/match.policy.js';

test('seed and explicit period reproduce exact fixtures; phase and clock regressions fail', ()=>{
  const id = '00000000-0000-4000-8000-000000000001';const at = '2026-10-15T12:00:00Z';const ids = new UuidGenerator('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  const config = {operatorId:id, runId:id, seed:9223372036854775807n, startsAt:at, eventCount:1, quoteValidityMs:60000, period:M.MarketPeriod.NORMAL_TIME};const fixtures = seededFixtures(config, ids);

assert.deepEqual(fixtures, seededFixtures(config, ids));const fixture = fixtures[0];

assert.ok(fixture);const event = fixture.event;

  assert.throws(()=>Match.advance(event, 2n, M.EventPhase.LIVE, at));assert.throws(()=>Match.advance(event, 1n, M.EventPhase.FINISHED, at));assert.throws(()=>Match.advance(event, 1n, M.EventPhase.LIVE, '2026-10-14T12:00:00Z'));assert.doesNotThrow(()=>Match.advance(event, 1n, M.EventPhase.LIVE, at));
  const quote = fixture.quotes[0];

assert.ok(quote);const context:M.ICallContext = {operatorId:id, actorId:id, actorKind:M.ActorKind.SERVICE, playerId:id, capabilities:[], correlationId:id, deadlineAt:at};const input = {context, playerId:id, eventId:quote.eventId, marketId:quote.marketId, selectionId:quote.selectionId, quoteId:quote.quoteId, quoteVersion:1n};

  assert.equal(Quote.accept(event, quote, input, at).odds, quote.odds);assert.throws(()=>Quote.accept(event, quote, input, quote.validUntil));assert.throws(()=>Quote.accept(event, {...quote, odds:'1.00000000'}, input, at));assert.throws(()=>Quote.accept(event, {...quote, odds:'1000.00000001'}, input, at));
});
