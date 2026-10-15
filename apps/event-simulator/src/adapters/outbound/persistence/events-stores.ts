import {createHash} from 'node:crypto';

import type {IQuerySession, SqlArgument} from '@sportsbook/persistence';
import {persistenceRecord} from '@sportsbook/persistence';

import * as M from '../../../domain/events.model.js';
import {EventsError, requireRule, validInstant, validUuid} from '../../../domain/events.policy.js';
import * as Output from '../../../domain/events-output.policy.js';
import type * as Ports from '../../../ports/outbound/events.port.js';
import {canonicalJson, losslessJson} from '../ids/command-fingerprint.js';
import * as Codec from './events.codec.js';
import {PersistedMatchClock} from './match-clock.js';
import type {IFixtureSettings} from './seeded-fixtures.js';
import {seededFixtures} from './seeded-fixtures.js';

export class EventsSqlStores {
  readonly ports:Ports.IEventTransactionPorts;

  constructor(private readonly session:IQuerySession, private readonly bound:M.ICallContext, private readonly ids:Ports.IdGeneratorPort, private readonly clock:Ports.ClockPort, private readonly fixture:IFixtureSettings) {
    this.ports = {catalog:{list:(...args)=>this.list(...args), find:(...args)=>this.find(...args), changePhase:(...args)=>this.changePhase(...args)}, quotes:{list:(...args)=>this.markets(...args), find:(...args)=>this.quote(...args), changeMarketStates:(...args)=>this.changeQuotes(...args)}, results:{find:(...args)=>this.result(...args), complete:(...args)=>this.completeResult(...args)}, commands:{find:(...args)=>this.command(...args), claim:(...args)=>this.claim(...args), complete:(...args)=>this.completeCommand(...args)}, resultIntent:{storeIntent:async(context, result, envelope)=>{requireRule(envelope.eventType === M.EventType.EVENT_RESULT && canonicalJson(envelope.payload) === canonicalJson(result));await this.intent(context, result.eventId, envelope);}, storePhaseIntent:async(context, event, envelope)=>{requireRule(envelope.eventType === M.EventType.MATCH_PHASE_CHANGED && canonicalJson(envelope.payload) === canonicalJson({eventId:event.eventId, runId:event.runId, phase:event.phase, phaseSeq:event.phaseSeq, simulatedAt:event.simulatedAt}));await this.intent(context, event.eventId, envelope);}}};
  }

  private scope(context:M.ICallContext):void {requireRule(context.operatorId === this.bound.operatorId && context.actorId === this.bound.actorId && context.actorKind === this.bound.actorKind && context.operatorId === this.fixture.operatorId, M.ErrorCode.PERMISSION_DENIED);}

  private query(sql:string, args:readonly SqlArgument[]):Promise<readonly Record<string, unknown>[]> {return this.session.query(sql, args);}

  private async find(context:M.ICallContext, eventId:string):Promise<M.IEvent | undefined> {this.scope(context);const rows = await this.query('SELECT snapshot FROM event_match_states WHERE operator_id=$1 AND run_id=$2 AND event_id=$3 FOR UPDATE', [context.operatorId, this.fixture.runId, eventId]);

return rows[0] ? Codec.event(rows[0].snapshot) : undefined;}

