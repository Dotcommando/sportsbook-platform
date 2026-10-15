import * as M from './events.model.js';
import {validInstant, validUuid} from './events.policy.js';

function record(value:unknown):Record<string, unknown> | undefined {return value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : undefined;}

export function isIEventEnvelope(value:unknown):value is M.IEventEnvelope {const r = record(value);

return r !== undefined && (validUuid(r.messageId)) && (Object.values(M.EventSource).some(candidate=>candidate === r.source)) && (Object.values(M.EventType).some(candidate=>candidate === r.eventType)) && (typeof r.schemaVersion === 'number' && Number.isSafeInteger(r.schemaVersion)) && (validUuid(r.operatorId)) && (validUuid(r.correlationId)) && (validInstant(r.occurredAt)) && (((isIEventResult(r.payload)) || (isIMatchPhaseChangedEvent(r.payload))));}

export function isIError(value:unknown):value is M.IError {const r = record(value);

return r !== undefined && (Object.values(M.ErrorCode).some(candidate=>candidate === r.code)) && (typeof r.message === 'string') && (validUuid(r.correlationId)) && (typeof r.retryable === 'boolean') && (typeof r.outcomeUnknown === 'boolean');}

export function isIEventsListEventsInput(value:unknown):value is M.IEventsListEventsInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (isIPageInput(r.page)) && (r.phase === undefined || Object.values(M.EventPhase).some(candidate=>candidate === r.phase));}

export function isIEventsListEventsOutput(value:unknown):value is M.IEventsListEventsOutput {const r = record(value);

return r !== undefined && (Array.isArray(r.events) && r.events.length <= 200 && r.events.every((item:unknown)=>isIEvent(item))) && (r.nextCursor === undefined || typeof r.nextCursor === 'string') && (validInstant(r.observedAt));}

export function isIEventsGetEventInput(value:unknown):value is M.IEventsGetEventInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.eventId));}

export function isIEventsGetEventOutput(value:unknown):value is M.IEventsGetEventOutput {const r = record(value);

return r !== undefined && (isIEvent(r.event));}

export function isIEventsGetMarketsInput(value:unknown):value is M.IEventsGetMarketsInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.eventId));}

export function isIEventsGetMarketsOutput(value:unknown):value is M.IEventsGetMarketsOutput {const r = record(value);

return r !== undefined && (Array.isArray(r.markets) && r.markets.length <= 200 && r.markets.every((item:unknown)=>isIMarket(item))) && (validInstant(r.observedAt));}

export function isIEventsValidateSelectionQuoteInput(value:unknown):value is M.IEventsValidateSelectionQuoteInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId)) && (validUuid(r.eventId)) && (validUuid(r.marketId)) && (validUuid(r.selectionId)) && (validUuid(r.quoteId)) && (typeof r.quoteVersion === 'bigint' && r.quoteVersion >= -9223372036854775808n && r.quoteVersion <= 9223372036854775807n);}

export function isIEventsValidateSelectionQuoteOutput(value:unknown):value is M.IEventsValidateSelectionQuoteOutput {const r = record(value);

return r !== undefined && (isIQuote(r.acceptedQuote)) && (validInstant(r.evaluatedAt));}

export function isIEventsGetEventResultInput(value:unknown):value is M.IEventsGetEventResultInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.eventId));}

export function isIEventsGetEventResultOutput(value:unknown):value is M.IEventsGetEventResultOutput {const r = record(value);

return r !== undefined && (r.result === undefined || isIEventResult(r.result)) && (typeof r.ready === 'boolean');}

export function isIEventsAdvanceMatchPhaseInput(value:unknown):value is M.IEventsAdvanceMatchPhaseInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.eventId)) && (typeof r.expectedPhaseSeq === 'bigint' && r.expectedPhaseSeq >= -9223372036854775808n && r.expectedPhaseSeq <= 9223372036854775807n) && (Object.values(M.EventPhase).some(candidate=>candidate === r.nextPhase)) && (validInstant(r.simulatedAt));}

export function isIEventsAdvanceMatchPhaseOutput(value:unknown):value is M.IEventsAdvanceMatchPhaseOutput {const r = record(value);

return r !== undefined && (isIEvent(r.event));}

export function isIEventsCompleteEventInput(value:unknown):value is M.IEventsCompleteEventInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.eventId)) && (typeof r.expectedPhaseSeq === 'bigint' && r.expectedPhaseSeq >= -9223372036854775808n && r.expectedPhaseSeq <= 9223372036854775807n) && (isIEventResult(r.result));}

export function isIEventsCompleteEventOutput(value:unknown):value is M.IEventsCompleteEventOutput {const r = record(value);

return r !== undefined && (isIEvent(r.event)) && (isIEventResult(r.result)) && (Object.values(M.DeliveryState).some(candidate=>candidate === r.delivery));}

export function isIEventsPublishOutboxBatchInput(value:unknown):value is M.IEventsPublishOutboxBatchInput {const r = record(value);

return r !== undefined && (isIWorkerBatchInput(r.input));}

export function isIEventsPublishOutboxBatchOutput(value:unknown):value is M.IEventsPublishOutboxBatchOutput {const r = record(value);

return r !== undefined && (isIBatchReport(r.report));}

