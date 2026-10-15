import * as M from '../../domain/betting.model.js';
import { success } from '../../domain/betting.policy.js';
import type { RetryPendingSettlementPort } from '../../ports/inbound/betting-operations.port.js';
import type { IBettingDependencies } from '../services/betting-operation.service.js';
import { batch, fail, report, value } from '../services/betting-operation.service.js';
import { SettlementExecutionService } from '../services/settlement-execution.service.js';

export class RetryPendingSettlementUseCase implements RetryPendingSettlementPort {
  constructor(private readonly d: IBettingDependencies) { }

  async execute(
    input: M.IBettingRetryPendingSettlementInput,
  ): Promise<
    M.IResult<
      M.IBettingRetryPendingSettlementOutput
    >
  > {
    try {
      batch(this.d, input);
      const intents = value(
        await this.d.unitOfWork.run(
          input.context,
          async ports =>
            success(await ports.settlements.listPending(input.context, input.pendingBefore, input.page)),
        ),
      );
      const counts = report();

      counts.selected = intents.length;

      for (const intent of intents) {
        try {
          const result = await new SettlementExecutionService(this.d).execute(input.context, intent);

          if (!result.ok) {
            counts.failed++;
          } else if (result.value.outcome === M.SettleOutcome.SETTLED) {
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
