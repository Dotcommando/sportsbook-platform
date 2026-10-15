import * as M from '../../domain/events.model.js';
import {EventsError} from '../../domain/events.policy.js';
import * as Output from '../../domain/events-output.policy.js';
import {Match} from '../../domain/match.policy.js';
import type {CompleteEventPort} from '../../ports/inbound/events-operations.port.js';
import type {IEventsDependencies} from '../services/events-operation.service.js';
import {EventsOperationService} from '../services/events-operation.service.js';

export class CompleteEventUseCase implements CompleteEventPort {constructor(private readonly dependencies:IEventsDependencies) {}

execute(input:M.IEventsCompleteEventInput):Promise<M.IResult<M.IEventsCompleteEventOutput>> {return new EventsOperationService(this.dependencies).command('CompleteEvent', input, Output.isIEventsCompleteEventOutput, async(ports, messageId)=>{const previous = await ports.catalog.find(input.context, input.eventId);

if (!previous) throw new EventsError(M.ErrorCode.NOT_FOUND);
Match.complete(previous, input.expectedPhaseSeq, input.result);await ports.results.complete(input.context, input.result);
const event = await ports.catalog.changePhase(input.context, input.eventId, input.expectedPhaseSeq, M.EventPhase.FINISHED, input.result.occurredAt);

await ports.quotes.changeMarketStates(input.context, input.eventId, event.phase, event.phaseSeq);
const envelope:M.IEventEnvelope = {messageId, source:M.EventSource.EVENTS, eventType:M.EventType.EVENT_RESULT, schemaVersion:1, operatorId:input.context.operatorId, correlationId:input.context.correlationId, occurredAt:this.dependencies.clock.now(), payload:input.result};

await ports.resultIntent.storeIntent(input.context, input.result, envelope);

return {event, result:input.result, delivery:M.DeliveryState.PENDING};});}}
