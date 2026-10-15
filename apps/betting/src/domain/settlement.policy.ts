import { BetLeg } from './bet-leg.js';
import * as M from './betting.model.js';
import { failure, success, validUuid } from './betting.policy.js';
import { grossPayout } from './money.js';

export class SettlementPolicy {
  private constructor() { }

  static determine(
    bet: M.IBetView,
    result: M.IEventResult,
    settlementSeq: bigint,
    intentId: string,
    commandId: string,
  ): M.IResult<M.ISettlementIntent> {
    if (bet.type !== M.BetType.SINGLE || bet.legs.length !== 1
      || ![M.BetStatus.ACCEPTED, M.BetStatus.SETTLEMENT_PENDING].includes(bet.status)
      || settlementSeq !== 1n
      || !validUuid(intentId)
      || !validUuid(commandId)) {
      return failure(M.ErrorCode.INVALID_STATE);
    }

    const leg = bet.legs[0];

    if (!leg?.quote) {
      return failure(M.ErrorCode.INVARIANT_VIOLATION);
    }

    const loaded = BetLeg.rehydrate(leg);

    if (!loaded.ok) {
      return loaded;
    }

    const resolved = loaded.value.resolve(result);

    if (!resolved.ok) {
      return resolved;
    }

    const decision = resolved.value.state === M.BetLegState.VOID
      ? M.SettlementDecision.VOID
      : resolved.value.state === M.BetLegState.WON
        ? M.SettlementDecision.WIN
        : M.SettlementDecision.LOSS;
    const payout = grossPayout(bet.stake.amountMinor, leg.quote.odds);

    if (!payout.ok) {
      return payout;
    }

    return success(
      {
        intentId,
        betId: bet.betId,
        resultId: result.resultId,
        settlementSeq,
        decision,
        payout: {
          currency: bet.stake.currency,
          amountMinor: decision === M.SettlementDecision.WIN
            ? payout.value
            : decision === M.SettlementDecision.VOID ? bet.stake.amountMinor : 0n,
        },
        ledgerCommandId: commandId,
        state: M.SettlementState.PENDING,
        createdAt: result.occurredAt,
      },
    );
  }
}
