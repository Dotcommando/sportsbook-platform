import * as M from '../../domain/betting.model.js';
import {BettingError, failure, operator, requireRule, success, validInstant, validUuid} from '../../domain/betting.policy.js';
import type * as P from '../../ports/outbound/betting.port.js';

export interface IBettingDependencies {unitOfWork:P.BetUnitOfWorkPort;queries:P.BetQueryPort;audit:P.BetAuditStorePort;clock:P.ClockPort;ids:P.IdGeneratorPort;fingerprint:P.CommandFingerprintPort;settings:readonly M.IBettingOperatorSettings[];eligibility:P.PlayerEligibilityPort;quotes:P.MarketQuotePort;reservations:P.LedgerReservationPort;settlements:P.LedgerSettlementPort;}

export function authorize(d:IBettingDependencies, context:M.ICallContext, capability:M.Capability, playerId?:string, system = false):void {
  operator(d.settings, context, capability, d.clock.now(), system ? M.ActorKind.SYSTEM : undefined);

  if (playerId !== undefined) {requireRule(validUuid(playerId));

if (context.actorKind === M.ActorKind.PLAYER || context.playerId !== undefined)requireRule(context.playerId === playerId, M.ErrorCode.NOT_FOUND);if ([M.Capability.PLACE_BET, M.Capability.CANCEL_BET].includes(capability))requireRule(context.playerId === playerId, M.ErrorCode.PERMISSION_DENIED);}
}

export function page(input:M.IPageInput):void {requireRule(Number.isInteger(input.limit) && input.limit >= 1 && input.limit <= 200);

if (input.from)requireRule(validInstant(input.from));if (input.to)requireRule(validInstant(input.to));requireRule(!input.from || !input.to || Date.parse(input.from) <= Date.parse(input.to));}

export function batch(d:IBettingDependencies, input:{context:M.ICallContext;batchId:string;page:M.IPageInput;pendingBefore:string}):void {authorize(d, input.context, M.Capability.RECOVER_BETS, undefined, true);page(input.page);requireRule(input.page.cursor === undefined);requireRule(validUuid(input.batchId) && validInstant(input.pendingBefore) && Date.parse(input.pendingBefore) <= Date.parse(d.clock.now()));}

export function value<T>(result:M.IResult<T>):T {if (!result.ok) throw new BettingError(result.error.code, result.error.outcomeUnknown);

return result.value;}

export function required<T>(value:T | undefined):T {if (value === undefined) throw new BettingError(M.ErrorCode.NOT_FOUND);

return value;}

export function fail(error:unknown, context:M.ICallContext):{ok:false;error:M.IError} {return failure(error instanceof BettingError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, context, error instanceof BettingError && error.outcomeUnknown);}

export function report():M.IBatchReport {return {selected:0, applied:0, replayed:0, rejected:0, pending:0, failed:0};}

export function isBusinessRejection(error:unknown):error is BettingError {return error instanceof BettingError && [M.ErrorCode.INELIGIBLE, M.ErrorCode.STALE_QUOTE, M.ErrorCode.MARKET_CLOSED, M.ErrorCode.INSUFFICIENT_FUNDS, M.ErrorCode.NOT_FOUND, M.ErrorCode.AMOUNT_OUT_OF_RANGE, M.ErrorCode.CURRENCY_MISMATCH, M.ErrorCode.INVALID_STATE].includes(error.code) && !error.outcomeUnknown;}

export function storedContext(command:M.IStoredCommand, worker:M.ICallContext):M.ICallContext {const input = command.semanticInput;const original = 'context' in input ? input.context : input.input.context;

requireRule(original.operatorId === worker.operatorId, M.ErrorCode.PERMISSION_DENIED);

return {...original, correlationId:worker.correlationId, deadlineAt:worker.deadlineAt};}

export function child(command:M.IStoredCommand, purpose:string):string {return required(command.stableChildIds.find(child=>child.purpose === purpose)).id;}

export function financialState(status:M.BetStatus):M.FinancialState {return [M.BetStatus.ACCEPTED, M.BetStatus.SETTLEMENT_PENDING].includes(status) ? M.FinancialState.RESERVED : [M.BetStatus.WON, M.BetStatus.LOST].includes(status) ? M.FinancialState.SETTLED : [M.BetStatus.VOID, M.BetStatus.CANCELED].includes(status) ? M.FinancialState.REFUNDED : M.FinancialState.UNCONFIRMED;}

export async function changed(d:IBettingDependencies, ports:P.IBetTransactionPorts, context:M.ICallContext, previous:M.IBetView, next:M.IBetView):Promise<void> {
  await ports.bets.transition(context, next.betId, previous.version, next);

  if (previous.status !== next.status) await ports.history.append(context, next.betId, previous.status, next.status, next.reasonCode, d.clock.now());

  const event:M.IEventEnvelope = {messageId:d.ids.derive(context.operatorId, next.betId, 'betting:state:' + next.version), source:M.EventSource.BETTING, eventType:M.EventType.BET_STATE_CHANGED, schemaVersion:1, operatorId:context.operatorId, correlationId:context.correlationId, occurredAt:d.clock.now(), payload:{betId:next.betId, playerId:next.playerId, status:next.status, version:next.version, financialState:financialState(next.status)}};

  await ports.outbox.append(context, event);
}

export async function load(d:IBettingDependencies, context:M.ICallContext, betId:string):Promise<M.IBetView> {return value(await d.unitOfWork.run(context, async ports=>success(required(await ports.bets.find(context, betId)))));}
