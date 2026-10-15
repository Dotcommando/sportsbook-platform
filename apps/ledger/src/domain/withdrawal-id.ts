import { failure, success, validUuid } from './ledger.error.js';
import type { IResult, UUID } from './ledger.model.js';
import { ErrorCode } from './ledger.model.js';

export class WithdrawalId {
  private constructor(private readonly value: UUID) { }

  static parse(value: string): IResult<WithdrawalId> {
    return validUuid(value) ? success(new WithdrawalId(value)) : failure(ErrorCode.INVALID_INPUT);
  }

  toString(): UUID {
    return this.value;
  }

  equals(other: WithdrawalId): boolean {
    return this.value === other.value;
  }
}
