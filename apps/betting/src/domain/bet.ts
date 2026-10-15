import {BetLeg} from './bet-leg.js';
import * as M from './betting.model.js';
import {failure, success, validInstant, validUuid} from './betting.policy.js';
import * as Output from './betting-output.policy.js';
import {grossPayout, Money} from './money.js';

export class Bet {
  private constructor(private readonly snapshot:M.IBetView) {}

  static pending(betId:string, playerId:string, stake:Money, selection:M.IBetSelection, now:string):M.IResult<Bet> {
    if (!validUuid(betId) || !validUuid(playerId) || !Output.isIBetSelection(selection) || selection.quoteVersion <= 0n || !validInstant(now) || stake.amountMinor <= 0n || !Money.create(stake.amountMinor, stake.currency).ok) return failure(M.ErrorCode.INVALID_INPUT);

    return success(new Bet({betId, playerId, type:M.BetType.SINGLE, status:M.BetStatus.PENDING_RESERVATION, stake:{amountMinor:stake.amountMinor, currency:stake.currency}, potentialPayoutMinor:0n, legs:[{legId:betId, legNo:1, eventId:selection.eventId, marketId:selection.marketId, selectionId:selection.selectionId, state:M.BetLegState.PENDING}], createdAt:now, version:1n}));
  }

  accept(quote:M.IQuote, eligibility:M.IEligibility, reservation:M.IReservationView, now:string):M.IResult<M.IBetView> {
    const bet = this.snapshot;const draft = bet.legs[0];

    if (bet.status !== M.BetStatus.PENDING_RESERVATION || !draft || !validInstant(now) || !Output.isIEligibility(eligibility) || eligibility.playerVersion <= 0n || !eligibility.policyVersion || !eligibility.allowed || eligibility.reasonCode !== M.EligibilityReason.ELIGIBLE || !eligibility.validUntil || Date.parse(eligibility.evaluatedAt) > Date.parse(now) || Date.parse(eligibility.validUntil) <= Date.parse(now)) return failure(M.ErrorCode.INELIGIBLE);
    if (!Output.isIQuote(quote) || quote.eventId !== draft.eventId || quote.marketId !== draft.marketId || quote.selectionId !== draft.selectionId || Date.parse(quote.validUntil) <= Date.parse(now)) return failure(M.ErrorCode.STALE_QUOTE);
    if (!this.financial(reservation) || reservation.state !== M.ReservationState.RESERVED || !validUuid(reservation.reservationTransactionId) || reservation.settlementTransactionId !== undefined || reservation.settlementSeq !== undefined || reservation.grossPayoutMinor !== undefined) return failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    const accepted = BetLeg.accept(draft.legId, quote);

if (!accepted.ok) return accepted;

const payout = grossPayout(bet.stake.amountMinor, quote.odds);

if (!payout.ok) return payout;

    return success({...this.toSnapshot(), status:M.BetStatus.ACCEPTED, legs:[accepted.value.toSnapshot()], potentialPayoutMinor:payout.value, acceptedAt:now, version:bet.version + 1n});
  }

  reject(reasonCode:M.ErrorCode, now:string):M.IResult<M.IBetView> {
    if (this.snapshot.status !== M.BetStatus.PENDING_RESERVATION || !validInstant(now) || !Object.values(M.ErrorCode).includes(reasonCode)) return failure(M.ErrorCode.INVALID_STATE);

    return success({...this.toSnapshot(), status:M.BetStatus.REJECTED, reasonCode, version:this.snapshot.version + 1n});
  }

  finalize(intent:M.ISettlementIntent, financial:M.IReservationView, now:string):M.IResult<M.IBetView> {
    const bet = this.snapshot;const leg = bet.legs[0];

    if (![M.BetStatus.ACCEPTED, M.BetStatus.SETTLEMENT_PENDING].includes(bet.status) || !leg?.quote || !Output.isISettlementIntent(intent) || intent.betId !== bet.betId || intent.settlementSeq !== 1n || !this.financial(financial) || !validInstant(now) || !financial.settlementTransactionId || !validUuid(financial.settlementTransactionId) || (intent.decision !== M.SettlementDecision.VOID && financial.settlementSeq !== intent.settlementSeq) || intent.payout.currency !== bet.stake.currency) return failure(M.ErrorCode.INVALID_STATE);

    const payout = grossPayout(bet.stake.amountMinor, leg.quote.odds);

if (!payout.ok) return payout;

    const expected = intent.decision === M.SettlementDecision.WIN ? M.ReservationState.WON : intent.decision === M.SettlementDecision.LOSS ? M.ReservationState.LOST : M.ReservationState.CANCELED;
    const amount = intent.decision === M.SettlementDecision.WIN ? payout.value : intent.decision === M.SettlementDecision.VOID ? bet.stake.amountMinor : 0n;

    if (financial.state !== expected || intent.payout.amountMinor !== amount || financial.grossPayoutMinor !== amount) return failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    const status = intent.decision === M.SettlementDecision.WIN ? M.BetStatus.WON : intent.decision === M.SettlementDecision.LOSS ? M.BetStatus.LOST : M.BetStatus.VOID;

    return success({...this.toSnapshot(), status, legs:[{...leg, state:status === M.BetStatus.WON ? M.BetLegState.WON : status === M.BetStatus.LOST ? M.BetLegState.LOST : M.BetLegState.VOID, resultRef:intent.resultId}], actualPayoutMinor:amount, settledAt:now, version:bet.version + 1n});
  }