  private async list(context:M.ICallContext, page:M.IPageInput, phase?:M.EventPhase):Promise<{items:M.IEvent[];nextCursor?:string}> {
    this.scope(context);const scope = canonicalJson({operatorId:context.operatorId, runId:this.fixture.runId, phase, from:page.from, to:page.to});let afterAt:string | null = null;let afterId:string | null = null;

    if (page.cursor) {try {requireRule(page.cursor.length <= 4096);const cursor = persistenceRecord(JSON.parse(Buffer.from(page.cursor, 'base64url').toString('utf8')));

requireRule(cursor.version === 1 && cursor.scope === scope && validInstant(cursor.at) && validUuid(cursor.id));afterAt = Codec.text(cursor.at);afterId = Codec.text(cursor.id);} catch {throw new EventsError(M.ErrorCode.INVALID_INPUT);}}

    const rows = await this.query('SELECT snapshot FROM event_match_states WHERE operator_id=$1 AND run_id=$2 AND ($3::text IS NULL OR phase=$3) AND ($4::timestamptz IS NULL OR (snapshot->>\'startsAt\')::timestamptz >=$4) AND ($5::timestamptz IS NULL OR (snapshot->>\'startsAt\')::timestamptz <=$5) AND ($6::timestamptz IS NULL OR ((snapshot->>\'startsAt\')::timestamptz,event_id)>($6::timestamptz,$7::uuid)) ORDER BY (snapshot->>\'startsAt\')::timestamptz,event_id LIMIT $8', [context.operatorId, this.fixture.runId, phase ?? null, page.from ?? null, page.to ?? null, afterAt, afterId, page.limit + 1]);
    const events = rows.map(row=>Codec.event(row.snapshot));const items = events.slice(0, page.limit);const last = items.at(-1);

    return {items, ...(events.length > page.limit && last ? {nextCursor:Buffer.from(JSON.stringify({version:1, scope, at:last.startsAt, id:last.eventId})).toString('base64url')} : {})};
  }

  private async changePhase(context:M.ICallContext, eventId:string, expected:bigint, phase:M.EventPhase, at:string):Promise<M.IEvent> {
    const previous = await this.find(context, eventId);

if (!previous) throw new EventsError(M.ErrorCode.NOT_FOUND);
    requireRule(previous.phaseSeq === expected, M.ErrorCode.VERSION_CONFLICT);
    const matchClock = new PersistedMatchClock(this.session, context.operatorId, this.fixture.runId);
    const clock = await matchClock.read(context, this.fixture.runId);

    await matchClock.advance(context, this.fixture.runId, clock.phaseSeq, at);
    const result = phase === M.EventPhase.FINISHED ? await this.result(context, eventId) : undefined;

    requireRule(phase !== M.EventPhase.FINISHED || result !== undefined, M.ErrorCode.INVARIANT_VIOLATION);
    const event = {...previous, phase, phaseSeq:expected + 1n, simulatedAt:at, ...(result ? {resultRef:result.resultId} : {})};
    const rows = await this.query('UPDATE event_match_states SET phase=$4,phase_seq=$5::bigint,snapshot=$6::jsonb WHERE operator_id=$1 AND run_id=$2 AND event_id=$3 AND phase_seq=$7::bigint RETURNING event_id', [context.operatorId, this.fixture.runId, eventId, phase, event.phaseSeq.toString(), losslessJson(event), expected.toString()]);

requireRule(rows.length === 1, M.ErrorCode.VERSION_CONFLICT);

return event;
  }

