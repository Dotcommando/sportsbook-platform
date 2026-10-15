import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type {RegisterPlayerPort} from '../../ports/inbound/player-operations.port.js';
import type {IPlayerDependencies} from '../services/player-command.service.js';
import {PlayerCommandService} from '../services/player-command.service.js';
import {emitEvent, stableIds} from '../services/player-event.factory.js';

export class RegisterPlayerUseCase implements RegisterPlayerPort {constructor(private readonly dependencies:IPlayerDependencies) {}

async execute(input:M.IPlayerRegisterPlayerInput):Promise<M.IResult<M.IPlayerRegisterPlayerOutput>> {try {const normalized = {...input, locale:Policy.locale(input.locale), timeZone:Policy.zone(input.timeZone)};

if (input.externalRef !== undefined)Policy.requireRule(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.externalRef));

const ids = stableIds(this.dependencies, input, ['player', 'event']);const playerId = ids[0]?.id;

if (!playerId) throw new Policy.PlayerError(M.ErrorCode.INVARIANT_VIOLATION);

return new PlayerCommandService(this.dependencies).run('RegisterPlayer', normalized, M.Capability.REGISTER_PLAYER, ids, Output.isIPlayerRegisterPlayerOutput, async ports=>{const now = this.dependencies.clock.now();const value:M.IProfile = {playerId, status:M.PlayerStatus.REGISTERED, locale:normalized.locale, timeZone:normalized.timeZone, version:1n, createdAt:now, updatedAt:now};const player = Policy.profile(await ports.players.create(input.context, value, input.externalRef), playerId);

await ports.profiles.create(input.context, player);await emitEvent(this.dependencies, ports, input, player, M.EventType.PLAYER_REGISTERED);

return {profile:player, created:true};});} catch(error) {return Policy.failure(error instanceof Policy.PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context);}}}
