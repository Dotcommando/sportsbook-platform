import { failure, success } from './ledger.error.js';
import type { CurrencyCode, IResult } from './ledger.model.js';
import { ErrorCode } from './ledger.model.js';

export class Currency {
  private constructor(private readonly code: CurrencyCode) {}

  static parse(value: string, enabledCurrencies: CurrencyCode[]): IResult<Currency> {
    if (!/^[A-Z]{3}$/.test(value) || !enabledCurrencies.includes(value)) return failure(ErrorCode.CURRENCY_MISMATCH);

    return success(new Currency(value));
  }

  toCode(): CurrencyCode { return this.code; }

  equals(other: Currency): boolean { return this.code === other.code; }
}
