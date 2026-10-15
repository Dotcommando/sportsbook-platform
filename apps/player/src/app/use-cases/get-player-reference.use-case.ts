import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import type {GetPlayerReferencePort} from '../../ports/inbound/player-operations.port.js';
import type {IPlayerDependencies} from '../services/player-command.service.js';
import {PlayerQueryService} from '../services/player-query.service.js';

export class GetPlayerReferenceUseCase implements GetPlayerReferencePort {constructor(private readonly dependencies:IPlayerDependencies) {}

execute(input:M.IPlayerGetPlayerReferenceInput):Promise<M.IResult<M.IPlayerGetPlayerReferenceOutput>> {return new PlayerQueryService(this.dependencies).run(input.context, M.Capability.READ_PLAYER_REFERENCE, input.playerId, async ports=>{Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);

return {operatorId:input.context.operatorId, playerId:input.playerId, exists:true};}, M.ActorKind.SERVICE);}}
