import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import type {GetRestrictionsPort} from '../../ports/inbound/player-operations.port.js';
import type {IPlayerDependencies} from '../services/player-command.service.js';
import {PlayerQueryService} from '../services/player-query.service.js';

export class GetRestrictionsUseCase implements GetRestrictionsPort {constructor(private readonly dependencies:IPlayerDependencies) {}

execute(input:M.IPlayerGetRestrictionsInput):Promise<M.IResult<M.IPlayerGetRestrictionsOutput>> {return new PlayerQueryService(this.dependencies).run(input.context, M.Capability.RESTRICTION_READ, input.playerId, async ports=>{Policy.validatePage(input.page);Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);const result = await ports.restrictions.list(input.context, input.playerId, input.page, input.state);

return {restrictions:result.items.map(value=>Policy.effectiveRestriction(value, this.dependencies.clock.now())), ...(result.nextCursor ? {nextCursor:result.nextCursor} : {}), evaluatedAt:this.dependencies.clock.now()};}, undefined);}}
