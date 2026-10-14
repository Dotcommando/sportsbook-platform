import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import type { GetWithdrawalPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerReadDependencies } from '../services/financial-query.service.js';
import { authorizeRead, validWithdrawal } from '../services/financial-query.service.js';

export class GetWithdrawalUseCase implements GetWithdrawalPort {
  constructor(private readonly dependencies:ILedgerReadDependencies) {}

  async execute(input:M.ILedgerGetWithdrawalInput):Promise<M.IResult<M.ILedgerGetWithdrawalOutput>> {
    const authorization = authorizeRead(this.dependencies, input.context, input.context.actorKind === M.ActorKind.SYSTEM ? M.Capability.PAYMENT_SIMULATOR : M.Capability.READ_WALLET);

    if (!authorization.ok) return authorization;
    if (!(D.validUuid(input.withdrawalId)) || Object.keys(input).some(key=>!['context', 'withdrawalId'].includes(key))) return D.failure(M.ErrorCode.INVALID_INPUT, input.context.correlationId);

    try {
      const withdrawal = await this.dependencies.queries.getWithdrawal(input.context, input.withdrawalId);

      if (!withdrawal) return D.failure(M.ErrorCode.NOT_FOUND, input.context.correlationId);
      if (!validWithdrawal(withdrawal) || withdrawal.withdrawalId !== input.withdrawalId) return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);

      return D.success({withdrawal});
    } catch(error) {
      if (error instanceof D.LedgerError) return D.failure(error.code, input.context.correlationId);

      return D.failure(M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context.correlationId, true);
    }
  }
}
