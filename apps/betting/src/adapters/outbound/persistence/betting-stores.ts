import {createHash} from 'node:crypto';

import type {IQuerySession, SqlArgument} from '@sportsbook/persistence';
import {persistenceRecord} from '@sportsbook/persistence';

import {Bet} from '../../../domain/bet.js';
import {BetLeg} from '../../../domain/bet-leg.js';
import * as M from '../../../domain/betting.model.js';
import {BettingError, requireRule, validInstant, validUuid} from '../../../domain/betting.policy.js';
import * as Output from '../../../domain/betting-output.policy.js';
import {settlementCursorBet} from '../../../domain/settlement-cursor.js';
import type * as Ports from '../../../ports/outbound/betting.port.js';
import {canonicalJson, losslessJson} from '../ids/command-fingerprint.js';
import * as Codec from './betting.codec.js';

function integer(value:unknown):bigint {if (typeof value === 'bigint') return value;

const text = Codec.text(value);

requireRule(/^(0|[1-9]\d*)$/.test(text), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return BigInt(text);}

function instant(value:unknown):string {return value instanceof Date ? value.toISOString() : Codec.text(value);}

function required<T>(value:T | undefined):T {if (value === undefined) throw new BettingError(M.ErrorCode.NOT_FOUND);

return value;}

export class BetSqlStores {
  readonly ports:Ports.IBetTransactionPorts;

  constructor(private readonly session:IQuerySession, private readonly bound:M.ICallContext, private readonly ids:Ports.IdGeneratorPort, private readonly clock:Ports.ClockPort) {
    this.ports = {bets:{find:(...a)=>this.find(...a), createPending:(...a)=>this.createPending(...a), transition:(...a)=>this.transition(...a), listPending:(...a)=>this.listPending(...a), listByEvent:(...a)=>this.listByEvent(...a)}, legs:{insert:(...a)=>this.insertLegs(...a), list:(...a)=>this.legs(...a), resolve:(...a)=>this.resolveLeg(...a)}, settlements:{find:(...a)=>this.findSettlement(...a), create:(...a)=>this.createSettlement(...a), markApplied:(...a)=>this.markApplied(...a), listPending:(...a)=>this.pendingSettlements(...a), recordEventResult:(...a)=>this.recordResult(...a), findEventResult:(...a)=>this.findResult(...a)}, commands:{find:(...a)=>this.command(...a), findForBet:(...a)=>this.findForBet(...a), claim:(...a)=>this.claim(...a), complete:(...a)=>this.completeCommand(...a)}, inbox:{claim:(...a)=>this.claimInbox(...a), markProcessed:(...a)=>this.markProcessed(...a)}, outbox:{append:(...a)=>this.appendEvent(...a)}, history:{append:(...a)=>this.history(...a)}, sweeps:{create:(...a)=>this.createSweep(...a), findDue:(...a)=>this.dueSweeps(...a), checkpoint:(...a)=>this.checkpoint(...a)}};
  }

  private scope(context:M.ICallContext):void {requireRule(context.operatorId === this.bound.operatorId && context.actorId === this.bound.actorId && context.actorKind === this.bound.actorKind && context.playerId === this.bound.playerId, M.ErrorCode.PERMISSION_DENIED);}

  private query(sql:string, args:readonly SqlArgument[]):Promise<readonly Record<string, unknown>[]> {return this.session.query(sql, args);}

  private async row(context:M.ICallContext, id:string):Promise<Record<string, unknown> | undefined> {this.scope(context);const rows = await this.query('SELECT *,stake_minor::text,potential_payout_minor::text,actual_payout_minor::text,version::text FROM bets WHERE operator_id=$1 AND bet_id=$2 AND ($3::uuid IS NULL OR player_id=$3) FOR UPDATE', [context.operatorId, id, context.playerId ?? null]);

return rows[0];}

  private async view(context:M.ICallContext, row:Record<string, unknown>):Promise<M.IBetView> {
    const value:M.IBetView = {betId:Codec.text(row.bet_id), playerId:Codec.text(row.player_id), type:M.BetType.SINGLE, status:enumValue(row.status, Object.values(M.BetStatus)), stake:{amountMinor:integer(row.stake_minor), currency:Codec.text(row.currency).trim()}, potentialPayoutMinor:integer(row.potential_payout_minor), version:integer(row.version), createdAt:instant(row.created_at), legs:await this.legs(context, Codec.text(row.bet_id)), ...(row.actual_payout_minor === null ? {} : {actualPayoutMinor:integer(row.actual_payout_minor)}), ...(row.accepted_at === null ? {} : {acceptedAt:instant(row.accepted_at)}), ...(row.settled_at === null ? {} : {settledAt:instant(row.settled_at)}), ...(row.rejection_code === null ? {} : {reasonCode:enumValue(row.rejection_code, Object.values(M.ErrorCode))})};

    requireRule(row.bet_type === M.BetType.SINGLE, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);const loaded = Bet.rehydrate(value);

if (!loaded.ok) throw new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return loaded.value.toSnapshot();
  }

  private async find(context:M.ICallContext, id:string):Promise<M.IBetView | undefined> {const row = await this.row(context, id);

return row ? this.view(context, row) : undefined;}

  private async createPending(context:M.ICallContext, bet:M.IBetView, reservationCommandId:string):Promise<M.IBetView> {
    this.scope(context);requireRule(bet.status === M.BetStatus.PENDING_RESERVATION && bet.version === 1n && Bet.rehydrate(bet).ok && validUuid(reservationCommandId));
    const commands = await this.query("SELECT request_id FROM bet_commands WHERE operator_id=$1 AND bet_id=$2 AND operation='PlaceBet' AND actor_id=$3 AND state='IN_PROGRESS'", [context.operatorId, bet.betId, context.actorId]);const command = required(commands[0]);

    await this.query('INSERT INTO bets(bet_id,operator_id,player_id,client_request_id,bet_type,status,stake_minor,currency,potential_payout_minor,source_channel,version,created_at,updated_at,reservation_command_id,workflow_lease_until) VALUES($1,$2,$3,$4,$5,$6,$7::bigint,$8,0,$9,1,$10,$10,$11,$12) RETURNING bet_id', [bet.betId, context.operatorId, bet.playerId, Codec.text(command.request_id), bet.type, bet.status, bet.stake.amountMinor.toString(), bet.stake.currency, context.actorKind, bet.createdAt, reservationCommandId, context.deadlineAt]);
    await this.writeLeg(context, bet.betId, required(bet.legs[0]));

return bet;
  }

  private async transition(context:M.ICallContext, id:string, version:bigint, next:M.IBetView):Promise<M.IBetView> {
    const previous = required(await this.find(context, id));

requireRule(previous.version === version && next.version === version + 1n, M.ErrorCode.VERSION_CONFLICT);
    requireRule(next.betId === id && next.playerId === previous.playerId && next.type === previous.type && next.createdAt === previous.createdAt && canonicalJson(next.stake) === canonicalJson(previous.stake) && Bet.rehydrate(next).ok, M.ErrorCode.INVARIANT_VIOLATION);
    const edges:Record<M.BetStatus, readonly M.BetStatus[]> = {PENDING_RESERVATION:[M.BetStatus.PENDING_RESERVATION, M.BetStatus.ACCEPTED, M.BetStatus.REJECTED], ACCEPTED:[M.BetStatus.SETTLEMENT_PENDING, M.BetStatus.CANCELED], SETTLEMENT_PENDING:[M.BetStatus.WON, M.BetStatus.LOST, M.BetStatus.VOID], REJECTED:[], WON:[], LOST:[], VOID:[], CANCELED:[]};

requireRule(edges[previous.status].includes(next.status), M.ErrorCode.INVALID_STATE);
    const quote = next.legs[0]?.quote;const rows = await this.query('UPDATE bets SET status=$4,combined_odds=$5::numeric,potential_payout_minor=$6::bigint,actual_payout_minor=$7::bigint,rejection_code=$8,version=$9::bigint,accepted_at=$10,settled_at=$11,updated_at=$12,workflow_lease_until=CASE WHEN $4=\'PENDING_RESERVATION\' THEN workflow_lease_until ELSE NULL END WHERE operator_id=$1 AND bet_id=$2 AND version=$3::bigint RETURNING bet_id', [context.operatorId, id, version.toString(), next.status, quote?.odds ?? null, next.potentialPayoutMinor.toString(), next.actualPayoutMinor?.toString() ?? null, next.reasonCode ?? null, next.version.toString(), next.acceptedAt ?? null, next.settledAt ?? null, this.clock.now()]);

requireRule(rows.length === 1, M.ErrorCode.VERSION_CONFLICT);
    await this.writeLeg(context, id, required(next.legs[0]));

return next;
  }

  private async legs(context:M.ICallContext, id:string):Promise<M.IBetLeg[]> {this.scope(context);const rows = await this.query('SELECT l.selection_snapshot FROM bet_legs l JOIN bets b ON b.operator_id=l.operator_id AND b.bet_id=l.bet_id WHERE l.operator_id=$1 AND l.bet_id=$2 AND ($3::uuid IS NULL OR b.player_id=$3) ORDER BY l.leg_no', [context.operatorId, id, context.playerId ?? null]);

return rows.map(row=>{const leg = Codec.restore(row.selection_snapshot);

requireRule(Output.isIBetLeg(leg), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

if (!Output.isIBetLeg(leg)) throw new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return leg;});}

  private async writeLeg(context:M.ICallContext, id:string, leg:M.IBetLeg):Promise<void> {
    this.scope(context);requireRule(leg.legNo === 1 && Output.isIBetLeg(leg));const previous = (await this.legs(context, id))[0];

    if (previous) {requireRule(previous.legId === leg.legId && previous.eventId === leg.eventId && previous.marketId === leg.marketId && previous.selectionId === leg.selectionId, M.ErrorCode.INVARIANT_VIOLATION);

if (previous.quote)requireRule(canonicalJson(previous.quote) === canonicalJson(leg.quote), M.ErrorCode.IDEMPOTENCY_CONFLICT);if (previous.resultRef)requireRule(previous.resultRef === leg.resultRef && previous.state === leg.state, M.ErrorCode.INVALID_STATE);}
    await this.query('INSERT INTO bet_legs(bet_leg_id,operator_id,bet_id,leg_no,event_id,market_id,selection_id,quote_id,quote_version,accepted_odds,selection_snapshot,status,result_ref,resolved_at,created_at) VALUES($1,$2,$3,1,$4,$5,$6,$7,$8::bigint,$9::numeric,$10::jsonb,$11,$12,$13,$14) ON CONFLICT(operator_id,bet_id,leg_no) DO UPDATE SET quote_id=EXCLUDED.quote_id,quote_version=EXCLUDED.quote_version,accepted_odds=EXCLUDED.accepted_odds,selection_snapshot=EXCLUDED.selection_snapshot,status=EXCLUDED.status,result_ref=EXCLUDED.result_ref,resolved_at=EXCLUDED.resolved_at RETURNING bet_leg_id', [leg.legId, context.operatorId, id, leg.eventId, leg.marketId, leg.selectionId, leg.quote?.quoteId ?? null, leg.quote?.quoteVersion.toString() ?? null, leg.quote?.odds ?? null, losslessJson(leg), leg.state, leg.resultRef ?? null, leg.resultRef ? this.clock.now() : null, this.clock.now()]);
  }

  private async insertLegs(context:M.ICallContext, id:string, legs:M.IBetLeg[]):Promise<void> {const bet = required(await this.find(context, id));

requireRule(bet.status === M.BetStatus.PENDING_RESERVATION && legs.length === 1 && legs[0]?.quote !== undefined, M.ErrorCode.INVALID_STATE);await this.writeLeg(context, id, required(legs[0]));}

  private async resolveLeg(context:M.ICallContext, id:string, legId:string, result:M.IEventResult):Promise<M.IBetLeg> {const bet = required(await this.find(context, id));const leg = required(bet.legs.find(value=>value.legId === legId));const loaded = BetLeg.rehydrate(leg);

if (!loaded.ok) throw new BettingError(loaded.error.code);

const resolved = loaded.value.resolve(result);

if (!resolved.ok) throw new BettingError(resolved.error.code);await this.writeLeg(context, id, resolved.value);

return resolved.value;}

  private async listPending(context:M.ICallContext, kind:M.RecoveryKind, before:string, page:M.IPageInput):Promise<M.IBetView[]> {
    this.scope(context);requireRule(context.actorKind === M.ActorKind.SYSTEM && context.capabilities.includes(M.Capability.RECOVER_BETS), M.ErrorCode.PERMISSION_DENIED);
    const rows = await this.query("SELECT b.*,b.stake_minor::text,b.potential_payout_minor::text,b.actual_payout_minor::text,b.version::text FROM bets b WHERE b.operator_id=$1 AND (b.workflow_lease_until IS NULL OR b.workflow_lease_until<=$2::timestamptz) AND (($3='RESERVATION' AND b.status='PENDING_RESERVATION' AND b.updated_at<=$4::timestamptz) OR ($3='CANCELLATION' AND b.status='ACCEPTED' AND EXISTS(SELECT 1 FROM bet_commands c WHERE c.operator_id=b.operator_id AND c.bet_id=b.bet_id AND c.operation='CancelBet' AND c.state='IN_PROGRESS' AND c.created_at<=$4::timestamptz))) ORDER BY b.created_at,b.bet_id FOR UPDATE OF b SKIP LOCKED LIMIT $5", [context.operatorId, this.clock.now(), kind, before, page.limit]);const result:M.IBetView[] = [];

    for (const row of rows) {await this.query('UPDATE bets SET workflow_lease_until=$3 WHERE operator_id=$1 AND bet_id=$2 RETURNING bet_id', [context.operatorId, Codec.text(row.bet_id), context.deadlineAt]);result.push(await this.view(context, row));}

 return result;
  }

  private async listByEvent(context:M.ICallContext, eventId:string, page:M.IPageInput):Promise<M.IBetView[]> {this.scope(context);const after = page.cursor ? settlementCursorBet(page.cursor, context.operatorId, eventId) : null;
    const rows = await this.query("SELECT b.*,b.stake_minor::text,b.potential_payout_minor::text,b.actual_payout_minor::text,b.version::text FROM bets b WHERE b.operator_id=$1 AND b.status='ACCEPTED' AND ($3::uuid IS NULL OR b.bet_id>$3) AND EXISTS(SELECT 1 FROM bet_legs l WHERE l.operator_id=b.operator_id AND l.bet_id=b.bet_id AND l.event_id=$2) ORDER BY b.bet_id FOR UPDATE OF b LIMIT $4", [context.operatorId, eventId, after, page.limit]);const items:M.IBetView[] = [];

for (const row of rows)items.push(await this.view(context, row));

return items;}

  private settlementRow(row:Record<string, unknown>):M.ISettlementIntent {return {intentId:Codec.text(row.bet_settlement_id), betId:Codec.text(row.bet_id), resultId:Codec.text(row.result_ref), settlementSeq:integer(row.settlement_seq), decision:enumValue(row.decision, Object.values(M.SettlementDecision)), payout:{amountMinor:integer(row.payout_minor), currency:Codec.text(row.currency).trim()}, ledgerCommandId:Codec.text(row.ledger_command_id), state:enumValue(row.status, Object.values(M.SettlementState)), createdAt:instant(row.created_at)};}

  private async findSettlement(context:M.ICallContext, id:string, seq:bigint):Promise<M.ISettlementIntent | undefined> {this.scope(context);const rows = await this.query('SELECT s.*,s.settlement_seq::text,s.payout_minor::text,b.currency FROM bet_settlements s JOIN bets b ON b.operator_id=s.operator_id AND b.bet_id=s.bet_id WHERE s.operator_id=$1 AND s.bet_id=$2 AND s.settlement_seq=$3::bigint AND ($4::uuid IS NULL OR b.player_id=$4) FOR UPDATE OF s', [context.operatorId, id, seq.toString(), context.playerId ?? null]);

return rows[0] ? this.settlementRow(rows[0]) : undefined;}

  private async createSettlement(context:M.ICallContext, intent:M.ISettlementIntent):Promise<M.ISettlementIntent> {
    const bet = required(await this.find(context, intent.betId));

requireRule([M.BetStatus.ACCEPTED, M.BetStatus.SETTLEMENT_PENDING].includes(bet.status) && intent.settlementSeq === 1n && Output.isISettlementIntent(intent), M.ErrorCode.INVALID_STATE);
    const cancellations = await this.query("SELECT request_id FROM bet_commands WHERE operator_id=$1 AND bet_id=$2 AND operation='CancelBet' AND state='IN_PROGRESS'", [context.operatorId, bet.betId]);

requireRule(cancellations.length === 0, M.ErrorCode.INVALID_STATE);
    const prior = await this.findSettlement(context, bet.betId, intent.settlementSeq);

if (prior) {requireRule(canonicalJson({...prior, state:M.SettlementState.PENDING}) === canonicalJson(intent), M.ErrorCode.IDEMPOTENCY_CONFLICT);

return prior;}
    await this.query("INSERT INTO bet_settlements(bet_settlement_id,operator_id,bet_id,result_ref,settlement_seq,decision,payout_minor,ledger_command_id,status,attempt_count,created_at,lease_until) VALUES($1,$2,$3,$4,$5::bigint,$6,$7::bigint,$8,'PENDING',0,$9,$10) RETURNING bet_settlement_id", [intent.intentId, context.operatorId, intent.betId, intent.resultId, intent.settlementSeq.toString(), intent.decision, intent.payout.amountMinor.toString(), intent.ledgerCommandId, intent.createdAt, null]);

return intent;
  }

  private async markApplied(context:M.ICallContext, id:string, financial:M.IReservationView):Promise<void> {this.scope(context);const rows = await this.query('SELECT s.*,s.settlement_seq::text,s.payout_minor::text,b.currency,b.stake_minor::text FROM bet_settlements s JOIN bets b ON b.operator_id=s.operator_id AND b.bet_id=s.bet_id WHERE s.operator_id=$1 AND s.bet_settlement_id=$2 FOR UPDATE OF s', [context.operatorId, id]);const row = required(rows[0]);const intent = this.settlementRow(row);const expected = intent.decision === M.SettlementDecision.WIN ? M.ReservationState.WON : intent.decision === M.SettlementDecision.LOSS ? M.ReservationState.LOST : M.ReservationState.CANCELED;

    requireRule(Output.isIReservationView(financial) && financial.betId === intent.betId && financial.state === expected && financial.stake.currency === intent.payout.currency && financial.stake.amountMinor === integer(row.stake_minor) && financial.grossPayoutMinor === intent.payout.amountMinor && financial.settlementTransactionId !== undefined && (expected === M.ReservationState.CANCELED || financial.settlementSeq === intent.settlementSeq), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
    await this.query("UPDATE bet_settlements SET status='APPLIED',applied_at=$3,attempt_count=attempt_count+1,lease_until=NULL WHERE operator_id=$1 AND bet_settlement_id=$2 RETURNING bet_settlement_id", [context.operatorId, id, this.clock.now()]);
  }

  private async pendingSettlements(context:M.ICallContext, before:string, page:M.IPageInput):Promise<M.ISettlementIntent[]> {this.scope(context);const rows = await this.query("SELECT s.*,s.settlement_seq::text,s.payout_minor::text,b.currency FROM bet_settlements s JOIN bets b ON b.operator_id=s.operator_id AND b.bet_id=s.bet_id WHERE s.operator_id=$1 AND s.status='PENDING' AND s.created_at<=$2::timestamptz AND (s.lease_until IS NULL OR s.lease_until<=$3::timestamptz) ORDER BY s.created_at,s.bet_settlement_id FOR UPDATE OF s SKIP LOCKED LIMIT $4", [context.operatorId, before, this.clock.now(), page.limit]);

for (const row of rows) await this.query('UPDATE bet_settlements SET lease_until=$3 WHERE operator_id=$1 AND bet_settlement_id=$2 RETURNING bet_settlement_id', [context.operatorId, Codec.text(row.bet_settlement_id), context.deadlineAt]);

return rows.map(row=>this.settlementRow(row));}

  private async recordResult(context:M.ICallContext, result:M.IEventResult):Promise<void> {this.scope(context);requireRule(Output.isIEventResult(result) && result.resultSeq === 1n);const hash = createHash('sha256').update(canonicalJson(result)).digest('hex');

await this.query('INSERT INTO bet_event_results(bet_event_result_id,operator_id,event_id,result_id,result_seq,payload_hash,snapshot,occurred_at) VALUES($1,$2,$3,$1,$4::bigint,$5,$6::jsonb,$7) ON CONFLICT(operator_id,event_id,result_seq) DO NOTHING RETURNING result_id', [result.resultId, context.operatorId, result.eventId, result.resultSeq.toString(), hash, losslessJson(result), result.occurredAt]);const rows = await this.query('SELECT result_id,payload_hash FROM bet_event_results WHERE operator_id=$1 AND event_id=$2 AND result_seq=$3::bigint', [context.operatorId, result.eventId, result.resultSeq.toString()]);

requireRule(rows[0]?.result_id === result.resultId && rows[0]?.payload_hash === hash, M.ErrorCode.IDEMPOTENCY_CONFLICT);}

  private async findResult(context:M.ICallContext, id:string):Promise<M.IEventResult | undefined> {this.scope(context);const rows = await this.query('SELECT snapshot FROM bet_event_results WHERE operator_id=$1 AND result_id=$2', [context.operatorId, id]);

return rows[0] ? Codec.result(rows[0].snapshot) : undefined;}

  private stored(row:Record<string, unknown>):M.IStoredCommand {const input = Codec.restore(row.semantic_input);const children = Codec.restore(row.stable_child_ids);

requireRule(Output.isRegisteredInput(input) && Array.isArray(children), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

if (!Output.isRegisteredInput(input) || !Array.isArray(children)) throw new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return {requestId:Codec.text(row.request_id),
operation:Codec.text(row.operation),
payloadHash:Codec.text(row.payload_hash),
state:enumValue(row.state, Object.values(M.CommandState)),
actorId:Codec.text(row.actor_id),
updatedAt:instant(row.updated_at),
semanticInput:input,
stableChildIds:children.map(item=>{const value = persistenceRecord(item);

return {purpose:Codec.text(value.purpose), id:Codec.text(value.id)};}),
...(row.response_snapshot === null ? {} : {outcome:Codec.outcome(row.response_snapshot)})};}

  private async command(context:M.ICallContext, id:string):Promise<M.IStoredCommand | undefined> {this.scope(context);const rows = await this.query('SELECT * FROM bet_commands WHERE operator_id=$1 AND request_id=$2 FOR UPDATE', [context.operatorId, id]);const row = rows[0];

if (!row) return undefined;requireRule(row.actor_id === context.actorId && row.actor_kind === context.actorKind && (row.player_id ?? undefined) === context.playerId, M.ErrorCode.PERMISSION_DENIED);

return this.stored(row);}

  private async findForBet(context:M.ICallContext, id:string, operation:M.BetCommandOperation):Promise<M.IStoredCommand | undefined> {this.scope(context);requireRule(context.actorKind === M.ActorKind.SYSTEM && context.capabilities.includes(M.Capability.RECOVER_BETS) && Object.values(M.BetCommandOperation).includes(operation), M.ErrorCode.PERMISSION_DENIED);const rows = await this.query('SELECT * FROM bet_commands WHERE operator_id=$1 AND bet_id=$2 AND operation=$3 ORDER BY created_at DESC,bet_command_id DESC LIMIT 1', [context.operatorId, id, operation]);

return rows[0] ? this.stored(rows[0]) : undefined;}

  private async claim(context:M.ICallContext, id:string, operation:string, hash:string, input:M.RegisteredInput, children:M.IStableChildId[]):Promise<M.IClaimResult> {
    this.scope(context);requireRule(['PlaceBet', 'CancelBet'].includes(operation) && Output.isRegisteredInput(input) && 'requestId' in input && input.requestId === id);const betId = operation === 'PlaceBet' ? required(children.find(child=>child.purpose === 'betting:bet')).id : 'betId' in input ? input.betId : undefined;

requireRule(validUuid(betId));
    const old = await this.command(context, id);

if (old) {requireRule(old.operation === operation && old.payloadHash === hash && canonicalJson(old.stableChildIds) === canonicalJson(children), M.ErrorCode.IDEMPOTENCY_CONFLICT);

return {kind:old.state === M.CommandState.IN_PROGRESS ? M.ClaimKind.IN_PROGRESS : M.ClaimKind.REPLAY, command:old};}

    const rows = await this.query("INSERT INTO bet_commands(bet_command_id,operator_id,request_id,operation,payload_hash,actor_id,actor_kind,player_id,semantic_input,stable_child_ids,state,created_at,updated_at,bet_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,'IN_PROGRESS',$11,$11,$12) ON CONFLICT(operator_id,request_id) DO NOTHING RETURNING request_id", [this.ids.derive(context.operatorId, id, 'betting:command'), context.operatorId, id, operation, hash, context.actorId, context.actorKind, context.playerId ?? null, losslessJson(input), losslessJson(children), this.clock.now(), Codec.text(betId)]);const stored = required(await this.command(context, id));

requireRule(stored.operation === operation && stored.payloadHash === hash && canonicalJson(stored.stableChildIds) === canonicalJson(children), M.ErrorCode.IDEMPOTENCY_CONFLICT);

    if (rows.length && operation === 'CancelBet') await this.query('UPDATE bets SET workflow_lease_until=$3 WHERE operator_id=$1 AND bet_id=$2 RETURNING bet_id', [context.operatorId, Codec.text(betId), context.deadlineAt]);

return {kind:rows.length ? M.ClaimKind.NEW : stored.state === M.CommandState.IN_PROGRESS ? M.ClaimKind.IN_PROGRESS : M.ClaimKind.REPLAY, command:stored};
  }

  private async completeCommand(context:M.ICallContext, id:string, outcome:M.IResult<M.RegisteredOutput>):Promise<void> {this.scope(context);const rows = await this.query("UPDATE bet_commands SET state=$4,response_snapshot=$5::jsonb,updated_at=$6 WHERE operator_id=$1 AND request_id=$2 AND actor_id=$3 AND state='IN_PROGRESS' RETURNING bet_id", [context.operatorId, id, context.actorId, outcome.ok ? M.CommandState.COMPLETED : M.CommandState.FAILED_FINAL, losslessJson(outcome), this.clock.now()]);

requireRule(rows.length === 1, M.ErrorCode.VERSION_CONFLICT);}

  private async appendEvent(context:M.ICallContext, event:M.IEventEnvelope):Promise<void> {this.scope(context);requireRule(Output.isIEventEnvelope(event) && event.operatorId === context.operatorId && event.source === M.EventSource.BETTING && event.eventType === M.EventType.BET_STATE_CHANGED && Output.isIBetStateChangedEvent(event.payload));const payload = event.payload;

if (!Output.isIBetStateChangedEvent(payload)) throw new BettingError(M.ErrorCode.INVALID_INPUT);await this.query('INSERT INTO bet_outbox_events(bet_outbox_event_id,operator_id,message_id,event_type,subject_id,payload,occurred_at,attempt_count,next_attempt_at) VALUES($1,$2,$1,$3,$4,$5::jsonb,$6,0,$6) RETURNING message_id', [event.messageId, context.operatorId, event.eventType, payload.betId, losslessJson(event), event.occurredAt]);}

  private async claimInbox(context:M.ICallContext, envelope:M.IEventEnvelope, hash:string):Promise<{isNew:boolean}> {this.scope(context);const rows = await this.query("INSERT INTO bet_inbox_events(bet_inbox_event_id,operator_id,source,message_id,payload_hash,received_at,status) VALUES($1,$2,$3,$4,$5,$6,'PROCESSING') ON CONFLICT(operator_id,source,message_id) DO NOTHING RETURNING message_id", [this.ids.derive(context.operatorId, envelope.messageId, 'betting:inbox'), context.operatorId, envelope.source, envelope.messageId, hash, this.clock.now()]);const prior = await this.query('SELECT payload_hash FROM bet_inbox_events WHERE operator_id=$1 AND source=$2 AND message_id=$3 FOR UPDATE', [context.operatorId, envelope.source, envelope.messageId]);

requireRule(prior[0]?.payload_hash === hash, M.ErrorCode.IDEMPOTENCY_CONFLICT);

return {isNew:rows.length === 1};}

  private async markProcessed(context:M.ICallContext, id:string):Promise<void> {this.scope(context);const rows = await this.query("UPDATE bet_inbox_events SET status='PROCESSED',processed_at=$3 WHERE operator_id=$1 AND message_id=$2 RETURNING message_id", [context.operatorId, id, this.clock.now()]);

requireRule(rows.length === 1, M.ErrorCode.VERSION_CONFLICT);}

  private async history(context:M.ICallContext, id:string, from:M.BetStatus, to:M.BetStatus, reason:string | undefined, at:string):Promise<void> {const bet = required(await this.find(context, id));

requireRule(bet.status === to);await this.query('INSERT INTO bet_state_changes(bet_state_change_id,operator_id,bet_id,from_status,to_status,reason_code,actor_type,actor_id,correlation_id,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING bet_state_change_id', [this.ids.derive(context.operatorId, id, 'betting:history:' + bet.version), context.operatorId, id, from, to, reason ?? null, context.actorKind, context.actorId, context.correlationId, at]);}

  private async createSweep(context:M.ICallContext, sweep:M.ISettlementSweep):Promise<void> {this.scope(context);requireRule(Output.isISettlementSweep(sweep) && sweep.version === 1n && sweep.state === M.SweepState.PENDING);await this.query("INSERT INTO bet_settlement_sweeps(bet_settlement_sweep_id,operator_id,event_id,result_id,state,version,created_at,updated_at) VALUES($1,$2,$3,$4,'PENDING',1,$5,$5) ON CONFLICT(operator_id,result_id) DO NOTHING RETURNING bet_settlement_sweep_id", [sweep.sweepId, context.operatorId, sweep.eventId, sweep.resultId, this.clock.now()]);}

  private async dueSweeps(context:M.ICallContext, page:M.IPageInput):Promise<M.ISettlementSweep[]> {this.scope(context);const rows = await this.query("SELECT *,version::text FROM bet_settlement_sweeps WHERE operator_id=$1 AND state='PENDING' AND (lease_until IS NULL OR lease_until<=$2::timestamptz) ORDER BY created_at,bet_settlement_sweep_id FOR UPDATE SKIP LOCKED LIMIT $3", [context.operatorId, this.clock.now(), page.limit]);

return rows.map(row=>({sweepId:Codec.text(row.bet_settlement_sweep_id), eventId:Codec.text(row.event_id), resultId:Codec.text(row.result_id), state:M.SweepState.PENDING, version:integer(row.version), ...(row.cursor === null ? {} : {cursor:Codec.text(row.cursor)})}));}

  private async checkpoint(context:M.ICallContext, id:string, version:bigint, cursor:string | undefined, complete:boolean):Promise<void> {this.scope(context);const rows = await this.query('UPDATE bet_settlement_sweeps SET cursor=$4,state=$5,version=version+1,lease_until=NULL,updated_at=$6 WHERE operator_id=$1 AND bet_settlement_sweep_id=$2 AND version=$3::bigint AND state=\'PENDING\' AND (lease_until IS NULL OR lease_until<=$6::timestamptz) RETURNING bet_settlement_sweep_id', [context.operatorId, id, version.toString(), cursor ?? null, complete ? M.SweepState.COMPLETE : M.SweepState.PENDING, this.clock.now()]);

requireRule(rows.length === 1, M.ErrorCode.VERSION_CONFLICT);}

  async get(context:M.ICallContext, id:string, playerId:string):Promise<M.IBettingGetBetOutput> {const bet = required(await this.find(context, id));

requireRule(bet.playerId === playerId, M.ErrorCode.NOT_FOUND);

return {bet};}

  async status(context:M.ICallContext, playerId:string, id:string):Promise<M.IBettingGetBetStatusOutput> {const {bet} = await this.get(context, id, playerId);

return {betId:id, status:bet.status, financialState:financialState(bet.status), version:bet.version, observedAt:this.clock.now()};}

  async list(context:M.ICallContext, playerId:string, page:M.IPageInput, status?:M.BetStatus):Promise<M.IBettingListPlayerBetsOutput> {const found = await this.page(context, page, playerId, status);

return {bets:found.items, ...(found.nextCursor ? {nextCursor:found.nextCursor} : {}), observedAt:this.clock.now()};}

  async auditCandidates(context:M.ICallContext, cutoff:string, page:M.IPageInput):Promise<{items:M.IBetView[];nextCursor?:string}> {
    this.scope(context);
    const orphans = await this.query(`SELECT 1 FROM bet_legs l WHERE l.operator_id=$1 AND l.created_at<=$2 AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.operator_id=l.operator_id AND b.bet_id=l.bet_id)
      UNION ALL SELECT 1 FROM bet_settlements s WHERE s.operator_id=$1 AND s.created_at<=$2 AND (NOT EXISTS (SELECT 1 FROM bets b WHERE b.operator_id=s.operator_id AND b.bet_id=s.bet_id) OR NOT EXISTS (SELECT 1 FROM bet_event_results r WHERE r.operator_id=s.operator_id AND r.result_id=s.result_ref)) LIMIT 1`, [context.operatorId, cutoff]);

    requireRule(orphans.length === 0, M.ErrorCode.INVARIANT_VIOLATION);

    return this.page(context, {...page, to:cutoff});
  }

  private async page(context:M.ICallContext, page:M.IPageInput, playerId?:string, status?:M.BetStatus):Promise<{items:M.IBetView[];nextCursor?:string}> {this.scope(context);const scope = canonicalJson({operatorId:context.operatorId, playerId, status, from:page.from, to:page.to});const cursor = page.cursor ? decodeCursor(page.cursor, scope) : undefined;const cutoff = cursor?.cutoff ?? this.clock.now();const rows = await this.query('SELECT *,stake_minor::text,potential_payout_minor::text,actual_payout_minor::text,version::text FROM bets WHERE operator_id=$1 AND ($2::uuid IS NULL OR player_id=$2) AND ($3::text IS NULL OR status=$3) AND created_at<=$4::timestamptz AND ($5::timestamptz IS NULL OR created_at>=$5) AND ($6::timestamptz IS NULL OR created_at<=$6) AND ($7::timestamptz IS NULL OR (created_at,bet_id)<($7::timestamptz,$8::uuid)) ORDER BY created_at DESC,bet_id DESC LIMIT $9', [context.operatorId, playerId ?? null, status ?? null, cutoff, page.from ?? null, page.to ?? null, cursor?.at ?? null, cursor?.id ?? null, page.limit + 1]);const views:M.IBetView[] = [];

for (const row of rows.slice(0, page.limit))views.push(await this.view(context, row));const last = views.at(-1);

return {items:views, ...(rows.length > page.limit && last ? {nextCursor:encodeCursor({version:1, scope, at:last.createdAt, id:last.betId, cutoff})} : {})};}

  async audit(context:M.ICallContext, report:M.IReconciliationReport):Promise<void> {this.scope(context);await this.query('INSERT INTO bet_audit_runs(bet_audit_run_id,operator_id,snapshot,created_at) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(bet_audit_run_id) DO NOTHING RETURNING bet_audit_run_id', [report.runId, context.operatorId, losslessJson(report), this.clock.now()]);const rows = await this.query('SELECT snapshot FROM bet_audit_runs WHERE operator_id=$1 AND bet_audit_run_id=$2', [context.operatorId, report.runId]);

requireRule(rows[0] !== undefined && canonicalJson(Codec.restore(rows[0]?.snapshot)) === canonicalJson(report), M.ErrorCode.IDEMPOTENCY_CONFLICT);}
}

function enumValue<T extends string>(value:unknown, choices:readonly T[]):T {const selected = choices.find(choice=>choice === value);

if (selected === undefined) throw new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return selected;}

export function financialState(status:M.BetStatus):M.FinancialState {return [M.BetStatus.ACCEPTED, M.BetStatus.SETTLEMENT_PENDING].includes(status) ? M.FinancialState.RESERVED : [M.BetStatus.WON, M.BetStatus.LOST].includes(status) ? M.FinancialState.SETTLED : [M.BetStatus.VOID, M.BetStatus.CANCELED].includes(status) ? M.FinancialState.REFUNDED : M.FinancialState.UNCONFIRMED;}

interface ICursor {version:number;scope:string;at:string;id:string;cutoff:string;}

export function encodeCursor(cursor:ICursor):string {return Buffer.from(JSON.stringify(cursor)).toString('base64url');}

function decodeCursor(value:string, scope:string):ICursor {try {requireRule(value.length <= 4096);const cursor = persistenceRecord(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));

requireRule(cursor.version === 1 && cursor.scope === scope && validInstant(cursor.at) && validUuid(cursor.id) && validInstant(cursor.cutoff));

return {version:1, scope, at:Codec.text(cursor.at), id:Codec.text(cursor.id), cutoff:Codec.text(cursor.cutoff)};} catch {throw new BettingError(M.ErrorCode.INVALID_INPUT);}}
