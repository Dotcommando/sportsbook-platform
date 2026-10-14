import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import type { GetCommandOutcomePort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerReadDependencies } from '../services/financial-query.service.js';
import { authorizeRead } from '../services/financial-query.service.js';

export class GetCommandOutcomeUseCase implements GetCommandOutcomePort {
  constructor(private readonly dependencies:ILedgerReadDependencies) {}

  async execute(input:M.ILedgerGetCommandOutcomeInput):Promise<M.IResult<M.ILedgerGetCommandOutcomeOutput>> {
    const authorization = authorizeRead(this.dependencies, input.context, input.context.capabilities[0] ?? M.Capability.READ_WALLET);

    if (!authorization.ok) return authorization;
    if (!(D.validUuid(input.requestId)) || Object.keys(input).some(key=>!['context', 'requestId'].includes(key))) return D.failure(M.ErrorCode.INVALID_INPUT, input.context.correlationId);

    try {
      const command = await this.dependencies.queries.getCommandOutcome(input.context, input.requestId);

      if (!command) return D.success({found:false});
      if (command.requestId !== input.requestId || !Object.values(M.CommandState).includes(command.state) || (command.state !== M.CommandState.IN_PROGRESS && !command.outcome)) return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);

      return D.success({found:true, operation:command.operation, state:command.state, ...(command.outcome === undefined ? {} : {result:command.outcome})});
    } catch(error) {
      if (error instanceof D.LedgerError) return D.failure(error.code, input.context.correlationId);

      return D.failure(M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context.correlationId, true);
    }
  }
}
