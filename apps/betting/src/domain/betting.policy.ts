import * as M from './betting.model.js';

export class BettingError extends Error {
  constructor(readonly code: M.ErrorCode, readonly outcomeUnknown = false) {
    super(code);
  }
}

export function requireRule(condition: boolean, code = M.ErrorCode.INVALID_INPUT): void {
  if (!condition) {
    throw new BettingError(code);
  }
}

export function validUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
    && value !== '00000000-0000-0000-0000-000000000000';
}

export function validInstant(value: unknown): value is string {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) {
    return false;
  }

  const date = new Date(value.slice(0, 19) + 'Z');

  return date.toISOString().slice(0, 19) === value.slice(0, 19);
}

export function success<T>(value: T): M.IResult<T> {
  return { ok: true, value };
}

export function failure(
  code: M.ErrorCode,
  context: M.ICallContext | undefined = undefined,
  unknown = false,
): { ok: false; error: M.IError } {
  return {
    ok: false,
    error: {
      code,
      message: code,
      correlationId: context?.correlationId ?? '00000000-0000-4000-8000-000000000001',
      retryable: [M.ErrorCode.DEPENDENCY_UNAVAILABLE, M.ErrorCode.DEADLINE_EXCEEDED].includes(code),
      outcomeUnknown: unknown,
    },
  };
}

export function operator(
  settings: readonly M.IBettingOperatorSettings[],
  context: M.ICallContext,
  capability: M.Capability,
  now: string,
  kind?: M.ActorKind,
): M.IBettingOperatorSettings {
  requireRule(
    validUuid(context.operatorId) && validUuid(context.actorId) && validUuid(context.correlationId)
    && validInstant(context.deadlineAt),
    M.ErrorCode.UNAUTHENTICATED,
  );
  requireRule(Date.parse(context.deadlineAt) > Date.parse(now), M.ErrorCode.DEADLINE_EXCEEDED);
  const result = settings.find(item => item.operatorId === context.operatorId);

  requireRule(result !== undefined, M.ErrorCode.PERMISSION_DENIED);

  if (!result) {
    throw new BettingError(M.ErrorCode.PERMISSION_DENIED);
  }
  requireRule(
    context.capabilities.includes(capability) && (!kind || kind === context.actorKind),
    M.ErrorCode.PERMISSION_DENIED,
  );

  if (context.actorKind === M.ActorKind.PLAYER) {
    requireRule(context.actorId === context.playerId, M.ErrorCode.PERMISSION_DENIED);
  } else {
    requireRule(
      result.trustedActors.some(
        actor =>
          actor.actorId === context.actorId && actor.actorKind === context.actorKind
          && actor.capabilities.includes(capability),
      ),
      M.ErrorCode.PERMISSION_DENIED,
    );
  }

  return result;
}