  cancel(financial:M.IReservationView, now:string):M.IResult<M.IBetView> {
    if (this.snapshot.status !== M.BetStatus.ACCEPTED || !this.financial(financial) || financial.state !== M.ReservationState.CANCELED || !financial.settlementTransactionId || !validUuid(financial.settlementTransactionId) || financial.grossPayoutMinor !== this.snapshot.stake.amountMinor || !validInstant(now)) return failure(M.ErrorCode.INVALID_STATE);

    return success({...this.toSnapshot(), status:M.BetStatus.CANCELED, actualPayoutMinor:this.snapshot.stake.amountMinor, settledAt:now, version:this.snapshot.version + 1n});
  }

  toSnapshot():M.IBetView {return structuredClone(this.snapshot);}

  static rehydrate(snapshot:M.IBetView):M.IResult<Bet> {
    if (!Output.isIBetView(snapshot) || snapshot.type !== M.BetType.SINGLE || snapshot.stake.amountMinor <= 0n || !Money.create(snapshot.stake.amountMinor, snapshot.stake.currency).ok || snapshot.legs.length !== 1 || snapshot.version <= 0n) return failure(M.ErrorCode.INVARIANT_VIOLATION);

    const leg = snapshot.legs[0];

if (leg?.legNo !== 1) return failure(M.ErrorCode.INVARIANT_VIOLATION);
    if (snapshot.potentialPayoutMinor < 0n || !Money.create(snapshot.potentialPayoutMinor, snapshot.stake.currency).ok) return failure(M.ErrorCode.INVARIANT_VIOLATION);

    const terminal = [M.BetStatus.WON, M.BetStatus.LOST, M.BetStatus.VOID, M.BetStatus.CANCELED].includes(snapshot.status);

    if (!terminal && (snapshot.actualPayoutMinor !== undefined || snapshot.settledAt !== undefined)) return failure(M.ErrorCode.INVARIANT_VIOLATION);
    if (snapshot.status === M.BetStatus.REJECTED && snapshot.reasonCode === undefined) return failure(M.ErrorCode.INVARIANT_VIOLATION);
    if ([M.BetStatus.PENDING_RESERVATION, M.BetStatus.REJECTED].includes(snapshot.status) && snapshot.acceptedAt !== undefined) return failure(M.ErrorCode.INVARIANT_VIOLATION);
    if (![M.BetStatus.PENDING_RESERVATION, M.BetStatus.REJECTED].includes(snapshot.status)) {
      if (!leg.quote || !snapshot.acceptedAt || !grossPayout(snapshot.stake.amountMinor, leg.quote.odds).ok) return failure(M.ErrorCode.INVARIANT_VIOLATION);

      const payout = grossPayout(snapshot.stake.amountMinor, leg.quote.odds);

if (!payout.ok || payout.value !== snapshot.potentialPayoutMinor || !BetLeg.rehydrate(leg).ok) return failure(M.ErrorCode.INVARIANT_VIOLATION);
    }
    if ([M.BetStatus.WON, M.BetStatus.LOST, M.BetStatus.VOID, M.BetStatus.CANCELED].includes(snapshot.status) && (!snapshot.settledAt || snapshot.actualPayoutMinor === undefined)) return failure(M.ErrorCode.INVARIANT_VIOLATION);
    if (snapshot.acceptedAt && Date.parse(snapshot.acceptedAt) < Date.parse(snapshot.createdAt) || snapshot.settledAt && snapshot.acceptedAt && Date.parse(snapshot.settledAt) < Date.parse(snapshot.acceptedAt)) return failure(M.ErrorCode.INVARIANT_VIOLATION);

    const amount = snapshot.status === M.BetStatus.WON ? snapshot.potentialPayoutMinor : snapshot.status === M.BetStatus.LOST ? 0n : snapshot.stake.amountMinor;

    if (terminal && snapshot.actualPayoutMinor !== amount) return failure(M.ErrorCode.INVARIANT_VIOLATION);

    const state = snapshot.status === M.BetStatus.WON ? M.BetLegState.WON : snapshot.status === M.BetStatus.LOST ? M.BetLegState.LOST : snapshot.status === M.BetStatus.VOID ? M.BetLegState.VOID : M.BetLegState.PENDING;

    if (leg.state !== state) return failure(M.ErrorCode.INVARIANT_VIOLATION);

    return success(new Bet(structuredClone(snapshot)));
  }

  private financial(value:M.IReservationView):boolean {return Output.isIReservationView(value) && value.betId === this.snapshot.betId && value.stake.amountMinor === this.snapshot.stake.amountMinor && value.stake.currency === this.snapshot.stake.currency;}
}
