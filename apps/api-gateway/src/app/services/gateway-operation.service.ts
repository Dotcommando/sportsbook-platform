import * as M from '../../domain/gateway.model.js';
import { GatewayError, requireRule, validInstant, validUuid } from '../../domain/gateway.policy.js';
import * as Output from '../../domain/gateway-output.policy.js';
import type { ClockPort } from '../../ports/outbound/gateway.port.js';

export interface IGatewayPolicy {
  operators: readonly M.IGatewayOperatorSettings[];
  clock: ClockPort;
}

export function authorize(
  d: IGatewayPolicy,
  c: M.ICallContext,
  cap: M.Capability,
  own = true,
): M.IGatewayOperatorSettings {
  requireRule(
    validUuid(c.operatorId) && validUuid(c.actorId) && validUuid(c.correlationId)
    && validInstant(c.deadlineAt),
    M.ErrorCode.UNAUTHENTICATED,
  );
  requireRule(
    Date.parse(c.deadlineAt) > Date.parse(d.clock.now()),
    M.ErrorCode.DEADLINE_EXCEEDED,
  );
  const op = d.operators.find(o => o.operatorId === c.operatorId);

  if (!op) {
    throw new GatewayError(M.ErrorCode.PERMISSION_DENIED);
  }
  requireRule(c.capabilities.includes(cap), M.ErrorCode.PERMISSION_DENIED);

  if (own) {
    requireRule(
      c.actorKind === M.ActorKind.PLAYER && c.playerId === c.actorId,
      M.ErrorCode.PERMISSION_DENIED,
    );
  } else if (c.actorKind !== M.ActorKind.PLAYER) {
    requireRule(
      op.trustedRegistrationActors.some(a => a.actorId === c.actorId && a.actorKind === c.actorKind),
      M.ErrorCode.PERMISSION_DENIED,
    );
  }

  return op;
}

export function owner(c: M.ICallContext): string {
  requireRule(validUuid(c.playerId), M.ErrorCode.UNAUTHENTICATED);

  if (!c.playerId) {
    throw new GatewayError(M.ErrorCode.UNAUTHENTICATED);
  }

  return c.playerId;
}

export async function checked<T>(work: Promise<M.IResult<T>>, guard: (v: unknown) => v is T): Promise<T> {
  const result = await work;

  if (!result || typeof result !== 'object') {
    throw new GatewayError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }
  if (!result.ok) {
    requireRule(Output.isIError(result.error), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
    throw new GatewayError(result.error.code, result.error);
  }
  requireRule(guard(result.value), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

  return result.value;
}

export function profile(c: M.ICallContext, p: M.IProfile): void {
  requireRule(p.playerId === owner(c), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
}

export function wallet(c: M.ICallContext, w: M.IWalletView, currency: string): void {
  requireRule(
    w.playerId === owner(c) && w.currency === currency && w.availableMinor >= 0n
    && w.reservedMinor >= 0n
    && w.withdrawalHoldMinor >= 0n
    && w.version >= 1n,
    M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
  );
}

export function bet(c: M.ICallContext, b: M.IBetView, id?: string): void {
  requireRule(
    b.playerId === owner(c) && (id === undefined || b.betId === id) && b.type === M.BetType.SINGLE
    && b.legs.length === 1,
    M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
  );
}

export function eligibility(d: IGatewayPolicy, e: M.IEligibility): void {
  requireRule(
    Date.parse(e.evaluatedAt) <= Date.parse(d.clock.now())
    && (e.validUntil === undefined || Date.parse(e.validUntil) > Date.parse(d.clock.now())),
    M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
  );
  requireRule(e.allowed && e.reasonCode === M.EligibilityReason.ELIGIBLE, M.ErrorCode.INELIGIBLE);
}
