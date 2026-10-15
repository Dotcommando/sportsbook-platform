import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type {GetPlayerPort} from '../../ports/inbound/player-operations.port.js';
import type {IPlayerDependencies} from '../services/player-command.service.js';
import {PlayerQueryService} from '../services/player-query.service.js';

export class GetPlayerUseCase implements GetPlayerPort {constructor(private readonly dependencies:IPlayerDependencies) {}

execute(input:M.IPlayerGetPlayerInput):Promise<M.IResult<M.IPlayerGetPlayerOutput>> {return new PlayerQueryService(this.dependencies).run(input.context, M.Capability.PROFILE_READ, input.playerId, async ports=>{const player = Policy.profile(await ports.profiles.find(input.context, input.playerId), input.playerId);const contacts = await ports.contacts.list(input.context, input.playerId);const value = {profile:player, contacts};

Policy.requireRule(Output.isIPlayerGetPlayerOutput(value), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return value;}, undefined);}}
