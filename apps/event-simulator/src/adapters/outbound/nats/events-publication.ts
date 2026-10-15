import * as Wire from '@sportsbook/events-client';
import type {DurablePublisher} from '@sportsbook/service-transport';

import * as M from '../../../domain/events.model.js';
import {requireRule, validInstant} from '../../../domain/events.policy.js';
import * as Output from '../../../domain/events-output.policy.js';
import type {ClockPort, MessagePublicationPort} from '../../../ports/outbound/events.port.js';

export class EventsPublication implements MessagePublicationPort {
  constructor(private readonly publisher:DurablePublisher, private readonly clock:ClockPort) {}

  async publish(context:M.ICallContext, event:M.IEventEnvelope):Promise<M.IPublicationReceipt> {
    requireRule(Output.isIEventEnvelope(event) && event.operatorId === context.operatorId && event.source === M.EventSource.EVENTS && event.schemaVersion === 1 && validInstant(context.deadlineAt));
    const result = event.eventType === M.EventType.EVENT_RESULT;

    requireRule(result ? Output.isIEventResult(event.payload) : event.eventType === M.EventType.MATCH_PHASE_CHANGED && Output.isIMatchPhaseChangedEvent(event.payload));
    const fields = event.payload;let payload:unknown;

    if (Output.isIEventResult(fields))payload = {eventResult:{...fields, resultSeq:fields.resultSeq.toString(), outcome:'EVENT_RESULT_OUTCOME_' + fields.outcome}};
    else if (Output.isIMatchPhaseChangedEvent(fields))payload = {matchPhaseChangedEvent:{...fields, phaseSeq:fields.phaseSeq.toString(), phase:'EVENT_PHASE_' + fields.phase}};
    else throw new Error('Invalid event payload');

    const bytes = Wire.EventEnvelope.encode(Wire.EventEnvelope.fromJSON({...event, source:'EVENT_ENVELOPE_SOURCE_EVENTS', eventType:'EVENT_TYPE_' + event.eventType, payload})).finish();

    await this.publisher.publish(result ? 'sportsbook.events.v1.event_result' : 'sportsbook.events.v1.match_phase_changed', event.messageId, bytes, Date.parse(context.deadlineAt) - Date.parse(this.clock.now()));

    return {messageId:event.messageId, acceptedAt:this.clock.now(), durable:true};
  }
}
