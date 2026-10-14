import { failure, success, validUuid } from './ledger.error.js';
import type { IResult, UUID } from './ledger.model.js';
import { ErrorCode } from './ledger.model.js';

export class BetId {
  private constructor(private readonly value:UUID) {}

  static parse(value:string):IResult<BetId> { return validUuid(value) ? success(new BetId(value)) : failure(ErrorCode.INVALID_INPUT); }

  toString():UUID { return this.value; }

  equals(other:BetId):boolean { return this.value === other.value; }
}
