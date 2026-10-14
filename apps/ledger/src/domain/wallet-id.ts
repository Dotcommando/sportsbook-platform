import { failure, success, validUuid } from './ledger.error.js';
import type { IResult, UUID } from './ledger.model.js';
import { ErrorCode } from './ledger.model.js';

export class WalletId {
  private constructor(private readonly value:UUID) {}

  static parse(value:string):IResult<WalletId> { return validUuid(value) ? success(new WalletId(value)) : failure(ErrorCode.INVALID_INPUT); }

  toString():UUID { return this.value; }

  equals(other:WalletId):boolean { return this.value === other.value; }
}
