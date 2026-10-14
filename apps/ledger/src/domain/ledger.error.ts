import type { IError, IResult, UUID } from './ledger.model.js';
import { ErrorCode } from './ledger.model.js';

export const MIN_INT64 = -9223372036854775808n;

export const MAX_INT64 = 9223372036854775807n;

export const DOMAIN_CORRELATION_ID = '00000000-0000-4000-8000-000000000001';

export function success<T>(value: T): IResult<T> { return { ok: true, value }; }

export function failure(code: ErrorCode, correlationId: UUID = DOMAIN_CORRELATION_ID, retryable = false, outcomeUnknown = false): {ok: false; error: IError} {
  return { ok: false, error: { code, message: code, correlationId:validUuid(correlationId) ? correlationId : DOMAIN_CORRELATION_ID, retryable, outcomeUnknown } };
}

export class LedgerError extends Error {
  constructor(readonly code: ErrorCode) { super(code); }
}

export function validUuid(value: unknown): value is UUID {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) && value !== '00000000-0000-0000-0000-000000000000';
}

export function validInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const parsed = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);

  if (!parsed) return false;

  const year = Number(parsed[1]), month = Number(parsed[2]), day = Number(parsed[3]), hour = Number(parsed[4]), minute = Number(parsed[5]), second = Number(parsed[6]);
  const calendar = new Date(0);

  calendar.setUTCFullYear(year, month - 1, day);

  return month >= 1 && month <= 12 && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day && hour < 24 && minute < 60 && second < 60 && Number(parsed[7] ?? 0) < 24 && Number(parsed[8] ?? 0) < 60 && Number.isFinite(Date.parse(value));
}

export function checkedInt64(value: bigint): bigint {
  if (value < MIN_INT64 || value > MAX_INT64) throw new LedgerError(ErrorCode.AMOUNT_OUT_OF_RANGE);

  return value;
}
