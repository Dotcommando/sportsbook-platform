import { CapabilityPolicy } from '../../domain/capability.policy.js';
import { failure, MAX_INT64, success, validInstant, validUuid } from '../../domain/ledger.error.js';
import type { Capability, ICallContext, IOperatorFinancialPolicy, IPageInput, IReservationView, IResult, IWithdrawalView } from '../../domain/ledger.model.js';
import { ActorKind, ErrorCode, ReservationState, WithdrawalState } from '../../domain/ledger.model.js';
import type { ClockPort, FinancialQueryPort, ReconciliationStorePort } from '../../ports/outbound/financial.port.js';

export interface ILedgerReadDependencies { queries: FinancialQueryPort; reconciliation: ReconciliationStorePort; clock: ClockPort; policies: readonly IOperatorFinancialPolicy[]; }

export function authorizeRead(dependencies: ILedgerReadDependencies, context: ICallContext, capability: Capability): IResult<void> {
  const authorization = CapabilityPolicy.authorize(context, capability);

  if (!authorization.ok) return authorization;
  if (Date.parse(context.deadlineAt) <= Date.parse(dependencies.clock.now())) return failure(ErrorCode.DEADLINE_EXCEEDED, context.correlationId);

  const policy = dependencies.policies.find(item => item.operatorId === context.operatorId);

  if (!policy || (context.actorKind !== ActorKind.PLAYER && !policy.trustedActors.some(actor => actor.actorId === context.actorId && actor.actorKind === context.actorKind && actor.capabilities.includes(capability)))) return failure(ErrorCode.PERMISSION_DENIED, context.correlationId);

  return success(undefined);
}

export function validPage(page: IPageInput): boolean {
  return Number.isInteger(page.limit) && page.limit >= 1 && page.limit <= 200 && (page.cursor === undefined || typeof page.cursor === 'string') && (page.from === undefined || validInstant(page.from)) && (page.to === undefined || validInstant(page.to)) && (page.from === undefined || page.to === undefined || Date.parse(page.from) <= Date.parse(page.to)) && Object.keys(page).every(key => ['limit', 'cursor', 'from', 'to'].includes(key));
}

export function validReservation(value: IReservationView): boolean {
  if (!validUuid(value.betId) || !validUuid(value.walletId) || !validUuid(value.reservationTransactionId) || value.stake.amountMinor <= 0n || value.stake.amountMinor > MAX_INT64 || !/^[A-Z]{3}$/.test(value.stake.currency)) return false;
  if (value.state === ReservationState.RESERVED) return value.settlementTransactionId === undefined && value.settlementSeq === undefined && value.grossPayoutMinor === undefined;
  if (!validUuid(value.settlementTransactionId) || value.grossPayoutMinor === undefined) return false;
  if (value.state === ReservationState.CANCELED) return value.grossPayoutMinor === value.stake.amountMinor;
  if (typeof value.settlementSeq !== 'bigint' || value.settlementSeq <= 0n || value.settlementSeq > MAX_INT64) return false;

  return (value.state === ReservationState.WON && value.grossPayoutMinor >= value.stake.amountMinor && value.grossPayoutMinor <= MAX_INT64) || (value.state === ReservationState.LOST && value.grossPayoutMinor === 0n);
}

export function validWithdrawal(value: IWithdrawalView): boolean {
  if (!validUuid(value.withdrawalId) || !validUuid(value.walletId) || !validUuid(value.holdTransactionId) || typeof value.amount.amountMinor !== 'bigint' || value.amount.amountMinor <= 0n || value.amount.amountMinor > MAX_INT64 || !/^[A-Z]{3}$/.test(value.amount.currency) || !validInstant(value.createdAt)) return false;
  if (value.state === WithdrawalState.HELD) return value.resolutionTransactionId === undefined && value.resolvedAt === undefined && value.providerRef === undefined && value.reasonCode === undefined;
  if (!validUuid(value.resolutionTransactionId) || !validInstant(value.resolvedAt)) return false;

  return (value.state === WithdrawalState.COMPLETED && typeof value.providerRef === 'string' && value.providerRef.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._-]*:[A-Za-z0-9._:-]+$/.test(value.providerRef) && value.reasonCode === undefined) || (value.state === WithdrawalState.REJECTED && typeof value.reasonCode === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value.reasonCode) && value.providerRef === undefined);
}
