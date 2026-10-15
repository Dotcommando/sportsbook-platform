import type { IBatchReport, IWorkerBatchInput } from '../../domain/betting.model.js';
import { Capability } from '../../domain/betting.model.js';
import { requireRule, success, validInstant, validUuid } from '../../domain/betting.policy.js';
import type { ScheduleEventSettlementsPort } from '../../ports/inbound/betting-operations.port.js';
import type { SettlementWorkerPort } from '../../ports/inbound/settlement-worker.port.js';
import type { IBettingDependencies } from '../services/betting-operation.service.js';
import { authorize, report, value } from '../services/betting-operation.service.js';

export class ScheduleResultsUseCase implements SettlementWorkerPort {
  constructor(
    private readonly dependencies: IBettingDependencies,
    private readonly schedule: ScheduleEventSettlementsPort,
  ) { }

  async scheduleResults(input: IWorkerBatchInput): Promise<IBatchReport> {
    authorize(this.dependencies, input.context, Capability.SETTLE_BET, undefined, true);
    requireRule(
      validUuid(input.batchId) && Number.isInteger(input.limit) && input.limit >= 1
      && input.limit <= 200
      && validInstant(input.cutoff)
      && Date.parse(input.cutoff) <= Date.parse(this.dependencies.clock.now()),
    );
    const due = value(
      await this.dependencies.unitOfWork.run(
        input.context,
        async (ports) => success(await ports.sweeps.findDue(input.context, { limit: input.limit })),
      ),
    );
    const result = report();

    for (const sweep of due) {
      if (result.selected >= input.limit) {
        break;
      }

      const next = await this.schedule.execute(
        {
          context: input.context,
          sweepId: sweep.sweepId,
          page: { limit: input.limit - result.selected },
        },
      );

      if (!next.ok) {
        result.failed++;
        continue;
      }
      result.selected += next.value.report.selected;
      result.applied += next.value.report.applied;
      result.replayed += next.value.report.replayed;
      result.rejected += next.value.report.rejected;
      result.pending += next.value.report.pending;
      result.failed += next.value.report.failed;
    }

    return result;
  }
}
