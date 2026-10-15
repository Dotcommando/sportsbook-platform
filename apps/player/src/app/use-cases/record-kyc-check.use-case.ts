import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type { RecordKycCheckPort } from '../../ports/inbound/player-operations.port.js';
import type * as Ports from '../../ports/outbound/player.port.js';
import type { IPlayerDependencies } from '../services/player-command.service.js';
import { PlayerCommandService } from '../services/player-command.service.js';
import { emitEvent, stableIds } from '../services/player-event.factory.js';

export class RecordKycCheckUseCase implements RecordKycCheckPort {
  constructor(
    private readonly dependencies: IPlayerDependencies,
    private readonly policies: Ports.OperatorEligibilityPolicyPort,
  ) { }

  async execute(input: M.IPlayerRecordKycCheckInput): Promise<M.IResult<M.IPlayerRecordKycCheckOutput>> {
    try {
      return new PlayerCommandService(this.dependencies).run(
        'RecordKycCheck',
        input,
        M.Capability.SYNTHETIC_KYC,
        [
          ...stableIds(this.dependencies, input, ['event']),
          { purpose: 'player:provider-check', id: input.check.checkId },
        ],
        Output.isIPlayerRecordKycCheckOutput,
        async ports => {
          const player = Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);
          const current = await ports.cases.get(input.context, input.playerId, input.caseId);

          Policy.requireRule(current !== undefined, M.ErrorCode.NOT_FOUND);

          if (!current) {
            throw new Policy.PlayerError(M.ErrorCode.NOT_FOUND);
          }

          const policy = await this.policies.get(
            input.context,
            Policy.caseCapability(this.dependencies.settings, input.context, current.requiredLevel),
          );

          Policy.requireRule(
            [M.KycCaseStatus.OPEN, M.KycCaseStatus.IN_REVIEW].includes(current.status),
            M.ErrorCode.INVALID_STATE,
          );
          Policy.requireRule(
            current.policyVersion === policy.policyVersion
            && policy.requiredChecks.includes(input.check.checkType)
            && input.check.caseId === input.caseId
            && Output.isIKycCheck(input.check)
            && input.check.provider === M.KycProvider.SYNTHETIC
            && input.check.attemptNo >= 1
            && Date.parse(input.check.completedAt) <= Date.parse(this.dependencies.clock.now())
            && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.check.providerCheckRef),
          );
          const check = await ports.checks.record(input.context, input.playerId, input.check);
          const next = { ...current, status: M.KycCaseStatus.IN_REVIEW, version: current.version + 1n };
          const kycCase = await ports.cases.transition(input.context, input.caseId, current.version, next);

          await emitEvent(this.dependencies, ports, input, player, M.EventType.PLAYER_ELIGIBILITY_CHANGED);

          return { check, kycCase };
        },
        M.ActorKind.SERVICE,
      );
    } catch (error) {
      return Policy.failure(
        error instanceof Policy.PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE,
        input.context,
      );
    }
  }
}
