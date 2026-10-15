import { Bet } from '../../domain/bet.js';
import * as M from '../../domain/betting.model.js';
import { requireRule, success } from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type { IBettingDependencies } from './betting-operation.service.js';
import { changed, load, required, value } from './betting-operation.service.js';

// SettleBet and recovery execute an immutable financial intent without recalculating odds.
export class SettlementExecutionService {
  constructor(private readonly d: IBettingDependencies) { }

  async execute(context: M.ICallContext, intent: M.ISettlementIntent): Promise<M.IResult<M.IBettingSettleBetOutput>> {
    const d = this.d;

    try {
      const owner = await load(d, context, intent.betId);
      const delegated = { ...context, playerId: owner.playerId };
      const known = await d.settlements.getStatus(delegated, intent.betId);

      requireRule(
        Output.isILedgerGetBetFinancialStatusOutput(known) && known.reservation !== undefined,
        M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
      );
      let financial = required(known.reservation);

      if (financial.state === M.ReservationState.RESERVED) {
        const posted = intent.decision === M.SettlementDecision.WIN
          ? await d.settlements.settleWin(
            delegated,
            intent.ledgerCommandId,
            intent.betId,
            intent.settlementSeq,
            intent.payout,
          )
          : intent.decision === M.SettlementDecision.LOSS
            ? await d.settlements.settleLoss(delegated, intent.ledgerCommandId, intent.betId, intent.settlementSeq)
            : await d.settlements.void(delegated, intent.ledgerCommandId, intent.betId, M.CancellationReason.VOID);

        requireRule(
          Output.isILedgerSettleWinOutput(posted)
          && posted.outcome.state === M.FinancialOutcomeState.COMPLETED
          && posted.outcome.requestId === intent.ledgerCommandId
          && posted.outcome.businessRef === intent.betId
          && posted.outcome.wallet.playerId === owner.playerId
          && posted.outcome.wallet.currency === intent.payout.currency,
          M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
        );
        financial = posted.reservation;
      }

      return await d.unitOfWork.run(
        context,
        async ports => {
          const current = required(await ports.bets.find(context, intent.betId));
          const stored = required(await ports.settlements.find(context, intent.betId, intent.settlementSeq));

          if (stored.state === M.SettlementState.APPLIED) {
            return success({ bet: current, outcome: M.SettleOutcome.SETTLED });
          }

          const result = required(await ports.settlements.findEventResult(context, intent.resultId));
          const next = value(value(Bet.rehydrate(current)).finalize(intent, financial, d.clock.now()));

          await ports.settlements.markApplied(context, intent.intentId, financial);
          await changed(d, ports, context, current, next);
          await ports.legs.resolve(context, next.betId, required(next.legs[0]).legId, result);

          return success({ bet: next, outcome: M.SettleOutcome.SETTLED });
        },
      );
    } catch {
      return success({ bet: await load(d, context, intent.betId), outcome: M.SettleOutcome.PENDING });
    }
  }
}
