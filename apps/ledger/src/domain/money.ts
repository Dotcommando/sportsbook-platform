import type { Currency } from './currency.js';
import { failure, MAX_INT64, MIN_INT64, success } from './ledger.error.js';
import type { IResult } from './ledger.model.js';
import { ErrorCode } from './ledger.model.js';

export class Money {
  private constructor(private readonly amountMinor: bigint, readonly currency: Currency) {}

  static create(amountMinor: bigint, currency: Currency): IResult<Money> {
    if (typeof amountMinor !== 'bigint' || amountMinor < MIN_INT64 || amountMinor > MAX_INT64) return failure(ErrorCode.AMOUNT_OUT_OF_RANGE);

    return success(new Money(amountMinor, currency));
  }

  add(other: Money): IResult<Money> {
    if (!this.currency.equals(other.currency)) return failure(ErrorCode.CURRENCY_MISMATCH);

    return Money.create(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): IResult<Money> {
    if (!this.currency.equals(other.currency)) return failure(ErrorCode.CURRENCY_MISMATCH);

    return Money.create(this.amountMinor - other.amountMinor, this.currency);
  }

  toMinorUnits(): bigint { return this.amountMinor; }

  equals(other: Money): boolean { return this.amountMinor === other.amountMinor && this.currency.equals(other.currency); }
}
