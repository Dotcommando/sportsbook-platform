import * as M from '../../domain/events.model.js';
import {EventsError, failure, operator, requireRule, success, validUuid} from '../../domain/events.policy.js';
import * as Output from '../../domain/events-output.policy.js';
import type {ClockPort, CommandFingerprintPort, EventUnitOfWorkPort, IdGeneratorPort, IEventTransactionPorts} from '../../ports/outbound/events.port.js';

export interface IEventsDependencies {unitOfWork:EventUnitOfWorkPort;clock:ClockPort;ids:IdGeneratorPort;fingerprint:CommandFingerprintPort;settings:readonly M.IEventsOperatorSettings[];}

// Shared authorization and local command atomicity for Events reads and controls.
export class EventsOperationService {
  constructor(private readonly dependencies:IEventsDependencies) {}

  async read<T extends M.RegisteredOutput>(input:M.RegisteredInput & {context:M.ICallContext}, capability:M.Capability, work:(ports:IEventTransactionPorts)=>Promise<T>):Promise<M.IResult<T>> {
    try {
      operator(this.dependencies.settings, input.context, capability, this.dependencies.clock.now());
      requireRule(input.context.actorKind !== M.ActorKind.PLAYER, M.ErrorCode.PERMISSION_DENIED);
      requireRule(Output.isRegisteredInput(input));

      return await this.dependencies.unitOfWork.run(input.context, async ports=>{
        const result = await work(ports);

        requireRule(Output.isRegisteredOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

        return success(result);
      });
    } catch(error) {return failure(error instanceof EventsError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context);}
  }

  async command<T extends M.RegisteredOutput>(operation:string, input:(M.IEventsAdvanceMatchPhaseInput | M.IEventsCompleteEventInput), accept:(value:unknown)=>value is T, work:(ports:IEventTransactionPorts, messageId:string)=>Promise<T>):Promise<M.IResult<T>> {
    try {
      operator(this.dependencies.settings, input.context, M.Capability.MATCH_CONTROL, this.dependencies.clock.now(), M.ActorKind.SYSTEM);
      requireRule(Output.isRegisteredInput(input) && validUuid(input.requestId));
      const messageId = this.dependencies.ids.derive(input.context.operatorId, input.requestId, 'events:' + operation + ':message');
      const hash = this.dependencies.fingerprint.hash(operation, input);

      return await this.dependencies.unitOfWork.run(input.context, async ports=>{
        const claim = await ports.commands.claim(input.context, input.requestId, operation, hash, input, [{purpose:'message', id:messageId}]);

        if (claim.kind === M.ClaimKind.REPLAY) {
          const outcome = claim.command.outcome;

          requireRule(outcome !== undefined, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

          if (!outcome) throw new EventsError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
          if (!outcome.ok) return outcome;
          requireRule(accept(outcome.value), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

          if (!accept(outcome.value)) throw new EventsError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

          return success(outcome.value);
        }
        if (claim.kind === M.ClaimKind.IN_PROGRESS) return failure(M.ErrorCode.IN_PROGRESS, input.context);

        const value = await work(ports, messageId);

        requireRule(accept(value), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
        const outcome = success(value);

        await ports.commands.complete(input.context, input.requestId, outcome);

        return outcome;
      });
    } catch(error) {return failure(error instanceof EventsError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context);}
  }
}
