import * as M from './betting.model.js';
import {failure, success} from './betting.policy.js';

export const MAX_MINOR = 9223372036854775807n;

export class Money {
  private constructor(readonly amountMinor:bigint, readonly currency:string) {}

  static create(amountMinor:bigint, currency:string):M.IResult<Money> {
    if (typeof amountMinor !== 'bigint' || amountMinor < 0n || amountMinor > MAX_MINOR) return failure(M.ErrorCode.AMOUNT_OUT_OF_RANGE);
    if (!/^[A-Z]{3}$/.test(currency)) return failure(M.ErrorCode.INVALID_INPUT);

    return success(new Money(amountMinor, currency));
  }
}

export function grossPayout(stake:bigint, odds:string):M.IResult<bigint> {
  if (typeof stake !== 'bigint' || stake <= 0n || stake > MAX_MINOR) return failure(M.ErrorCode.AMOUNT_OUT_OF_RANGE);
  if (!/^(?:[1-9]\d{0,3})(?:\.\d{1,8})?$/.test(odds)) return failure(M.ErrorCode.INVALID_INPUT);

  const [integer, fraction = ''] = odds.split('.');const scaled = BigInt(integer ?? '') * 100000000n + BigInt(fraction.padEnd(8, '0'));

  if (scaled <= 100000000n || scaled > 100000000000n) return failure(M.ErrorCode.INVALID_INPUT);

  const payout = stake * scaled / 100000000n;

  return payout > MAX_MINOR ? failure(M.ErrorCode.AMOUNT_OUT_OF_RANGE) : success(payout);
}
