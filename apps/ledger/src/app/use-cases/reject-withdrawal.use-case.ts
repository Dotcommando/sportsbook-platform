import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import { WithdrawalPolicy } from '../../domain/withdrawal.policy.js';
import type { RejectWithdrawalPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerCommandDependencies } from '../services/financial-command.service.js';
import { FinancialCommandService } from '../services/financial-command.service.js';

export class RejectWithdrawalUseCase implements RejectWithdrawalPort {
  private readonly commands: FinancialCommandService;

  constructor(dependencies: ILedgerCommandDependencies) {
    this.commands = new FinancialCommandService(dependencies);
  }

  async execute(input: M.ILedgerRejectWithdrawalInput): Promise<M.IResult<M.ILedgerRejectWithdrawalOutput>> {
    const result = await this.commands.execute(
      input,
      'RejectWithdrawal',
      M.Capability.PAYMENT_SIMULATOR,
      M.ActorKind.SYSTEM,
      ['context', 'requestId', 'withdrawalId', 'reasonCode'],
      async (ports, prepared) => {
        if (!D.validUuid(input.withdrawalId)) {
          return D.failure(M.ErrorCode.INVALID_INPUT);
        }
        if (!this.commands.policy(input.context)?.rejectionReasons.includes(input.reasonCode)
          || !/^[A-Z][A-Z0-9_]{0,63}$/.test(input.reasonCode)) {
          return D.failure(M.ErrorCode.INVALID_INPUT);
        }

        const withdrawal = await ports.withdrawals.find(input.context, input.withdrawalId);

        if (!withdrawal) {
          return D.failure(M.ErrorCode.NOT_FOUND);
        }
        if (withdrawal.state !== M.WithdrawalState.HELD) {
          return D.failure(M.ErrorCode.INVALID_STATE);
        }

        const wallet = await this.commands.wallet(ports, input.context, withdrawal.walletId);

        if (!wallet.ok) {
          return wallet;
        }

        const transition = WithdrawalPolicy.resolve(
          withdrawal,
          M.WithdrawalState.REJECTED,
          prepared.transactionId,
          prepared.occurredAt,
          input.reasonCode,
        );

        if (!transition.ok) {
          return transition;
        }

        const outcome = await this.commands.post(
          ports,
          input.context,
          wallet.value,
          prepared,
          input.requestId,
          M.TransactionType.WITHDRAWAL_REJECT,
          input.withdrawalId,
          withdrawal.amount.amountMinor,
        );

        if (!outcome.ok) {
          return outcome;
        }

        const next = await ports.withdrawals.transition(
          input.context,
          input.withdrawalId,
          M.WithdrawalState.HELD,
          transition.value,
        );

        await ports.outbox.append(
          input.context,
          {
            messageId: this.commands.dependencies.ids.derive(
              input.context.operatorId,
              input.requestId,
              'ledger:event:withdrawal-resolved',
            ),
            source: M.EventSource.LEDGER,
            eventType: M.EventType.WITHDRAWAL_RESOLVED,
            schemaVersion: 1,
            operatorId: input.context.operatorId,
            correlationId: input.context.correlationId,
            occurredAt: prepared.occurredAt,
            payload: {
              withdrawalId: next.withdrawalId,
              walletId: next.walletId,
              state: next.state,
              resolutionTransactionId: prepared.transactionId,
            },
          },
        );

        return D.success({ withdrawal: next, outcome: outcome.value });
      },
    );

    if (!result.ok) {
      return result;
    }
    if ('withdrawal' in result.value && result.value.withdrawal !== undefined
      && 'outcome' in result.value) {
      return D.success({ withdrawal: result.value.withdrawal, outcome: result.value.outcome });
    }

    return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
  }
}
