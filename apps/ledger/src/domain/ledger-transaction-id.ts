import { failure, success, validUuid } from './ledger.error.js';
import type { IResult, UUID } from './ledger.model.js';
import { ErrorCode } from './ledger.model.js';

export class LedgerTransactionId {
  private constructor(private readonly value:UUID) {}

  static parse(value:string):IResult<LedgerTransactionId> { return validUuid(value) ? success(new LedgerTransactionId(value)) : failure(ErrorCode.INVALID_INPUT); }

  toString():UUID { return this.value; }

  equals(other:LedgerTransactionId):boolean { return this.value === other.value; }
}
