import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import type { RequestWithdrawalPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerCommandDependencies } from '../services/financial-command.service.js';
import { FinancialCommandService } from '../services/financial-command.service.js';

export class RequestWithdrawalUseCase implements RequestWithdrawalPort {
  private readonly commands:FinancialCommandService;

  constructor(dependencies:ILedgerCommandDependencies) { this.commands = new FinancialCommandService(dependencies); }

  async execute(input:M.ILedgerRequestWithdrawalInput):Promise<M.IResult<M.ILedgerRequestWithdrawalOutput>> {
    const result = await this.commands.execute(input, 'RequestWithdrawal', M.Capability.WITHDRAW, undefined, ['context', 'requestId', 'walletId', 'withdrawalId', 'amount'], async (ports, prepared) => {
      if (!D.validUuid(input.walletId) || !D.validUuid(input.withdrawalId)) return D.failure(M.ErrorCode.INVALID_INPUT);

      const existing = await ports.withdrawals.find(input.context, input.withdrawalId);
      const wallet = await this.commands.wallet(ports, input.context, input.walletId);

      if (!wallet.ok) return wallet;

      const money = this.commands.checkMoney(input.context, input.amount, wallet.value.currency);

      if (!money.ok) return money;
      if (existing) {
        if (existing.walletId !== input.walletId || existing.amount.amountMinor !== input.amount.amountMinor || existing.amount.currency !== input.amount.currency) return D.failure(M.ErrorCode.IDEMPOTENCY_CONFLICT);
        if (existing.state !== M.WithdrawalState.HELD) return D.failure(M.ErrorCode.INVALID_STATE);

        return D.success({withdrawal:existing, outcome:{requestId:input.requestId, state:M.FinancialState.COMPLETED, transactionId:existing.holdTransactionId, businessRef:input.withdrawalId, wallet:wallet.value, replayed:true}});
      }

      const outcome = await this.commands.post(ports, input.context, wallet.value, prepared, input.requestId, M.TransactionType.WITHDRAWAL_HOLD, input.withdrawalId, input.amount.amountMinor);

      if (!outcome.ok) return outcome;

      const withdrawal = await ports.withdrawals.create(input.context, {withdrawalId:input.withdrawalId, walletId:input.walletId, amount:input.amount, state:M.WithdrawalState.HELD, holdTransactionId:prepared.transactionId, createdAt:prepared.occurredAt});

      return D.success({withdrawal, outcome:outcome.value});
    });

    if (!result.ok) return result;
    if ('withdrawal' in result.value && result.value.withdrawal !== undefined && 'outcome' in result.value) return D.success({withdrawal:result.value.withdrawal, outcome:result.value.outcome});

    return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
  }
}
