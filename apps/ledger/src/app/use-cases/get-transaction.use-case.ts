import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import { PostingPolicy } from '../../domain/posting.policy.js';
import type { GetTransactionPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerReadDependencies } from '../services/financial-query.service.js';
import { authorizeRead } from '../services/financial-query.service.js';

export class GetTransactionUseCase implements GetTransactionPort {
  constructor(private readonly dependencies:ILedgerReadDependencies) {}

  async execute(input:M.ILedgerGetTransactionInput):Promise<M.IResult<M.ILedgerGetTransactionOutput>> {
    const authorization = authorizeRead(this.dependencies, input.context, M.Capability.READ_JOURNAL);

    if (!authorization.ok) return authorization;
    if (!(D.validUuid(input.transactionId)) || Object.keys(input).some(key=>!['context', 'transactionId'].includes(key))) return D.failure(M.ErrorCode.INVALID_INPUT, input.context.correlationId);

    try {
      const transaction = await this.dependencies.queries.getTransaction(input.context, input.transactionId);

      if (!transaction) return D.failure(M.ErrorCode.NOT_FOUND, input.context.correlationId);
      if (transaction.transactionId !== input.transactionId || !PostingPolicy.validate(transaction).ok) return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);

      return D.success({transaction});
    } catch(error) {
      if (error instanceof D.LedgerError) return D.failure(error.code, input.context.correlationId);

      return D.failure(M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context.correlationId, true);
    }
  }
}
