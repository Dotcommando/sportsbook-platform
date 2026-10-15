import { CapabilityPolicy } from '../../domain/capability.policy.js';
import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import type { GetBalancePort } from '../../ports/inbound/ledger-operations.port.js';
import { validWallet } from '../services/financial-command.service.js';
import type { ILedgerReadDependencies } from '../services/financial-query.service.js';
import { authorizeRead } from '../services/financial-query.service.js';

export class GetBalanceUseCase implements GetBalancePort {
  constructor(private readonly dependencies: ILedgerReadDependencies) { }

  async execute(input: M.ILedgerGetBalanceInput): Promise<M.IResult<M.ILedgerGetBalanceOutput>> {
    const authorization = authorizeRead(this.dependencies, input.context, M.Capability.READ_WALLET);

    if (!authorization.ok) {
      return authorization;
    }
    if (!(D.validUuid(input.walletId)) || Object.keys(input).some(key => !['context', 'walletId'].includes(key))) {
      return D.failure(M.ErrorCode.INVALID_INPUT, input.context.correlationId);
    }

    try {
      const wallet = await this.dependencies.queries.getBalance(input.context, input.walletId);

      if (!wallet) {
        return D.failure(M.ErrorCode.NOT_FOUND, input.context.correlationId);
      }
      if (!validWallet(wallet) || wallet.walletId !== input.walletId) {
        return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
      }

      const scope = CapabilityPolicy.authorize(input.context, M.Capability.READ_WALLET, wallet.playerId);

      return scope.ok ? D.success({ wallet }) : scope;
    } catch (error) {
      if (error instanceof D.LedgerError) {
        return D.failure(error.code, input.context.correlationId);
      }

      return D.failure(M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context.correlationId, true);
    }
  }
}
