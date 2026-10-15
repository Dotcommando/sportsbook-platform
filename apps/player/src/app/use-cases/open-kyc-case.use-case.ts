import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type {OpenKycCasePort} from '../../ports/inbound/player-operations.port.js';
import type * as Ports from '../../ports/outbound/player.port.js';
import type {IPlayerDependencies} from '../services/player-command.service.js';
import {PlayerCommandService} from '../services/player-command.service.js';
import {emitEvent, stableIds} from '../services/player-event.factory.js';

export class OpenKycCaseUseCase implements OpenKycCasePort {constructor(private readonly dependencies:IPlayerDependencies, private readonly policies:Ports.OperatorEligibilityPolicyPort) {}

async execute(input:M.IPlayerOpenKycCaseInput):Promise<M.IResult<M.IPlayerOpenKycCaseOutput>> {try {Policy.operator(this.dependencies.settings, input.context, M.Capability.MANAGE_KYC, this.dependencies.clock.now(), M.ActorKind.SYSTEM);const policy = await this.policies.get(input.context, Policy.caseCapability(this.dependencies.settings, input.context, input.requiredLevel));

Policy.requireRule(policy.requiredLevel === input.requiredLevel);const ids = stableIds(this.dependencies, input, ['kyc-case', 'event']);

return new PlayerCommandService(this.dependencies).run('OpenKycCase', input, M.Capability.MANAGE_KYC, ids, Output.isIPlayerOpenKycCaseOutput, async ports=>{const player = Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);const cases = await ports.cases.list(input.context, input.playerId);const existing = cases.find(value=>value.requiredLevel === input.requiredLevel && value.policyVersion === policy.policyVersion && [M.KycCaseStatus.OPEN, M.KycCaseStatus.IN_REVIEW].includes(value.status));

if (existing) return {kycCase:existing};

const kycCase = await ports.cases.open(input.context, {caseId:ids[0]?.id ?? '', playerId:input.playerId, requiredLevel:input.requiredLevel, status:M.KycCaseStatus.OPEN, policyVersion:policy.policyVersion, version:1n});

await emitEvent(this.dependencies, ports, input, player, M.EventType.PLAYER_ELIGIBILITY_CHANGED);

return {kycCase};}, M.ActorKind.SYSTEM);} catch(error) {return Policy.failure(error instanceof Policy.PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context);}}}
