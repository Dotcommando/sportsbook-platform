import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import type { DepositTestFundsPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerCommandDependencies } from '../services/financial-command.service.js';
import { FinancialCommandService } from '../services/financial-command.service.js';

export class DepositTestFundsUseCase implements DepositTestFundsPort {
  private readonly commands:FinancialCommandService;

  constructor(dependencies:ILedgerCommandDependencies) { this.commands = new FinancialCommandService(dependencies); }

  async execute(input:M.ILedgerDepositTestFundsInput):Promise<M.IResult<M.ILedgerDepositTestFundsOutput>> {
    const result = await this.commands.execute(input, 'DepositTestFunds', M.Capability.FUND_SYNTHETIC, M.ActorKind.SYSTEM, ['context', 'requestId', 'walletId', 'amount', 'providerRef'], async (ports, prepared) => {
      if (!D.validUuid(input.walletId)) return D.failure(M.ErrorCode.INVALID_INPUT);

      const provider = this.commands.checkProvider(input.context, input.providerRef);

      if (!provider.ok) return provider;

      const wallet = await this.commands.wallet(ports, input.context, input.walletId);

      if (!wallet.ok) return wallet;

      const money = this.commands.checkMoney(input.context, input.amount, wallet.value.currency);

      if (!money.ok) return money;

      const outcome = await this.commands.post(ports, input.context, wallet.value, prepared, input.requestId, M.TransactionType.DEPOSIT, input.providerRef, input.amount.amountMinor);

      return outcome.ok ? D.success({outcome:outcome.value}) : outcome;
    });

    if (!result.ok) return result;
    if ('outcome' in result.value) return D.success({outcome:result.value.outcome});

    return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
  }
}
