import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type {DecideKycCasePort} from '../../ports/inbound/player-operations.port.js';
import type * as Ports from '../../ports/outbound/player.port.js';
import type {IPlayerDependencies} from '../services/player-command.service.js';
import {PlayerCommandService} from '../services/player-command.service.js';
import {emitEvent, stableIds} from '../services/player-event.factory.js';

export class DecideKycCaseUseCase implements DecideKycCasePort {constructor(private readonly dependencies:IPlayerDependencies, private readonly policies:Ports.OperatorEligibilityPolicyPort) {}

async execute(input:M.IPlayerDecideKycCaseInput):Promise<M.IResult<M.IPlayerDecideKycCaseOutput>> {try {Policy.operator(this.dependencies.settings, input.context, M.Capability.DECIDE_KYC, this.dependencies.clock.now(), M.ActorKind.SYSTEM);

return new PlayerCommandService(this.dependencies).run('DecideKycCase', input, M.Capability.DECIDE_KYC, stableIds(this.dependencies, input, ['event']), Output.isIPlayerDecideKycCaseOutput, async ports=>{const settings = Policy.operator(this.dependencies.settings, input.context, M.Capability.DECIDE_KYC, this.dependencies.clock.now(), M.ActorKind.SYSTEM);

Policy.requireRule(settings.reasonCodes.includes(input.decisionCode));const player = Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);const current = await ports.cases.get(input.context, input.playerId, input.caseId);

Policy.requireRule(current !== undefined, M.ErrorCode.NOT_FOUND);

if (!current) throw new Policy.PlayerError(M.ErrorCode.NOT_FOUND);

const policy = await this.policies.get(input.context, Policy.caseCapability(this.dependencies.settings, input.context, current.requiredLevel));

Policy.requireRule(current.version === input.expectedVersion, M.ErrorCode.VERSION_CONFLICT);Policy.requireRule(current.policyVersion === policy.policyVersion && [M.KycCaseStatus.OPEN, M.KycCaseStatus.IN_REVIEW].includes(current.status), M.ErrorCode.INVALID_STATE);const checks = await ports.checks.list(input.context, input.caseId);

if (input.decision === M.KycDecision.APPROVED) {Policy.requireRule(policy.requiredChecks.every(kind=>checks.filter(check=>check.checkType === kind).sort((a, b)=>b.attemptNo - a.attemptNo)[0]?.status === M.KycCheckStatus.PASSED), M.ErrorCode.INVALID_STATE);Policy.requireRule(input.validUntil !== undefined && Policy.validInstant(input.validUntil) && Date.parse(input.validUntil) > Date.parse(this.dependencies.clock.now()) && Date.parse(input.validUntil) <= Date.parse(this.dependencies.clock.now()) + policy.maxValidityDays * 86400000);} else Policy.requireRule(input.decision === M.KycDecision.REJECTED && input.validUntil === undefined);

const next:M.IKycCase = {...current, status:input.decision === M.KycDecision.APPROVED ? M.KycCaseStatus.APPROVED : M.KycCaseStatus.REJECTED, decisionCode:input.decisionCode, ...(input.validUntil ? {validUntil:input.validUntil} : {}), version:current.version + 1n};const kycCase = await ports.cases.decide(input.context, input.caseId, current.version, next);

await emitEvent(this.dependencies, ports, input, player, M.EventType.PLAYER_ELIGIBILITY_CHANGED);

return {kycCase};}, M.ActorKind.SYSTEM);} catch(error) {return Policy.failure(error instanceof Policy.PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context);}}}
