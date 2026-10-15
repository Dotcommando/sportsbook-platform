import * as M from '../../domain/betting.model.js';
import { requireRule, success } from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type { RetryPendingCancellationPort } from '../../ports/inbound/betting-operations.port.js';
import type { IBettingDependencies } from '../services/betting-operation.service.js';
import { batch, fail, report, required, storedContext, value } from '../services/betting-operation.service.js';
import { CancellationRecoveryService } from '../services/cancellation-recovery.service.js';

export class RetryPendingCancellationUseCase implements RetryPendingCancellationPort {
  constructor(private readonly d: IBettingDependencies) { }

  async execute(
    input: M.IBettingRetryPendingCancellationInput,
  ): Promise<
    M.IResult<
      M.IBettingRetryPendingCancellationOutput
    >
  > {
    try {
      batch(this.d, input);
      const leased = value(
        await this.d.unitOfWork.run(
          input.context,
          async ports => {
            const bets = await ports.bets.listPending(
              input.context,
              M.RecoveryKind.CANCELLATION,
              input.pendingBefore,
              input.page,
            );
            const work = [];

            for (const bet of bets) {
              work.push(
                {
                  bet,
                  command: required(
                    await ports.commands.findForBet(input.context, bet.betId, M.BetCommandOperation.CANCEL_BET),
                  ),
                },
              );
            }

            return success(work);
          },
        ),
      );
      const counts = report();

      counts.selected = leased.length;

      for (const item of leased) {
        try {
          const original = item.command.semanticInput;

          requireRule(Output.isIBettingCancelBetInput(original), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

          if (!Output.isIBettingCancelBetInput(original)) {
            throw new Error('Invalid stored workflow');
          }

          const result = await new CancellationRecoveryService(this.d).resume(
            { ...original, context: storedContext(item.command, input.context) },
            item.command,
          );

          if (!result.ok) {
            counts.failed++;
          } else if (result.value.outcome === M.CancelOutcome.CANCELED) {
            counts.applied++;
          } else {
            counts.pending++;
          }
        } catch {
          counts.failed++;
        }
      }

      return success({ report: counts });
    } catch (error) {
      return fail(error, input.context);
    }
  }
}