  private quoteRow(row:Record<string, unknown>):M.IQuote {
    const original = seededFixtures(this.fixture, this.ids).flatMap(fixture=>fixture.quotes).find(quote=>quote.selectionId === row.selection_id);

    if (!original) throw new EventsError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    const state = Object.values(M.MarketState).find(state=>state === row.state);

requireRule(state !== undefined, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    if (!state) throw new EventsError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    const value:M.IQuote = {...original, quoteId:Codec.text(row.quote_id), quoteVersion:BigInt(Codec.text(row.quote_version)), odds:Codec.text(row.odds), state, validUntil:row.valid_until instanceof Date ? row.valid_until.toISOString() : Codec.text(row.valid_until)};

    requireRule(Output.isIQuote(value), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return value;
  }

  private async quote(context:M.ICallContext, id:string, version:bigint):Promise<M.IQuote | undefined> {this.scope(context);const rows = await this.query('SELECT *,quote_version::text,odds::text FROM event_quote_snapshots WHERE operator_id=$1 AND run_id=$2 AND quote_id=$3 AND quote_version=$4::bigint', [context.operatorId, this.fixture.runId, id, version.toString()]);

return rows[0] ? this.quoteRow(rows[0]) : undefined;}

  private async markets(context:M.ICallContext, id:string):Promise<M.IMarket[]> {
    const event = await this.find(context, id);

if (!event) throw new EventsError(M.ErrorCode.NOT_FOUND);

    const rows = await this.query('SELECT *,quote_version::text,odds::text FROM event_quote_snapshots WHERE operator_id=$1 AND run_id=$2 AND event_id=$3 AND quote_version=$4::bigint ORDER BY market_id,selection_id', [context.operatorId, this.fixture.runId, id, event.phaseSeq.toString()]);
    const quotes = rows.map(row=>this.quoteRow(row));const first = quotes[0];

requireRule(quotes.length === 3 && first !== undefined, M.ErrorCode.INVARIANT_VIOLATION);

return first ? [{marketId:first.marketId, eventId:id, type:M.MarketType.MATCH_RESULT, state:first.state, selections:quotes}] : [];
  }

  private async changeQuotes(context:M.ICallContext, id:string, phase:M.EventPhase, seq:bigint):Promise<void> {
    const event = await this.find(context, id);

if (!event) throw new EventsError(M.ErrorCode.NOT_FOUND);requireRule(event.phase === phase && event.phaseSeq === seq, M.ErrorCode.INVARIANT_VIOLATION);
    const state = phase === M.EventPhase.FINISHED ? M.MarketState.CLOSED : [M.EventPhase.LIVE, M.EventPhase.PRE_MATCH].includes(phase) ? M.MarketState.OPEN : M.MarketState.SUSPENDED;
    const rows = await this.query('SELECT *,quote_version::text,odds::text FROM event_quote_snapshots WHERE operator_id=$1 AND run_id=$2 AND event_id=$3 AND quote_version=$4::bigint', [context.operatorId, this.fixture.runId, id, (seq - 1n).toString()]);

requireRule(rows.length === 3, M.ErrorCode.INVARIANT_VIOLATION);

    for (const row of rows) {const quote = this.quoteRow(row);const quoteId = this.ids.derive(context.operatorId, quote.selectionId, 'events:quote:' + seq);

await this.query('INSERT INTO event_quote_snapshots(quote_id,operator_id,run_id,event_id,market_id,selection_id,quote_version,odds,state,valid_until) VALUES($1,$2,$3,$4,$5,$6,$7::bigint,$8::numeric,$9,$10) RETURNING quote_id', [quoteId, context.operatorId, this.fixture.runId, id, quote.marketId, quote.selectionId, seq.toString(), quote.odds, state, new Date(Date.parse(event.simulatedAt) + this.fixture.quoteValidityMs).toISOString()]);}
  }

  private async result(context:M.ICallContext, id:string):Promise<M.IEventResult | undefined> {this.scope(context);const rows = await this.query('SELECT snapshot FROM event_results WHERE operator_id=$1 AND run_id=$2 AND event_id=$3 ORDER BY result_seq DESC LIMIT 1', [context.operatorId, this.fixture.runId, id]);

return rows[0] ? Codec.result(rows[0].snapshot) : undefined;}

  private async completeResult(context:M.ICallContext, result:M.IEventResult):Promise<M.IEventResult> {
    this.scope(context);requireRule(result.runId === this.fixture.runId);const hash = createHash('sha256').update(canonicalJson(result)).digest('hex');

    await this.query('INSERT INTO event_results(result_id,operator_id,run_id,event_id,result_seq,payload_hash,snapshot,occurred_at) VALUES($1,$2,$3,$4,$5::bigint,$6,$7::jsonb,$8) ON CONFLICT(operator_id,run_id,event_id,result_seq) DO NOTHING RETURNING result_id', [result.resultId, context.operatorId, result.runId, result.eventId, result.resultSeq.toString(), hash, losslessJson(result), result.occurredAt]);const stored = await this.result(context, result.eventId);

requireRule(stored !== undefined && canonicalJson(stored) === canonicalJson(result), M.ErrorCode.IDEMPOTENCY_CONFLICT);

return result;
  }

  private async command(context:M.ICallContext, id:string):Promise<M.IStoredCommand | undefined> {
    this.scope(context);const rows = await this.query('SELECT * FROM event_commands WHERE operator_id=$1 AND request_id=$2 FOR UPDATE', [context.operatorId, id]);const row = rows[0];

if (!row) return undefined;
    requireRule(row.actor_id === context.actorId && row.actor_kind === context.actorKind && (row.player_id ?? undefined) === context.playerId, M.ErrorCode.PERMISSION_DENIED);
    const input = Codec.restore(row.semantic_input);

requireRule(Output.isRegisteredInput(input), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

if (!Output.isRegisteredInput(input)) throw new EventsError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    const state = Object.values(M.CommandState).find(state=>state === row.state);const children = Codec.restore(row.stable_child_ids);

requireRule(state !== undefined && Array.isArray(children), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

if (!state || !Array.isArray(children)) throw new EventsError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    return {requestId:id,
operation:Codec.text(row.operation),
payloadHash:Codec.text(row.payload_hash),
state,
actorId:context.actorId,
updatedAt:row.updated_at instanceof Date ? row.updated_at.toISOString() : Codec.text(row.updated_at),
semanticInput:input,
stableChildIds:children.map(value=>{const record = persistenceRecord(value);

return {purpose:Codec.text(record.purpose), id:Codec.text(record.id)};}),
...(row.response_snapshot === null ? {} : {outcome:Codec.outcome(row.response_snapshot)})};
  }

  private async claim(context:M.ICallContext, id:string, operation:string, hash:string, input:M.RegisteredInput, children:M.IStableChildId[]):Promise<M.IClaimResult> {
    this.scope(context);requireRule(['AdvanceMatchPhase', 'CompleteEvent'].includes(operation));
    const created = await this.query("INSERT INTO event_commands(event_command_id,operator_id,request_id,operation,payload_hash,actor_id,actor_kind,player_id,semantic_input,stable_child_ids,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,'IN_PROGRESS',$11,$11) ON CONFLICT(operator_id,request_id) DO NOTHING RETURNING request_id", [this.ids.derive(context.operatorId, id, 'events:command'), context.operatorId, id, operation, hash, context.actorId, context.actorKind, context.playerId ?? null, losslessJson(input), losslessJson(children), this.clock.now()]);
    const stored = await this.command(context, id);

if (!stored) throw new EventsError(M.ErrorCode.INVARIANT_VIOLATION);
    requireRule(stored.operation === operation && stored.payloadHash === hash && canonicalJson(stored.stableChildIds) === canonicalJson(children), M.ErrorCode.IDEMPOTENCY_CONFLICT);

    return {kind:created.length ? M.ClaimKind.NEW : stored.state === M.CommandState.IN_PROGRESS ? M.ClaimKind.IN_PROGRESS : M.ClaimKind.REPLAY, command:stored};
  }

  private async completeCommand(context:M.ICallContext, id:string, outcome:M.IResult<M.RegisteredOutput>):Promise<void> {this.scope(context);const rows = await this.query("UPDATE event_commands SET state=$4,response_snapshot=$5::jsonb,updated_at=$6 WHERE operator_id=$1 AND request_id=$2 AND actor_id=$3 AND state='IN_PROGRESS' RETURNING request_id", [context.operatorId, id, context.actorId, outcome.ok ? M.CommandState.COMPLETED : M.CommandState.FAILED_FINAL, losslessJson(outcome), this.clock.now()]);

requireRule(rows.length === 1, M.ErrorCode.VERSION_CONFLICT);}

  private async intent(context:M.ICallContext, id:string, envelope:M.IEventEnvelope):Promise<void> {
    this.scope(context);requireRule(Output.isIEventEnvelope(envelope) && envelope.operatorId === context.operatorId && envelope.source === M.EventSource.EVENTS && envelope.schemaVersion === 1);
    await this.query('INSERT INTO event_outbox_events(event_outbox_event_id,operator_id,message_id,event_type,subject_id,payload,occurred_at,attempt_count,next_attempt_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,0,$7) RETURNING message_id', [envelope.messageId, context.operatorId, envelope.messageId, envelope.eventType, id, losslessJson(envelope), envelope.occurredAt]);
  }
}
