import assert from 'node:assert/strict';
import test from 'node:test';

import {Bet} from '../src/domain/bet.js';
import * as M from '../src/domain/betting.model.js';
import {grossPayout, MAX_MINOR, Money} from '../src/domain/money.js';
import {SettlementPolicy} from '../src/domain/settlement.policy.js';

const id = '00000000-0000-4000-8000-000000000001';

const other = '00000000-0000-4000-8000-000000000002';

const now = '2026-10-15T12:00:00Z';

function value<T>(result:M.IResult<T>):T {assert.ok(result.ok, JSON.stringify(result, (_key, item:unknown)=>typeof item === 'bigint' ? item.toString() : item));

return result.value;}

function fixture():{pending:Bet;accepted:M.IBetView;quote:M.IQuote;eligibility:M.IEligibility;reserve:M.IReservationView;result:M.IEventResult} {
  const money = value(Money.create(101n, 'USD'));const quote:M.IQuote = {quoteId:id, quoteVersion:1n, eventId:id, marketId:id, selectionId:id, selection:M.Selection.HOME, odds:'1.99500000', validUntil:'2026-10-15T12:01:00Z', state:M.MarketState.OPEN};
  const pending = value(Bet.pending(id, other, money, {eventId:id, marketId:id, selectionId:id, quoteId:id, quoteVersion:1n}, now));
  const eligibility:M.IEligibility = {allowed:true, reasonCode:M.EligibilityReason.ELIGIBLE, policyVersion:'TEST', evaluatedAt:now, validUntil:quote.validUntil, playerVersion:1n};
  const reserve:M.IReservationView = {betId:id, walletId:other, stake:{amountMinor:101n, currency:'USD'}, state:M.ReservationState.RESERVED, reservationTransactionId:other};
  const accepted = value(pending.accept(quote, eligibility, reserve, now));const result:M.IEventResult = {resultId:other, eventId:id, runId:id, resultSeq:1n, homeGoals:1, awayGoals:0, outcome:M.ResultOutcome.HOME, occurredAt:now};

return {pending, accepted, quote, eligibility, reserve, result};
}

test('gross payout includes stake, rounds down once and never passes through number', ()=>{
  assert.equal(value(grossPayout(101n, '1.99500000')), 201n);assert.equal(value(grossPayout(9007199254740993n, '2.5')), 22517998136852482n);
  assert.equal(value(grossPayout(1n, '1.00000001')), 1n);assert.equal(value(grossPayout(100000001n, '1.00000001')), 100000002n);
  assert.equal(value(grossPayout(1n, '1000')), 1000n);

  for (const odds of ['1', '0.99', '1000.00000001', '2.000000001', '2e2', 'NaN', '02.5'])assert.equal(grossPayout(100n, odds).ok, false);
  assert.equal(grossPayout(MAX_MINOR, '2').ok, false);assert.equal(grossPayout(0n, '2').ok, false);assert.equal(Money.create(MAX_MINOR + 1n, 'USD').ok, false);
});

test('acceptance requires valid decision, current quote and exact verified reserve', ()=>{
  const f = fixture();

assert.equal(f.accepted.potentialPayoutMinor, 201n);assert.equal(f.pending.toSnapshot().status, M.BetStatus.PENDING_RESERVATION);
  assert.equal(f.pending.accept(f.quote, {...f.eligibility, allowed:false}, f.reserve, now).ok, false);
  assert.equal(f.pending.accept(f.quote, f.eligibility, f.reserve, f.quote.validUntil).ok, false);
  assert.equal(f.pending.accept({...f.quote, selectionId:other}, f.eligibility, f.reserve, now).ok, false);
  assert.equal(f.pending.accept(f.quote, f.eligibility, {...f.reserve, stake:{amountMinor:102n, currency:'USD'}}, now).ok, false);
  assert.equal(f.pending.accept(f.quote, f.eligibility, {...f.reserve, state:M.ReservationState.WON}, now).ok, false);
  const cloned = value(Bet.rehydrate(f.accepted)).toSnapshot();const q = cloned.legs[0]?.quote;

assert.ok(q);q.odds = '999';assert.equal(f.accepted.legs[0]?.quote?.odds, '1.99500000');
});

test('WIN LOSS VOID settle only after matching immutable financial execution; reads cannot fabricate terminal state', ()=>{
  for (const outcome of [M.ResultOutcome.HOME, M.ResultOutcome.AWAY, M.ResultOutcome.VOID]) {
    const f = fixture();const result = {...f.result, outcome, homeGoals:outcome === M.ResultOutcome.AWAY ? 0 : 1, awayGoals:outcome === M.ResultOutcome.AWAY ? 1 : 0};const intent = value(SettlementPolicy.determine(f.accepted, result, 1n, id, other));
    const amount = outcome === M.ResultOutcome.HOME ? 201n : outcome === M.ResultOutcome.VOID ? 101n : 0n;

assert.equal(intent.payout.amountMinor, amount);
    const bet = value(Bet.rehydrate(f.accepted));

assert.equal(bet.finalize(intent, f.reserve, now).ok, false);
    const state = outcome === M.ResultOutcome.HOME ? M.ReservationState.WON : outcome === M.ResultOutcome.VOID ? M.ReservationState.CANCELED : M.ReservationState.LOST;
    const financial = {...f.reserve, state, settlementTransactionId:other, grossPayoutMinor:amount, ...(state === M.ReservationState.CANCELED ? {} : {settlementSeq:1n})};const final = value(bet.finalize(intent, financial, now));

assert.equal(final.actualPayoutMinor, amount);assert.ok(Bet.rehydrate(final).ok);
    assert.equal(bet.finalize(intent, {...financial, grossPayoutMinor:amount + 1n}, now).ok, false);assert.equal(Bet.rehydrate({...final, actualPayoutMinor:amount + 1n}).ok, false);
    assert.equal(SettlementPolicy.determine(f.accepted, {...result, eventId:other}, 1n, id, other).ok, false);assert.equal(SettlementPolicy.determine(f.accepted, result, 2n, id, other).ok, false);
  }
  const f = fixture();

assert.equal(SettlementPolicy.determine(f.accepted, {...f.result, outcome:M.ResultOutcome.AWAY}, 1n, id, other).ok, false);
  const bet = value(Bet.rehydrate(f.accepted));

assert.equal(bet.cancel(f.reserve, now).ok, false);assert.ok(bet.cancel({...f.reserve, state:M.ReservationState.CANCELED, settlementTransactionId:other, grossPayoutMinor:101n}, now).ok);
});
