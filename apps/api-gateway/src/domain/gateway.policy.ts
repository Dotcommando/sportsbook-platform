import * as M from './gateway.model.js';

export class GatewayError extends Error {
  constructor(readonly code: M.ErrorCode, readonly detail?: M.IError) {
    super(code);
  }
}

export function requireRule(test: boolean, code = M.ErrorCode.INVALID_INPUT): void {
  if (!test) {
    throw new GatewayError(code);
  }
}

export function validUuid(v: unknown): v is string {
  return typeof v === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
    && v !== '00000000-0000-0000-0000-000000000000';
}

export function validInstant(v: unknown): v is string {
  if (typeof v !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.test(v)
    || !Number.isFinite(Date.parse(v))) {
    return false;
  }

  return new Date(v.slice(0, 19) + 'Z').toISOString().slice(0, 19) === v.slice(0, 19);
}

export function page(p: M.IPageInput): void {
  requireRule(
    Number.isInteger(p.limit) && p.limit >= 1 && p.limit <= 200
    && (p.cursor === undefined
      || typeof p.cursor === 'string' && p.cursor.length > 0 && p.cursor.length <= 4096)
    && (p.from === undefined || validInstant(p.from))
    && (p.to === undefined || validInstant(p.to))
    && !(p.from && p.to && Date.parse(p.from) > Date.parse(p.to)),
  );
}

export function currency(settings: M.IGatewayOperatorSettings, v: string): void {
  requireRule(settings.currencies.includes(v), M.ErrorCode.CURRENCY_MISMATCH);
}

export function amount(settings: M.IGatewayOperatorSettings, m: M.IMoney): void {
  currency(settings, m.currency);
  requireRule(
    typeof m.amountMinor === 'bigint' && m.amountMinor > 0n
    && m.amountMinor <= 9223372036854775807n,
    M.ErrorCode.AMOUNT_OUT_OF_RANGE,
  );
}

export function failure(error: unknown, context: M.ICallContext, mutates = false): { ok: false; error: M.IError } {
  const detail = error instanceof GatewayError ? error.detail : undefined;
  const code = error instanceof GatewayError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE;

  return {
    ok: false,
    error: detail
      ?? {
        code,
        message: code,
        correlationId: context.correlationId,
        retryable: code === M.ErrorCode.DEPENDENCY_UNAVAILABLE || code === M.ErrorCode.DEADLINE_EXCEEDED,
        outcomeUnknown: !(error instanceof GatewayError) && mutates,
      },
  };
}