export function isIEventResult(value:unknown):value is M.IEventResult {const r = record(value);

return r !== undefined && (validUuid(r.resultId)) && (validUuid(r.eventId)) && (validUuid(r.runId)) && (typeof r.resultSeq === 'bigint' && r.resultSeq >= -9223372036854775808n && r.resultSeq <= 9223372036854775807n) && (typeof r.homeGoals === 'number' && Number.isSafeInteger(r.homeGoals)) && (typeof r.awayGoals === 'number' && Number.isSafeInteger(r.awayGoals)) && (Object.values(M.ResultOutcome).some(candidate=>candidate === r.outcome)) && (validInstant(r.occurredAt));}

export function isIMatchPhaseChangedEvent(value:unknown):value is M.IMatchPhaseChangedEvent {const r = record(value);

return r !== undefined && (validUuid(r.eventId)) && (validUuid(r.runId)) && (Object.values(M.EventPhase).some(candidate=>candidate === r.phase)) && (typeof r.phaseSeq === 'bigint' && r.phaseSeq >= -9223372036854775808n && r.phaseSeq <= 9223372036854775807n) && (validInstant(r.simulatedAt));}

export function isICallContext(value:unknown):value is M.ICallContext {const r = record(value);

return r !== undefined && (validUuid(r.operatorId)) && (validUuid(r.actorId)) && (Object.values(M.ActorKind).some(candidate=>candidate === r.actorKind)) && (r.playerId === undefined || validUuid(r.playerId)) && (Array.isArray(r.capabilities) && r.capabilities.length <= 200 && r.capabilities.every((item:unknown)=>Object.values(M.Capability).some(candidate=>candidate === item))) && (validUuid(r.correlationId)) && (validInstant(r.deadlineAt));}

export function isIPageInput(value:unknown):value is M.IPageInput {const r = record(value);

return r !== undefined && (typeof r.limit === 'number' && Number.isSafeInteger(r.limit)) && (r.cursor === undefined || typeof r.cursor === 'string') && (r.from === undefined || validInstant(r.from)) && (r.to === undefined || validInstant(r.to));}

export function isIEvent(value:unknown):value is M.IEvent {const r = record(value);

return r !== undefined && (validUuid(r.eventId)) && (validUuid(r.runId)) && (Object.values(M.Sport).some(candidate=>candidate === r.sport)) && (typeof r.homeTeam === 'string') && (typeof r.awayTeam === 'string') && (validInstant(r.startsAt)) && (Object.values(M.EventPhase).some(candidate=>candidate === r.phase)) && (typeof r.phaseSeq === 'bigint' && r.phaseSeq >= -9223372036854775808n && r.phaseSeq <= 9223372036854775807n) && (validInstant(r.simulatedAt)) && (r.resultRef === undefined || validUuid(r.resultRef));}

export function isIMarket(value:unknown):value is M.IMarket {const r = record(value);

return r !== undefined && (validUuid(r.marketId)) && (validUuid(r.eventId)) && (Object.values(M.MarketType).some(candidate=>candidate === r.type)) && (Object.values(M.MarketState).some(candidate=>candidate === r.state)) && (Array.isArray(r.selections) && r.selections.length <= 200 && r.selections.every((item:unknown)=>isIQuote(item)));}

export function isIQuote(value:unknown):value is M.IQuote {const r = record(value);

return r !== undefined && (validUuid(r.quoteId)) && (typeof r.quoteVersion === 'bigint' && r.quoteVersion >= -9223372036854775808n && r.quoteVersion <= 9223372036854775807n) && (validUuid(r.eventId)) && (validUuid(r.marketId)) && (validUuid(r.selectionId)) && (Object.values(M.Selection).some(candidate=>candidate === r.selection)) && (typeof r.odds === 'string') && (validInstant(r.validUntil)) && (Object.values(M.MarketState).some(candidate=>candidate === r.state));}

export function isIWorkerBatchInput(value:unknown):value is M.IWorkerBatchInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.batchId)) && (typeof r.limit === 'number' && Number.isSafeInteger(r.limit)) && (validInstant(r.cutoff));}

export function isIBatchReport(value:unknown):value is M.IBatchReport {const r = record(value);

return r !== undefined && (typeof r.selected === 'number' && Number.isSafeInteger(r.selected)) && (typeof r.applied === 'number' && Number.isSafeInteger(r.applied)) && (typeof r.replayed === 'number' && Number.isSafeInteger(r.replayed)) && (typeof r.rejected === 'number' && Number.isSafeInteger(r.rejected)) && (typeof r.pending === 'number' && Number.isSafeInteger(r.pending)) && (typeof r.failed === 'number' && Number.isSafeInteger(r.failed)) && (r.nextCursor === undefined || typeof r.nextCursor === 'string');}

export function isRegisteredInput(value:unknown):value is M.RegisteredInput {return isIEventsListEventsInput(value) || isIEventsGetEventInput(value) || isIEventsGetMarketsInput(value) || isIEventsValidateSelectionQuoteInput(value) || isIEventsGetEventResultInput(value) || isIEventsAdvanceMatchPhaseInput(value) || isIEventsCompleteEventInput(value) || isIEventsPublishOutboxBatchInput(value);}

export function isRegisteredOutput(value:unknown):value is M.RegisteredOutput {return isIEventsListEventsOutput(value) || isIEventsGetEventOutput(value) || isIEventsGetMarketsOutput(value) || isIEventsValidateSelectionQuoteOutput(value) || isIEventsGetEventResultOutput(value) || isIEventsAdvanceMatchPhaseOutput(value) || isIEventsCompleteEventOutput(value) || isIEventsPublishOutboxBatchOutput(value);}
