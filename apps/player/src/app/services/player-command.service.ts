import * as M from '../../domain/player.model.js';
import { failure, operator, owns, PlayerError, requireRule, validUuid } from '../../domain/player.policy.js';
import type { ClockPort, CommandFingerprintPort, IdGeneratorPort, IPlayerTransactionPorts, PlayerUnitOfWorkPort } from '../../ports/outbound/player.port.js';

export interface IPlayerDependencies {unitOfWork:PlayerUnitOfWorkPort;clock:ClockPort;ids:IdGeneratorPort;fingerprint:CommandFingerprintPort;settings:readonly M.IPlayerOperatorSettings[];}

export class PlayerCommandService {
  constructor(private readonly dependencies:IPlayerDependencies) {}

  async run<T extends M.RegisteredOutput>(operation:string, input:M.RegisteredInput & {context:M.ICallContext;requestId:string}, capability:M.Capability, stableIds:M.IStableChildId[], accept:(value:unknown)=>value is T, work:(ports:IPlayerTransactionPorts)=>Promise<T>, kind?:M.ActorKind):Promise<M.IResult<T>> {
    try {operator(this.dependencies.settings, input.context, capability, this.dependencies.clock.now(), kind);requireRule(validUuid(input.requestId));

for (const [name, value] of Object.entries(input)) {if (name.endsWith('Id'))requireRule(validUuid(value));if (name === 'expectedVersion')requireRule(typeof value === 'bigint' && value > 0n && value <= 9223372036854775807n);}

 if ('playerId' in input)owns(input.context, input.playerId);

const hash = this.dependencies.fingerprint.hash(operation, input);

      return await this.dependencies.unitOfWork.run(input.context, async ports=>{const claim = await ports.commands.claim(input.context, input.requestId, operation, hash, input, stableIds);

if (claim.kind === M.ClaimKind.REPLAY) {const stored = claim.command.outcome;

if (!stored) throw new PlayerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);if (!stored.ok) return stored;requireRule(accept(stored.value), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

if (!accept(stored.value)) throw new PlayerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return {ok:true, value:stored.value};} if (claim.kind === M.ClaimKind.IN_PROGRESS) return failure(M.ErrorCode.IN_PROGRESS, input.context);

let result:M.IResult<T>;

try {const value = await work(ports);

requireRule(accept(value), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);result = {ok:true, value};} catch(error) {if (!(error instanceof PlayerError)) throw error;if ([M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, M.ErrorCode.DEPENDENCY_UNAVAILABLE, M.ErrorCode.INVARIANT_VIOLATION].includes(error.code)) throw error;result = failure(error.code, input.context);} await ports.commands.complete(input.context, input.requestId, result);

return result;});
    } catch(error) {return failure(error instanceof PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context);}
  }
}

