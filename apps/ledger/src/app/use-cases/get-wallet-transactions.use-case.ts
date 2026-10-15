import { CapabilityPolicy } from '../../domain/capability.policy.js';
import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import { PostingPolicy } from '../../domain/posting.policy.js';
import type { GetWalletTransactionsPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerReadDependencies } from '../services/financial-query.service.js';
import { authorizeRead, validPage } from '../services/financial-query.service.js';

export class GetWalletTransactionsUseCase implements GetWalletTransactionsPort {
  constructor(private readonly dependencies: ILedgerReadDependencies) { }

  async execute(input: M.ILedgerGetWalletTransactionsInput): Promise<M.IResult<M.ILedgerGetWalletTransactionsOutput>> {
    const authorization = authorizeRead(this.dependencies, input.context, M.Capability.READ_JOURNAL);

    if (!authorization.ok) {
      return authorization;
    }
    if (!(D.validUuid(input.walletId) && validPage(input.page))
      || Object.keys(input).some(key => !['context', 'walletId', 'page'].includes(key))) {
      return D.failure(M.ErrorCode.INVALID_INPUT, input.context.correlationId);
    }

    try {
      const wallet = await this.dependencies.queries.getBalance(input.context, input.walletId);

      if (!wallet) {
        return D.failure(M.ErrorCode.NOT_FOUND, input.context.correlationId);
      }

      const scope = CapabilityPolicy.authorize(input.context, M.Capability.READ_JOURNAL, wallet.playerId);

      if (!scope.ok) {
        return scope;
      }

      const page = await this.dependencies.queries.listTransactions(input.context, input.walletId, input.page);

      if (!D.validInstant(page.observedAt) || page.items.length > input.page.limit
        || page.items.some(transaction => !PostingPolicy.validate(transaction).ok)) {
        return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
      }

      return D.success(
        {
          transactions: page.items,
          observedAt: page.observedAt,
          ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
        },
      );
    } catch (error) {
      if (error instanceof D.LedgerError) {
        return D.failure(error.code, input.context.correlationId);
      }

      return D.failure(M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context.correlationId, true);
    }
  }
}
