import assert from 'node:assert/strict';

import type {PersistenceBackend} from '@sportsbook/persistence';
import type {Pool} from 'pg';

import {canonicalJson, losslessJson} from '../src/adapters/outbound/ids/command-fingerprint.js';
import * as M from '../src/domain/betting.model.js';
import {BettingError} from '../src/domain/betting.policy.js';
import type {IBettingApplicationSettings, IBettingClients} from '../src/infra/betting-application.factory.js';
import {createBettingApplication} from '../src/infra/betting-application.factory.js';

export async function verifyBettingPersistence(owner:Pool, connectionString:string, backend:PersistenceBackend):Promise<void> {
  let sequence = 1000;const next = ():string=>'00000000-0000-4000-8000-' + String(sequence++).padStart(12, '0');let time = Date.parse('2026-10-15T12:00:00Z');const clock = {now:()=>new Date(time).toISOString()};const operatorId = next();const otherOperator = next();const gatewayActor = next();const eventsActor = next();const systemActor = next();const playerId = next();const walletId = next();let eventId = next();const runId = next();let marketId = next();let selectionId = next();let quoteId = next();let selected = M.Selection.HOME;
  const system = ():M.ICallContext=>({operatorId, actorId:systemActor, actorKind:M.ActorKind.SYSTEM, capabilities:Object.values(M.Capability), correlationId:next(), deadlineAt:new Date(time + 1000).toISOString()});
  const player = ():M.ICallContext=>({...system(), actorId:gatewayActor, actorKind:M.ActorKind.SERVICE, playerId, capabilities:[M.Capability.PLACE_BET, M.Capability.CANCEL_BET, M.Capability.BET_READ]});
  const source = ():M.ICallContext=>({...system(), actorId:eventsActor, actorKind:M.ActorKind.SERVICE, capabilities:[M.Capability.SETTLE_BET]});
  const config:IBettingApplicationSettings = {namespace:'6ba7b810-9dad-11d1-80b4-00c04fd430c8', persistence:{backend, connectionString, poolMax:4, replicaCount:1, connectionBudget:4, acquisitionTimeoutMs:10000, transactionTimeoutMs:30000, statementTimeoutMs:10000, lockTimeoutMs:2000, retryAttempts:20, outboxLeaseMs:1000}, operators:[operatorId, otherOperator].map(operatorId=>({operatorId, currencies:['USD'], marketPeriod:M.MarketPeriod.NORMAL_TIME, trustedActors:[{actorId:gatewayActor, actorKind:M.ActorKind.SERVICE, capabilities:[M.Capability.PLACE_BET, M.Capability.CANCEL_BET, M.Capability.BET_READ]}, {actorId:eventsActor, actorKind:M.ActorKind.SERVICE, capabilities:[M.Capability.SETTLE_BET]}, {actorId:systemActor, actorKind:M.ActorKind.SYSTEM, capabilities:Object.values(M.Capability)}]})), outboxRetryMs:10};
  let eligible = true;let marketOpen = true;let phase = M.EventPhase.PRE_MATCH;let reserveLost = false;let cancelLost = false;let settlementLost = false;let closeAfterReserve = false;let postings = 0;let racing = false;
  const reservations = new Map<string, M.IReservationView>();const commands = new Map<string, {hash:string;result:M.ILedgerReserveStakeOutput}>();
  const quote = ():M.IQuote=>({quoteId, quoteVersion:1n, eventId, marketId, selectionId, selection:selected, odds:'1.99500000', validUntil:'2026-10-16T12:00:00Z', state:M.MarketState.OPEN});

  async function outsideTransaction():Promise<void> {if (racing) return;

const rows = await owner.query<{count:string}>("SELECT count(*)::text FROM pg_stat_activity WHERE datname=current_database() AND usename='runtime_user' AND state='idle in transaction'");

assert.equal(rows.rows[0]?.count, '0', 'Remote RPC held a Betting transaction');}
  function posted(requestId:string, betId:string, reservation:M.IReservationView):M.ILedgerReserveStakeOutput {return {reservation:structuredClone(reservation), outcome:{requestId, state:M.FinancialOutcomeState.COMPLETED, transactionId:reservation.settlementTransactionId ?? reservation.reservationTransactionId, businessRef:betId, wallet:{walletId, playerId, currency:'USD', status:M.WalletStatus.ACTIVE, availableMinor:1000000000000n, reservedMinor:reservation.state === M.ReservationState.RESERVED ? reservation.stake.amountMinor : 0n, withdrawalHoldMinor:0n, version:1n, observedAt:clock.now()}, replayed:false}};}
  async function effect(context:M.ICallContext, requestId:string, betId:string, kind:string, payout?:M.IMoney, seq?:bigint):Promise<M.ILedgerReserveStakeOutput> {
    await outsideTransaction();const key = context.operatorId + ':' + requestId;const hash = canonicalJson({betId, kind, payout, seq});const previous = commands.get(key);

if (previous) {assert.equal(previous.hash, hash);

return structuredClone(previous.result);}

    const current = reservations.get(betId);

assert.ok(current);assert.equal(current.state, M.ReservationState.RESERVED, 'A different financial effect already won');const state = kind === 'WIN' ? M.ReservationState.WON : kind === 'LOSS' ? M.ReservationState.LOST : M.ReservationState.CANCELED;
    const result = {...current, state, settlementTransactionId:next(), grossPayoutMinor:kind === 'WIN' ? payout?.amountMinor ?? 0n : kind === 'LOSS' ? 0n : current.stake.amountMinor, ...(state === M.ReservationState.CANCELED || seq === undefined ? {} : {settlementSeq:seq})};

reservations.set(betId, result);postings++;const output = posted(requestId, betId, result);

commands.set(key, {hash, result:output});

if (state === M.ReservationState.CANCELED && cancelLost) {cancelLost = false;throw new BettingError(M.ErrorCode.DEPENDENCY_UNAVAILABLE, true);} if (state !== M.ReservationState.CANCELED && settlementLost) {settlementLost = false;throw new BettingError(M.ErrorCode.DEPENDENCY_UNAVAILABLE, true);}

 return output;
  }
  const clients:IBettingClients = {eligibility:{check:async()=>{await outsideTransaction();

return {eligibility:{allowed:eligible, reasonCode:eligible ? M.EligibilityReason.ELIGIBLE : M.EligibilityReason.CAPABILITY_RESTRICTED, policyVersion:'SYNTHETIC', evaluatedAt:clock.now(), validUntil:'2026-10-16T12:00:00Z', playerVersion:1n}};}},
quotes:{validateSelection:async(_context, _player, event, market, selection, id, version)=>{await outsideTransaction();assert.equal(event, eventId);assert.equal(market, marketId);assert.equal(selection, selectionId);assert.equal(id, quoteId);assert.equal(version, 1n);

if (!marketOpen) throw new BettingError(M.ErrorCode.MARKET_CLOSED);

return {acceptedQuote:quote(), evaluatedAt:clock.now()};},
getEvent:async()=>{await outsideTransaction();

return {event:{eventId, runId, sport:M.Sport.FOOTBALL, homeTeam:'Home', awayTeam:'Away', startsAt:clock.now(), phase, phaseSeq:1n, simulatedAt:clock.now()}};}},
reservations:{reserve:async(context, requestId, betId, ownerId, stake)=>{await outsideTransaction();assert.equal(ownerId, playerId);const key = context.operatorId + ':' + requestId;const hash = canonicalJson({betId, stake, ownerId});const previous = commands.get(key);

if (previous) {assert.equal(previous.hash, hash);

return structuredClone(previous.result);}assert.equal(reservations.has(betId), false);const reservation:M.IReservationView = {betId, walletId, stake:structuredClone(stake), state:M.ReservationState.RESERVED, reservationTransactionId:next()};

reservations.set(betId, reservation);postings++;const output = posted(requestId, betId, reservation);

commands.set(key, {hash, result:output});

if (closeAfterReserve) {closeAfterReserve = false;marketOpen = false;} if (reserveLost) {reserveLost = false;throw new BettingError(M.ErrorCode.DEPENDENCY_UNAVAILABLE, true);}

 return output;},
getStatus:async(_context, betId)=>{await outsideTransaction();const reservation = reservations.get(betId);

return {observedAt:clock.now(), ...(reservation ? {reservation:structuredClone(reservation)} : {})};},
cancel:(context, requestId, betId, reason)=>effect(context, requestId, betId, reason)},
settlements:{getStatus:async(_context, betId)=>{await outsideTransaction();const reservation = reservations.get(betId);

return {observedAt:clock.now(), ...(reservation ? {reservation:structuredClone(reservation)} : {})};},
settleWin:(context, requestId, betId, seq, payout)=>effect(context, requestId, betId, 'WIN', payout, seq),
settleLoss:(context, requestId, betId, seq)=>effect(context, requestId, betId, 'LOSS', undefined, seq),
void:(context, requestId, betId, reason)=>effect(context, requestId, betId, reason)}};
  let failPublication = true;const published:string[] = [];const publication = {publish:async(_context:M.ICallContext, event:M.IEventEnvelope):Promise<M.IPublicationReceipt>=>{published.push(event.messageId);

if (failPublication) {failPublication = false;throw new Error('Synthetic broker outage');}

 return {messageId:event.messageId, acceptedAt:clock.now(), durable:true};}};
  let app = await createBettingApplication(config, clock, clients, publication);
  const value = <T>(result:M.IResult<T>):T=>{assert.ok(result.ok, losslessJson(result));

return result.value;};
  const place = (requestId = next()):M.IBettingPlaceBetInput=>({context:player(), requestId, playerId, type:M.BetType.SINGLE, stake:{amountMinor:101n, currency:'USD'}, selection:{eventId, marketId, selectionId, quoteId, quoteVersion:1n}});
  const recover = async():Promise<M.IBettingRetryPendingReservationOutput>=>value(await app.operations.retryPendingReservation.execute({context:system(), batchId:next(), page:{limit:200}, pendingBefore:clock.now()}));

  try {
    const original = place();const accepted = value(await app.operations.placeBet.execute(original));

assert.equal(accepted.outcome, M.PlaceOutcome.ACCEPTED);assert.equal(accepted.bet.potentialPayoutMinor, 201n);const afterFirst = postings;

    assert.deepEqual(value(await app.operations.placeBet.execute({...original, context:player()})), accepted);assert.equal(postings, afterFirst);assert.equal((await app.operations.placeBet.execute({...original, stake:{amountMinor:102n, currency:'USD'}})).ok, false);
    const concurrent = place();

racing = true;const raced = await Promise.all(Array.from({length:20}, ()=>app.operations.placeBet.execute(concurrent)));

racing = false;

for (const result of raced)value(result);assert.equal(postings, afterFirst + 1);
    eligible = false;const denied = value(await app.operations.placeBet.execute(place()));

assert.equal(denied.outcome, M.PlaceOutcome.REJECTED);assert.equal(postings, afterFirst + 1);eligible = true;marketOpen = false;assert.equal(value(await app.operations.placeBet.execute(place())).outcome, M.PlaceOutcome.REJECTED);marketOpen = true;
    reserveLost = true;const interrupted = place();const pending = value(await app.operations.placeBet.execute(interrupted));

assert.equal(pending.outcome, M.PlaceOutcome.PENDING);const reservedCount = postings;

assert.equal(value(await app.operations.placeBet.execute({...interrupted, context:player()})).outcome, M.PlaceOutcome.PENDING);assert.equal(postings, reservedCount);
    await app.close();time += 2000;app = await createBettingApplication(config, clock, clients, publication);assert.equal((await recover()).report.applied, 1);assert.equal(postings, reservedCount);assert.equal(value(await app.operations.getBet.execute({context:player(), playerId, betId:pending.bet.betId})).bet.status, M.BetStatus.ACCEPTED);
    closeAfterReserve = true;cancelLost = true;const compensated = value(await app.operations.placeBet.execute(place()));

assert.equal(compensated.outcome, M.PlaceOutcome.PENDING);assert.equal(reservations.get(compensated.bet.betId)?.state, M.ReservationState.CANCELED);time += 2000;marketOpen = true;assert.equal((await recover()).report.rejected, 1);assert.equal(value(await app.operations.getBet.execute({context:player(), playerId, betId:compensated.bet.betId})).bet.status, M.BetStatus.REJECTED);
    const cancelable = value(await app.operations.placeBet.execute(place()));

cancelLost = true;const cancelInput = {context:player(), requestId:next(), playerId, betId:cancelable.bet.betId, expectedVersion:cancelable.bet.version};

assert.equal(value(await app.operations.cancelBet.execute(cancelInput)).outcome, M.CancelOutcome.PENDING);phase = M.EventPhase.LIVE;time += 2000;const cancellation = value(await app.operations.retryPendingCancellation.execute({context:system(), batchId:next(), page:{limit:200}, pendingBefore:clock.now()}));

assert.equal(cancellation.report.applied, 1);assert.equal(value(await app.operations.getBet.execute({context:player(), playerId, betId:cancelable.bet.betId})).bet.status, M.BetStatus.CANCELED);
    assert.equal((await app.operations.getBet.execute({context:{...player(), operatorId:otherOperator}, playerId, betId:accepted.bet.betId})).ok, false);assert.equal((await app.operations.getBet.execute({context:player(), playerId:next(), betId:accepted.bet.betId})).ok, false);
    const page = value(await app.operations.listPlayerBets.execute({context:player(), playerId, page:{limit:1}}));

assert.ok(page.nextCursor);const second = value(await app.operations.listPlayerBets.execute({context:player(), playerId, page:{limit:1, cursor:page.nextCursor}}));

assert.notEqual(page.bets[0]?.betId, second.bets[0]?.betId);assert.equal((await app.operations.listPlayerBets.execute({context:{...player(), operatorId:otherOperator}, playerId, page:{limit:1, cursor:page.nextCursor}})).ok, false);
    // A local post-reservation failure must leave the durable pending intent for recovery.
    await owner.query("CREATE FUNCTION fail_bet_intent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic outbox failure'; END; $$");await owner.query('CREATE TRIGGER fail_bet_intent BEFORE INSERT ON bet_outbox_events FOR EACH ROW EXECUTE FUNCTION fail_bet_intent()');const faulted = value(await app.operations.placeBet.execute(place()));

assert.equal(faulted.outcome, M.PlaceOutcome.PENDING);assert.equal(value(await app.operations.getBet.execute({context:player(), playerId, betId:faulted.bet.betId})).bet.status, M.BetStatus.PENDING_RESERVATION);await owner.query('DROP TRIGGER fail_bet_intent ON bet_outbox_events');await owner.query('DROP FUNCTION fail_bet_intent()');time += 2000;assert.equal((await recover()).report.applied, 1);
    const result:M.IEventResult = {resultId:next(), eventId, runId, resultSeq:1n, homeGoals:2, awayGoals:1, outcome:M.ResultOutcome.HOME, occurredAt:clock.now()};const envelope:M.IEventEnvelope = {messageId:next(), source:M.EventSource.EVENTS, eventType:M.EventType.EVENT_RESULT, schemaVersion:1, operatorId, correlationId:next(), occurredAt:clock.now(), payload:result};
    const recorded = value(await app.operations.recordEventResult.execute({context:source(), envelope, result}));

assert.equal(recorded.duplicate, false);assert.equal(value(await app.operations.recordEventResult.execute({context:source(), envelope, result})).duplicate, true);assert.equal((await owner.query('SELECT * FROM bet_settlement_sweeps WHERE operator_id=$1', [operatorId])).rowCount, 1);
    const changedResult = {...result, homeGoals:3};

assert.equal((await app.operations.recordEventResult.execute({context:source(), envelope:{...envelope, payload:changedResult}, result:changedResult})).ok, false);
    settlementLost = true;const settledPending = value(await app.operations.settleBet.execute({context:system(), requestId:next(), betId:accepted.bet.betId, resultId:result.resultId, settlementSeq:1n}));

assert.equal(settledPending.outcome, M.SettleOutcome.PENDING);const afterSettlement = postings;

time += 2000;const recovered = value(await app.operations.retryPendingSettlement.execute({context:system(), batchId:next(), page:{limit:200}, pendingBefore:clock.now()}));

assert.equal(recovered.report.applied, 1);assert.equal(postings, afterSettlement);

    for (let attempt = 0;attempt < 10;attempt++) {const batch = value(await app.operations.scheduleEventSettlements.execute({context:system(), sweepId:recorded.sweepId, page:{limit:1}}));

if (batch.report.selected === 0) break;}
    time += 2000;value(await app.operations.retryPendingSettlement.execute({context:system(), batchId:next(), page:{limit:200}, pendingBefore:clock.now()}));const terminal = value(await app.operations.getBet.execute({context:player(), playerId, betId:accepted.bet.betId})).bet;

assert.equal(terminal.status, M.BetStatus.WON);assert.equal(terminal.actualPayoutMinor, 201n);assert.equal(terminal.legs[0]?.quote?.odds, '1.99500000');
    const beforeRead = postings;

value(await app.operations.getBetStatus.execute({context:player(), playerId, betId:accepted.bet.betId}));assert.equal(postings, beforeRead);
    const audit = value(await app.operations.reconcileBetWithLedger.execute({context:system(), requestId:next(), runId:next(), page:{limit:200}, cutoff:clock.now()}));

assert.equal(audit.report.status, M.ReconciliationStatus.PASS);
    const financial = reservations.get(terminal.betId);

assert.ok(financial);reservations.set(terminal.betId, {...financial, grossPayoutMinor:202n});const divergent = value(await app.operations.reconcileBetWithLedger.execute({context:system(), requestId:next(), runId:next(), page:{limit:200}, cutoff:clock.now()}));

assert.equal(divergent.report.status, M.ReconciliationStatus.FAIL);assert.equal(postings, beforeRead);reservations.set(terminal.betId, financial);
    const orphanId = next();

    await owner.query('INSERT INTO bet_legs(bet_leg_id,operator_id,bet_id,leg_no,event_id,market_id,selection_id,selection_snapshot,status,created_at) SELECT $1,operator_id,$2,1,event_id,market_id,selection_id,selection_snapshot,status,created_at FROM bet_legs WHERE operator_id=$3 AND bet_id=$4', [orphanId, next(), operatorId, terminal.betId]);
    const orphanAudit = await app.operations.reconcileBetWithLedger.execute({context:system(), requestId:next(), runId:next(), page:{limit:200}, cutoff:clock.now()});

    assert.ok(!orphanAudit.ok);assert.equal(orphanAudit.error.code, M.ErrorCode.INVARIANT_VIOLATION);assert.equal(postings, beforeRead);
    await owner.query('DELETE FROM bet_legs WHERE bet_leg_id=$1', [orphanId]);

    for (const outcome of [M.ResultOutcome.HOME, M.ResultOutcome.VOID]) {
      eventId = next();marketId = next();selectionId = next();quoteId = next();selected = outcome === M.ResultOutcome.HOME ? M.Selection.AWAY : M.Selection.HOME;
      const additional = value(await app.operations.placeBet.execute(place()));

assert.equal(additional.outcome, M.PlaceOutcome.ACCEPTED);
      const sporting:M.IEventResult = {resultId:next(), eventId, runId, resultSeq:1n, homeGoals:2, awayGoals:1, outcome, occurredAt:clock.now()};const message:M.IEventEnvelope = {messageId:next(), source:M.EventSource.EVENTS, eventType:M.EventType.EVENT_RESULT, schemaVersion:1, operatorId, correlationId:next(), occurredAt:clock.now(), payload:sporting};

      if (outcome === M.ResultOutcome.VOID) {
        await owner.query("CREATE FUNCTION fail_bet_sweep() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic sweep failure'; END; $$");await owner.query('CREATE TRIGGER fail_bet_sweep BEFORE INSERT ON bet_settlement_sweeps FOR EACH ROW EXECUTE FUNCTION fail_bet_sweep()');
        assert.equal((await app.operations.recordEventResult.execute({context:source(), envelope:message, result:sporting})).ok, false);
        assert.equal((await owner.query('SELECT message_id FROM bet_inbox_events WHERE message_id=$1', [message.messageId])).rowCount, 0);assert.equal((await owner.query('SELECT result_id FROM bet_event_results WHERE result_id=$1', [sporting.resultId])).rowCount, 0);
        await owner.query('DROP TRIGGER fail_bet_sweep ON bet_settlement_sweeps');await owner.query('DROP FUNCTION fail_bet_sweep()');
      }
      value(await app.operations.recordEventResult.execute({context:source(), envelope:message, result:sporting}));
      const settled = value(await app.operations.settleBet.execute({context:system(), requestId:next(), betId:additional.bet.betId, resultId:sporting.resultId, settlementSeq:1n}));

assert.equal(settled.outcome, M.SettleOutcome.SETTLED);assert.equal(settled.bet.status, outcome === M.ResultOutcome.VOID ? M.BetStatus.VOID : M.BetStatus.LOST);assert.equal(settled.bet.actualPayoutMinor, outcome === M.ResultOutcome.VOID ? 101n : 0n);
    }
    eventId = next();marketId = next();selectionId = next();quoteId = next();selected = M.Selection.HOME;phase = M.EventPhase.PRE_MATCH;
    const contended = value(await app.operations.placeBet.execute(place()));const contestedResult:M.IEventResult = {resultId:next(), eventId, runId, resultSeq:1n, homeGoals:1, awayGoals:0, outcome:M.ResultOutcome.HOME, occurredAt:clock.now()};const contestedEnvelope:M.IEventEnvelope = {messageId:next(), source:M.EventSource.EVENTS, eventType:M.EventType.EVENT_RESULT, schemaVersion:1, operatorId, correlationId:next(), occurredAt:clock.now(), payload:contestedResult};

value(await app.operations.recordEventResult.execute({context:source(), envelope:contestedEnvelope, result:contestedResult}));
    const beforeRace = postings;

racing = true;await Promise.all([app.operations.cancelBet.execute({context:player(), requestId:next(), playerId, betId:contended.bet.betId, expectedVersion:contended.bet.version}), app.operations.settleBet.execute({context:system(), requestId:next(), betId:contended.bet.betId, resultId:contestedResult.resultId, settlementSeq:1n})]);racing = false;
    const wonRace = value(await app.operations.getBet.execute({context:player(), playerId, betId:contended.bet.betId})).bet;

assert.ok([M.BetStatus.WON, M.BetStatus.CANCELED].includes(wonRace.status));assert.equal(postings, beforeRace + 1);
    const outbox = value(await app.operations.publishOutboxBatch.execute({input:{context:system(), batchId:next(), limit:200, cutoff:clock.now()}}));

assert.equal(outbox.report.pending, 1);time += 20;assert.equal(value(await app.operations.publishOutboxBatch.execute({input:{context:system(), batchId:next(), limit:200, cutoff:clock.now()}})).report.applied, 1);assert.equal(published.at(-1), published[0]);
    assert.equal((await owner.query("SELECT conname FROM pg_constraint WHERE contype='f'")).rowCount, 0);assert.equal((await owner.query('SELECT l.bet_leg_id FROM bet_legs l LEFT JOIN bets b ON b.operator_id=l.operator_id AND b.bet_id=l.bet_id WHERE b.bet_id IS NULL')).rowCount, 0);
    console.log('Betting ' + backend + ': lifecycle, exact payout, 20-way replay, scoped reads, lost reserve/cancel/settlement replies, restart, compensation, sweep, reconciliation and outbox passed.');
  } finally {await app.close();}
}
