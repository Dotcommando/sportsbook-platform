import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import type { GetBetFinancialStatusPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerReadDependencies } from '../services/financial-query.service.js';
import { authorizeRead, validReservation } from '../services/financial-query.service.js';

export class GetBetFinancialStatusUseCase implements GetBetFinancialStatusPort {
  constructor(private readonly dependencies: ILedgerReadDependencies) { }

  async execute(input: M.ILedgerGetBetFinancialStatusInput): Promise<M.IResult<M.ILedgerGetBetFinancialStatusOutput>> {
    const authorization = authorizeRead(
      this.dependencies,
      input.context,
      input.context.actorKind === M.ActorKind.SERVICE
        ? (input.context.capabilities.includes(M.Capability.SETTLE_BET)
          ? M.Capability.SETTLE_BET
          : M.Capability.RESERVE_STAKE)
        : M.Capability.READ_WALLET,
    );

    if (!authorization.ok) {
      return authorization;
    }
    if (!(D.validUuid(input.betId))
      || Object.keys(input).some(key => !['context', 'betId'].includes(key))) {
      return D.failure(M.ErrorCode.INVALID_INPUT, input.context.correlationId);
    }

    try {
      const reservation = await this.dependencies.queries.getReservation(input.context, input.betId);

      if (reservation && (!validReservation(reservation) || reservation.betId !== input.betId)) {
        return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
      }

      return D.success(
        {
          observedAt: this.dependencies.clock.now(),
          ...(reservation === undefined ? {} : { reservation }),
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
