import * as M from './betting.model.js';
import {failure, success, validUuid} from './betting.policy.js';
import * as Output from './betting-output.policy.js';
import {grossPayout} from './money.js';

export class BetLeg {
  private constructor(private readonly snapshot:M.IBetLeg) {}

  static accept(legId:string, quote:M.IQuote):M.IResult<BetLeg> {
    if (!validUuid(legId) || !Output.isIQuote(quote) || quote.quoteVersion <= 0n || quote.state !== M.MarketState.OPEN || !grossPayout(1n, quote.odds).ok) return failure(M.ErrorCode.INVALID_INPUT);

    return success(new BetLeg({legId, legNo:1, eventId:quote.eventId, marketId:quote.marketId, selectionId:quote.selectionId, quote:structuredClone(quote), state:M.BetLegState.PENDING}));
  }

  resolve(result:M.IEventResult):M.IResult<M.IBetLeg> {
    const leg = this.snapshot;

    if (!leg.quote || !Output.isIEventResult(result) || result.eventId !== leg.eventId || result.resultSeq !== 1n) return failure(M.ErrorCode.INVALID_STATE);
    if (result.homeGoals < 0 || result.homeGoals > 100 || result.awayGoals < 0 || result.awayGoals > 100) return failure(M.ErrorCode.INVALID_INPUT);

    const outcome = result.homeGoals > result.awayGoals ? M.ResultOutcome.HOME : result.homeGoals < result.awayGoals ? M.ResultOutcome.AWAY : M.ResultOutcome.DRAW;

    if (result.outcome !== M.ResultOutcome.VOID && result.outcome !== outcome) return failure(M.ErrorCode.INVALID_INPUT);
    if (leg.resultRef !== undefined) return leg.resultRef === result.resultId ? success(this.toSnapshot()) : failure(M.ErrorCode.INVALID_STATE);

    const selected = leg.quote.selection === M.Selection.HOME ? M.ResultOutcome.HOME : leg.quote.selection === M.Selection.AWAY ? M.ResultOutcome.AWAY : M.ResultOutcome.DRAW;
    const state = result.outcome === M.ResultOutcome.VOID ? M.BetLegState.VOID : result.outcome === selected ? M.BetLegState.WON : M.BetLegState.LOST;

    return success({...this.toSnapshot(), state, resultRef:result.resultId});
  }

  toSnapshot():M.IBetLeg {return structuredClone(this.snapshot);}

  static rehydrate(snapshot:M.IBetLeg):M.IResult<BetLeg> {
    if (!Output.isIBetLeg(snapshot) || snapshot.legNo !== 1 || !snapshot.quote || snapshot.quote.quoteVersion <= 0n || snapshot.quote.state !== M.MarketState.OPEN || snapshot.quote.eventId !== snapshot.eventId || snapshot.quote.marketId !== snapshot.marketId || snapshot.quote.selectionId !== snapshot.selectionId || !grossPayout(1n, snapshot.quote.odds).ok) return failure(M.ErrorCode.INVARIANT_VIOLATION);
    if ((snapshot.state === M.BetLegState.PENDING) !== (snapshot.resultRef === undefined)) return failure(M.ErrorCode.INVARIANT_VIOLATION);

    return success(new BetLeg(structuredClone(snapshot)));
  }
}
