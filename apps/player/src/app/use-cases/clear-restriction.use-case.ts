import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type {ClearRestrictionPort} from '../../ports/inbound/player-operations.port.js';
import type {IPlayerDependencies} from '../services/player-command.service.js';
import {PlayerCommandService} from '../services/player-command.service.js';
import {emitEvent, stableIds} from '../services/player-event.factory.js';

export class ClearRestrictionUseCase implements ClearRestrictionPort {constructor(private readonly dependencies:IPlayerDependencies) {}

async execute(input:M.IPlayerClearRestrictionInput):Promise<M.IResult<M.IPlayerClearRestrictionOutput>> {try {return new PlayerCommandService(this.dependencies).run('ClearRestriction', input, M.Capability.MANAGE_RESTRICTIONS, stableIds(this.dependencies, input, ['event']), Output.isIPlayerClearRestrictionOutput, async ports=>{const settings = Policy.operator(this.dependencies.settings, input.context, M.Capability.MANAGE_RESTRICTIONS, this.dependencies.clock.now(), M.ActorKind.SYSTEM);

Policy.requireRule(settings.reasonCodes.includes(input.reasonCode));const player = Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);const restriction = await ports.restrictions.clear(input.context, input.playerId, input.restrictionId, this.dependencies.clock.now(), input.reasonCode);

await emitEvent(this.dependencies, ports, input, player, M.EventType.PLAYER_ELIGIBILITY_CHANGED);

return {restriction};}, M.ActorKind.SYSTEM);} catch(error) {return Policy.failure(error instanceof Policy.PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context);}}}
