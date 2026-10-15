import { failure, success, validUuid } from './ledger.error.js';
import type { IResult, UUID } from './ledger.model.js';
import { ErrorCode } from './ledger.model.js';

export class AccountId {
  private constructor(private readonly value: UUID) { }

  static parse(value: string): IResult<AccountId> {
    return validUuid(value) ? success(new AccountId(value)) : failure(ErrorCode.INVALID_INPUT);
  }

  toString(): UUID {
    return this.value;
  }

  equals(other: AccountId): boolean {
    return this.value === other.value;
  }
}
