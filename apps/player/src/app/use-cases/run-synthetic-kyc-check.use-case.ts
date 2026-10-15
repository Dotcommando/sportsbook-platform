import * as M from '../../domain/player.model.js';
import { failure, operator, PlayerError, requireRule, validUuid } from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type { RecordKycCheckPort, RunSyntheticKycCheckPort } from '../../ports/inbound/player-operations.port.js';
import type { KycProviderPort } from '../../ports/outbound/player.port.js';
import type { IPlayerDependencies } from '../services/player-command.service.js';
import { PlayerQueryService } from '../services/player-query.service.js';

export class RunSyntheticKycCheckUseCase implements RunSyntheticKycCheckPort {
  constructor(private readonly dependencies:IPlayerDependencies, private readonly provider:KycProviderPort, private readonly record:RecordKycCheckPort) {}

  async execute(input:M.IPlayerRunSyntheticKycCheckInput):Promise<M.IResult<M.IPlayerRunSyntheticKycCheckOutput>> {
    try {operator(this.dependencies.settings, input.context, M.Capability.SYNTHETIC_KYC, this.dependencies.clock.now(), M.ActorKind.SYSTEM);requireRule(validUuid(input.requestId) && validUuid(input.caseId) && Number.isInteger(input.attemptNo) && input.attemptNo >= 1 && input.attemptNo <= 2147483647);const found = await new PlayerQueryService(this.dependencies).run(input.context, M.Capability.SYNTHETIC_KYC, input.playerId, async ports=>ports.cases.get(input.context, input.playerId, input.caseId));

if (!found.ok) return found;

const kycCase = found.value;

requireRule(kycCase !== undefined, M.ErrorCode.NOT_FOUND);

if (!kycCase) throw new PlayerError(M.ErrorCode.NOT_FOUND);requireRule([M.KycCaseStatus.OPEN, M.KycCaseStatus.IN_REVIEW].includes(kycCase.status), M.ErrorCode.INVALID_STATE);const commandId = this.dependencies.ids.derive(input.context.operatorId, input.caseId, 'player:kyc-check:' + input.checkType + ':' + input.attemptNo);const check = await this.provider.requestCheck(input.context, input.caseId, input.checkType, input.attemptNo, commandId);

requireRule(Output.isIKycCheck(check) && check.checkId === commandId && check.caseId === input.caseId && check.checkType === input.checkType && check.attemptNo === input.attemptNo, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return await this.record.execute({context:input.context, requestId:this.dependencies.ids.derive(input.context.operatorId, commandId, 'player:record-kyc-check'), playerId:input.playerId, caseId:input.caseId, check});} catch(error) {return failure(error instanceof PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context);}
  }
}
