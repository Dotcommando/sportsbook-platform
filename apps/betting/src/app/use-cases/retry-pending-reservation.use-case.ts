import * as M from '../../domain/betting.model.js';
import { requireRule, success } from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type { RetryPendingReservationPort } from '../../ports/inbound/betting-operations.port.js';
import type { IBettingDependencies } from '../services/betting-operation.service.js';
import { batch, fail, report, required, storedContext, value } from '../services/betting-operation.service.js';
import { ReservationRecoveryService } from '../services/reservation-recovery.service.js';

export class RetryPendingReservationUseCase implements RetryPendingReservationPort {
  constructor(private readonly d: IBettingDependencies) { }

  async execute(
    input: M.IBettingRetryPendingReservationInput,
  ): Promise<
    M.IResult<
      M.IBettingRetryPendingReservationOutput
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
              M.RecoveryKind.RESERVATION,
              input.pendingBefore,
              input.page,
            );
            const work = [];

            for (const bet of bets) {
              work.push(
                {
                  bet,
                  command: required(
                    await ports.commands.findForBet(input.context, bet.betId, M.BetCommandOperation.PLACE_BET),
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

          requireRule(Output.isIBettingPlaceBetInput(original), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

          if (!Output.isIBettingPlaceBetInput(original)) {
            throw new Error('Invalid stored workflow');
          }

          const result = await new ReservationRecoveryService(this.d).resume(
            { ...original, context: storedContext(item.command, input.context) },
            item.command,
          );

          if (!result.ok) {
            counts.failed++;
          } else if (result.value.outcome === M.PlaceOutcome.ACCEPTED) {
            counts.applied++;
          } else if (result.value.outcome === M.PlaceOutcome.REJECTED) {
            counts.rejected++;
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
