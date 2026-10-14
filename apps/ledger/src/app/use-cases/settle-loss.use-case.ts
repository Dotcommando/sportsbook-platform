import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import { ReservationPolicy } from '../../domain/reservation.policy.js';
import type { SettleLossPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerCommandDependencies } from '../services/financial-command.service.js';
import { FinancialCommandService } from '../services/financial-command.service.js';

export class SettleLossUseCase implements SettleLossPort {
  private readonly commands:FinancialCommandService;

  constructor(dependencies:ILedgerCommandDependencies) { this.commands = new FinancialCommandService(dependencies); }

  async execute(input:M.ILedgerSettleLossInput):Promise<M.IResult<M.ILedgerSettleLossOutput>> {
    const result = await this.commands.execute(input, 'SettleLoss', M.Capability.SETTLE_BET, M.ActorKind.SERVICE, ['context', 'requestId', 'betId', 'settlementSeq'], async (ports, prepared) => {
      if (!D.validUuid(input.betId) || typeof input.settlementSeq !== 'bigint' || input.settlementSeq <= 0n || input.settlementSeq > D.MAX_INT64) return D.failure(M.ErrorCode.INVALID_INPUT);

      const reservation = await ports.reservations.find(input.context, input.betId);

      if (!reservation) return D.failure(M.ErrorCode.NOT_FOUND);
      if (reservation.state !== M.ReservationState.RESERVED) return D.failure(M.ErrorCode.INVALID_STATE);

      const wallet = await this.commands.wallet(ports, input.context, reservation.walletId);

      if (!wallet.ok) return wallet;
      
      const amount = reservation.stake.amountMinor;
      const transition = ReservationPolicy.settle(reservation, M.ReservationState.LOST, prepared.transactionId, 0n, input.settlementSeq);

      if (!transition.ok) return transition;

      const outcome = await this.commands.post(ports, input.context, wallet.value, prepared, input.requestId, M.TransactionType.SETTLE_LOSS, input.betId, amount);

      if (!outcome.ok) return outcome;

      const next = await ports.reservations.transition(input.context, input.betId, M.ReservationState.RESERVED, transition.value);

      return D.success({reservation:next, outcome:outcome.value});
    });

    if (!result.ok) return result;
    if ('reservation' in result.value && result.value.reservation !== undefined && 'outcome' in result.value) return D.success({reservation:result.value.reservation, outcome:result.value.outcome});

    return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
  }
}
