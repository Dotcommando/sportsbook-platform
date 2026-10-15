import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type {VerifyContactPort} from '../../ports/inbound/player-operations.port.js';
import type * as Ports from '../../ports/outbound/player.port.js';
import type {IPlayerDependencies} from '../services/player-command.service.js';
import {PlayerCommandService} from '../services/player-command.service.js';
import {emitEvent, stableIds} from '../services/player-event.factory.js';

export class VerifyContactUseCase implements VerifyContactPort {constructor(private readonly dependencies:IPlayerDependencies, private readonly verification:Ports.SyntheticVerificationPort) {}

async execute(input:M.IPlayerVerifyContactInput):Promise<M.IResult<M.IPlayerVerifyContactOutput>> {try {Policy.operator(this.dependencies.settings, input.context, M.Capability.CONTACT_VERIFY, this.dependencies.clock.now(), M.ActorKind.SYSTEM);Policy.owns(input.context, input.playerId);Policy.requireRule(await this.verification.verify(input.context, input.contactId, input.proofRef), M.ErrorCode.INVALID_INPUT);

return new PlayerCommandService(this.dependencies).run('VerifyContact', input, M.Capability.CONTACT_VERIFY, stableIds(this.dependencies, input, ['event']), Output.isIPlayerVerifyContactOutput, async ports=>{const player = Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);const contact = await ports.contacts.verify(input.context, input.playerId, input.contactId, this.dependencies.clock.now());

await emitEvent(this.dependencies, ports, input, player, M.EventType.PLAYER_PROFILE_CHANGED);

return {contact};}, M.ActorKind.SYSTEM);} catch(error) {return Policy.failure(error instanceof Policy.PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context);}}}
