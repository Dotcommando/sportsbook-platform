import { failure, MAX_INT64, success, validUuid } from './ledger.error.js';
import type { IReservationView, IResult, UUID } from './ledger.model.js';
import { ErrorCode, ReservationState } from './ledger.model.js';

export class ReservationPolicy {
  static settle(current: IReservationView, state: ReservationState, transactionId: UUID, payout: bigint, sequence?: bigint): IResult<IReservationView> {
    if (current.state !== ReservationState.RESERVED || state === ReservationState.RESERVED) return failure(ErrorCode.INVALID_STATE);
    if (!validUuid(transactionId) || payout < 0n || payout > MAX_INT64) return failure(ErrorCode.INVALID_INPUT);
    if (state === ReservationState.WON && payout < current.stake.amountMinor) return failure(ErrorCode.INVALID_INPUT);
    if (state === ReservationState.LOST && payout !== 0n) return failure(ErrorCode.INVALID_INPUT);
    if (state === ReservationState.CANCELED && payout !== current.stake.amountMinor) return failure(ErrorCode.INVALID_INPUT);
    if (state !== ReservationState.CANCELED && (sequence === undefined || sequence <= 0n || sequence > MAX_INT64)) return failure(ErrorCode.INVALID_INPUT);

    return success({ ...current, state, settlementTransactionId: transactionId, grossPayoutMinor: payout, ...(sequence === undefined ? {} : { settlementSeq: sequence }) });
  }
}
