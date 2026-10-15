import type { IBatchReport, IResult, IWorkerBatchInput } from '../../domain/player.model.js';
import { ActorKind, Capability, ErrorCode, KycCheckStatus, KycCheckType } from '../../domain/player.model.js';
import { failure, operator, PlayerError, requireRule, validInstant, validUuid } from '../../domain/player.policy.js';
import type { RunSyntheticKycCheckPort } from '../../ports/inbound/player-operations.port.js';
import type { RunSyntheticKycBatchPort } from '../../ports/inbound/synthetic-kyc-batch.port.js';
import type { KycWorkQueryPort } from '../../ports/outbound/kyc-work.port.js';
import type { IPlayerDependencies } from '../services/player-command.service.js';

export class RunSyntheticKycBatchUseCase implements RunSyntheticKycBatchPort {
  constructor(
    private readonly dependencies: IPlayerDependencies,
    private readonly work: KycWorkQueryPort,
    private readonly check: RunSyntheticKycCheckPort,
  ) { }

  async execute(input: IWorkerBatchInput): Promise<IResult<IBatchReport>> {
    try {
      const settings = operator(
        this.dependencies.settings,
        input.context,
        Capability.SYNTHETIC_KYC,
        this.dependencies.clock.now(),
        ActorKind.SYSTEM,
      );

      requireRule(
        validUuid(input.batchId) && Number.isInteger(input.limit) && input.limit >= 1
        && input.limit <= 200
        && validInstant(input.cutoff)
        && Date.parse(input.cutoff) <= Date.parse(this.dependencies.clock.now())
        && Object.keys(input).every(key => ['context', 'batchId', 'limit', 'cutoff'].includes(key)),
      );
      const policies = settings.casePolicyCapabilities.map(
        binding => {
          const policy = settings.policies.find(
            p => p.capability === binding.capability && p.requiredLevel === binding.level,
          );

          if (!policy) {
            throw new PlayerError(ErrorCode.INVARIANT_VIOLATION);
          }

          return { level: binding.level, version: policy.policyVersion, checks: policy.requiredChecks };
        },
      );
      const items = await this.work.listDue(input.context, input.cutoff, input.limit, policies);

      requireRule(
        items.length <= input.limit
        && items.every(
          item =>
            validUuid(item.playerId) && validUuid(item.caseId)
            && Object.values(KycCheckType).includes(item.checkType)
            && item.attemptNo === 1,
        )
        && new Set(items.map(item => JSON.stringify([item.caseId, item.checkType, item.attemptNo]))).size
        === items.length,
        ErrorCode.ADAPTER_CONTRACT_VIOLATION,
      );
      const report: IBatchReport =
        {
          selected:
          items.length,
          applied:
          0,
          replayed:
          0,
          rejected:
          0,
          pending:
          0,
          failed:
          0,
        };

      for (const item of items) {
        try {
          const requestId = this.dependencies.ids.derive(
            input.context.operatorId,
            item.caseId,
            'player:kyc-check:' + item.checkType + ':' + item.attemptNo,
          );
          const result = await this.check.execute({ context: input.context, requestId, ...item });

          if (result.ok) {
            if (result.value.check.status === KycCheckStatus.FAILED) {
              report.rejected++;
            } else {
              report.applied++;
            }
          } else if (result.error.retryable || result.error.outcomeUnknown) {
            report.pending++;
          } else {
            report.failed++;
          }
        } catch {
          report.pending++;
        }
      }

      return { ok: true, value: report };
    } catch (error) {
      return failure(
        error instanceof PlayerError ? error.code : ErrorCode.DEPENDENCY_UNAVAILABLE,
        input.context,
      );
    }
  }
}
