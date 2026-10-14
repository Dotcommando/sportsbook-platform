import { failure, success, validInstant, validUuid } from './ledger.error.js';
import type { ICallContext, IResult, UUID } from './ledger.model.js';
import { ActorKind, Capability, ErrorCode } from './ledger.model.js';

export class CapabilityPolicy {
  static authorize(context: ICallContext, required: Capability, targetPlayerId?: UUID): IResult<void> {
    if (!validUuid(context.operatorId) || !validUuid(context.actorId) || !validUuid(context.correlationId) || !validInstant(context.deadlineAt) || !Object.values(ActorKind).includes(context.actorKind) || !Array.isArray(context.capabilities) || context.capabilities.some(capability=>!Object.values(Capability).includes(capability))) return failure(ErrorCode.UNAUTHENTICATED, context.correlationId);
    if (!context.capabilities.includes(required)) return failure(ErrorCode.PERMISSION_DENIED, context.correlationId);
    if (context.actorKind === ActorKind.PLAYER && (!context.playerId || context.actorId !== context.playerId)) return failure(ErrorCode.UNAUTHENTICATED, context.correlationId);
    if (targetPlayerId && context.actorKind !== ActorKind.SYSTEM && context.playerId !== targetPlayerId) return failure(ErrorCode.NOT_FOUND, context.correlationId);

    return success(undefined);
  }
}
