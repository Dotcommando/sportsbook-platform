import * as M from '../../domain/player.model.js';
import { failure, operator, owns, PlayerError } from '../../domain/player.policy.js';
import type { IPlayerTransactionPorts } from '../../ports/outbound/player.port.js';
import type { IPlayerDependencies } from './player-command.service.js';

export class PlayerQueryService {
  constructor(private readonly dependencies:IPlayerDependencies) {}

  async run<T>(context:M.ICallContext, capability:M.Capability, playerId:string, work:(ports:IPlayerTransactionPorts)=>Promise<T>, kind?:M.ActorKind):Promise<M.IResult<T>> {
    try {operator(this.dependencies.settings, context, capability, this.dependencies.clock.now(), kind);owns(context, playerId);

return await this.dependencies.unitOfWork.run(context, async ports=>({ok:true, value:await work(ports)}));} catch(error) {return failure(error instanceof PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, context);}
  }
}
