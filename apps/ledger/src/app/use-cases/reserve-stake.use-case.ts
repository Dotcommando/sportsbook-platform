import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import type { ReserveStakePort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerCommandDependencies } from '../services/financial-command.service.js';
import { FinancialCommandService } from '../services/financial-command.service.js';

export class ReserveStakeUseCase implements ReserveStakePort {
  private readonly commands: FinancialCommandService;

  constructor(dependencies: ILedgerCommandDependencies) {
    this.commands = new FinancialCommandService(dependencies);
  }

  async execute(input: M.ILedgerReserveStakeInput): Promise<M.IResult<M.ILedgerReserveStakeOutput>> {
    const result = await this.commands.execute(
      input,
      'ReserveStake',
      M.Capability.RESERVE_STAKE,
      M.ActorKind.SERVICE,
      ['context', 'requestId', 'walletId', 'betId', 'stake'],
      async (ports, prepared) => {
        if (!D.validUuid(input.walletId) || !D.validUuid(input.betId)) {
          return D.failure(M.ErrorCode.INVALID_INPUT);
        }

        const existing = await ports.reservations.find(input.context, input.betId);
        const wallet = await this.commands.wallet(ports, input.context, input.walletId);

        if (!wallet.ok) {
          return wallet;
        }

        const money = this.commands.checkMoney(input.context, input.stake, wallet.value.currency);

        if (!money.ok) {
          return money;
        }
        if (existing) {
          if (existing.walletId !== input.walletId || existing.stake.amountMinor !== input.stake.amountMinor
            || existing.stake.currency !== input.stake.currency) {
            return D.failure(M.ErrorCode.IDEMPOTENCY_CONFLICT);
          }
          if (existing.state !== M.ReservationState.RESERVED) {
            return D.failure(M.ErrorCode.INVALID_STATE);
          }

          return D.success(
            {
              reservation: existing,
              outcome: {
                requestId: input.requestId,
                state: M.FinancialState.COMPLETED,
                transactionId: existing.reservationTransactionId,
                businessRef: input.betId,
                wallet: wallet.value,
                replayed: true,
              },
            },
          );
        }

        const outcome = await this.commands.post(
          ports,
          input.context,
          wallet.value,
          prepared,
          input.requestId,
          M.TransactionType.RESERVE_STAKE,
          input.betId,
          input.stake.amountMinor,
        );

        if (!outcome.ok) {
          return outcome;
        }

        const reservation = await ports.reservations.create(
          input.context,
          {
            betId: input.betId,
            walletId: input.walletId,
            stake: input.stake,
            state: M.ReservationState.RESERVED,
            reservationTransactionId: prepared.transactionId,
          },
        );

        return D.success({ reservation, outcome: outcome.value });
      },
    );

    if (!result.ok) {
      return result;
    }
    if ('reservation' in result.value && result.value.reservation !== undefined
      && 'outcome' in result.value) {
      return D.success({ reservation: result.value.reservation, outcome: result.value.outcome });
    }

    return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
  }
}
