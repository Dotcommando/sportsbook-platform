import { failure, success, validInstant, validUuid } from './ledger.error.js';
import type { IResult, IWithdrawalView, UUID } from './ledger.model.js';
import { ErrorCode, WithdrawalState } from './ledger.model.js';

export class WithdrawalPolicy {
  static resolve(
    current: IWithdrawalView,
    state: WithdrawalState,
    transactionId: UUID,
    now: string,
    reference: string,
  ): IResult<IWithdrawalView> {
    if (current.state !== WithdrawalState.HELD || state === WithdrawalState.HELD) {
      return failure(ErrorCode.INVALID_STATE);
    }
    if (!validUuid(transactionId) || !validInstant(now)) {
      return failure(ErrorCode.INVALID_INPUT);
    }
    if (state === WithdrawalState.COMPLETED) {
      if (reference.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._-]*:[A-Za-z0-9._:-]+$/.test(reference)) {
        return failure(ErrorCode.INVALID_INPUT);
      }

      return success(
        {
          ...current,
          state,
          resolutionTransactionId: transactionId,
          resolvedAt: now,
          providerRef: reference,
        },
      );
    }
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(reference)) {
      return failure(ErrorCode.INVALID_INPUT);
    }

    return success(
      {
        ...current,
        state,
        resolutionTransactionId: transactionId,
        resolvedAt: now,
        reasonCode: reference,
      },
    );
  }
}
