import { failure, LedgerError, success, validInstant, validUuid } from '../../domain/ledger.error.js';
import type { IBatchReport, IResult, IWorkerBatchInput } from '../../domain/ledger.model.js';
import { ActorKind, Capability, ErrorCode } from '../../domain/ledger.model.js';
import { SyntheticPaymentDecision } from '../../domain/synthetic-payment.model.js';
import type { CompleteWithdrawalPort, RejectWithdrawalPort } from '../../ports/inbound/ledger-operations.port.js';
import type { RunSyntheticPaymentBatchPort } from '../../ports/inbound/synthetic-payment-batch.port.js';
import type { SyntheticPaymentPort } from '../../ports/outbound/synthetic-payment.port.js';
import type { ILedgerCommandDependencies } from '../services/financial-command.service.js';
import { FinancialCommandService } from '../services/financial-command.service.js';
import { validWithdrawal } from '../services/financial-query.service.js';

export class RunSyntheticPaymentBatchUseCase implements RunSyntheticPaymentBatchPort {
  constructor(
    private readonly dependencies: ILedgerCommandDependencies,
    private readonly simulation: SyntheticPaymentPort,
    private readonly complete: CompleteWithdrawalPort,
    private readonly reject: RejectWithdrawalPort,
  ) { }

  async execute(input: IWorkerBatchInput): Promise<IResult<IBatchReport>> {
    const authorized = new FinancialCommandService(this.dependencies).authorize(
      input.context,
      Capability.PAYMENT_SIMULATOR,
      ActorKind.SYSTEM,
    );

    if (!authorized.ok) {
      return authorized;
    }
    if (!validUuid(input.batchId) || !Number.isInteger(input.limit) || input.limit < 1
      || input.limit > 200
      || !validInstant(input.cutoff)
      || Date.parse(input.cutoff) > Date.parse(this.dependencies.clock.now())
      || Object.keys(input).some(k => !['context', 'batchId', 'limit', 'cutoff'].includes(k))) {
      return failure(ErrorCode.INVALID_INPUT, input.context.correlationId);
    }

    try {
      const selected = await this.dependencies.unitOfWork.run(
        input.context,
        async (ports) =>
          success(await ports.withdrawals.listHeld(input.context, { limit: input.limit }, input.cutoff)),
      );

      if (!selected.ok) {
        return selected;
      }
      if (selected.value.length > input.limit || selected.value.some(w => !validWithdrawal(w))
        || new Set(selected.value.map(w => w.withdrawalId)).size !== selected.value.length) {
        return failure(ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
      }

      const report: IBatchReport = {
        selected: selected.value.length,
        applied: 0,
        replayed: 0,
        rejected: 0,
        pending: 0,
        failed: 0,
      };

      for (const withdrawal of selected.value) {
        try {
          const decision = await this.simulation.decide(input.context, withdrawal);
          const requestId = this.dependencies.ids.derive(
            input.context.operatorId,
            withdrawal.withdrawalId,
            'ledger:synthetic-payment-resolution',
          );
          let result;

          if (decision.decision === SyntheticPaymentDecision.COMPLETE
            && typeof decision.providerRef === 'string'
            && decision.reasonCode === undefined) {
            result =
              await this.complete.execute(
                {
                  context: input.context,
                  requestId,
                  withdrawalId: withdrawal.withdrawalId,
                  providerRef: decision.providerRef,
                },
              );
          } else if (decision.decision === SyntheticPaymentDecision.REJECT
            && typeof decision.reasonCode === 'string'
            && decision.providerRef === undefined) {
            result =
              await this.reject.execute(
                {
                  context: input.context,
                  requestId,
                  withdrawalId: withdrawal.withdrawalId,
                  reasonCode: decision.reasonCode,
                },
              );
          } else {
            throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);
          }
          if (result.ok) {
            if (result.value.outcome.replayed) {
              report.replayed++;
            } else if (decision.decision === SyntheticPaymentDecision.REJECT) {
              report.rejected++;
            } else {
              report.applied++;
            }
          } else if (result.error.outcomeUnknown || result.error.retryable) {
            report.pending++;
          } else {
            report.failed++;
          }
        } catch {
          report.pending++;
        }
      }

      return success(report);
    } catch (error) {
      return failure(
        error instanceof LedgerError ? error.code : ErrorCode.DEPENDENCY_UNAVAILABLE,
        input.context.correlationId,
        true,
      );
    }
  }
}
