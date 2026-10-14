import { CapabilityPolicy } from '../../domain/capability.policy.js';
import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import type { GetWalletPort } from '../../ports/inbound/ledger-operations.port.js';
import { validWallet } from '../services/financial-command.service.js';
import type { ILedgerReadDependencies } from '../services/financial-query.service.js';
import { authorizeRead } from '../services/financial-query.service.js';

export class GetWalletUseCase implements GetWalletPort {
  constructor(private readonly dependencies:ILedgerReadDependencies) {}

  async execute(input:M.ILedgerGetWalletInput):Promise<M.IResult<M.ILedgerGetWalletOutput>> {
    const authorization = authorizeRead(this.dependencies, input.context, M.Capability.READ_WALLET);

    if (!authorization.ok) return authorization;
    if (!(D.validUuid(input.playerId) && /^[A-Z]{3}$/.test(input.currency)) || Object.keys(input).some(key=>!['context', 'playerId', 'currency'].includes(key))) return D.failure(M.ErrorCode.INVALID_INPUT, input.context.correlationId);

    try {
      const scope = CapabilityPolicy.authorize(input.context, M.Capability.READ_WALLET, input.playerId);

      if (!scope.ok) return scope;

      const wallet = await this.dependencies.queries.getWallet(input.context, input.playerId, input.currency);

      if (!wallet) return D.failure(M.ErrorCode.NOT_FOUND, input.context.correlationId);
      if (!validWallet(wallet) || wallet.playerId !== input.playerId || wallet.currency !== input.currency) return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);

      return D.success({wallet});
    } catch(error) {
      if (error instanceof D.LedgerError) return D.failure(error.code, input.context.correlationId);

      return D.failure(M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context.correlationId, true);
    }
  }
}
