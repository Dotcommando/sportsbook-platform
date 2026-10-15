import * as Wire from '@sportsbook/betting-client';
import type {DurablePublisher} from '@sportsbook/service-transport';

import * as M from '../../../domain/betting.model.js';
import {requireRule} from '../../../domain/betting.policy.js';
import * as Output from '../../../domain/betting-output.policy.js';
import type {ClockPort, MessagePublicationPort} from '../../../ports/outbound/betting.port.js';

export class BettingPublication implements MessagePublicationPort {
  constructor(private readonly publisher:DurablePublisher, private readonly clock:ClockPort) {}

  async publish(context:M.ICallContext, event:M.IEventEnvelope):Promise<M.IPublicationReceipt> {
    const payload = event.payload;

requireRule(event.source === M.EventSource.BETTING && event.eventType === M.EventType.BET_STATE_CHANGED && event.operatorId === context.operatorId && event.schemaVersion === 1 && Output.isIBetStateChangedEvent(payload));

if (!Output.isIBetStateChangedEvent(payload)) throw new Error('Invalid bet event');

    const bytes = Wire.EventEnvelope.encode(Wire.EventEnvelope.fromJSON({...event, source:'EVENT_ENVELOPE_SOURCE_BETTING', eventType:'EVENT_TYPE_BET_STATE_CHANGED', payload:{betStateChangedEvent:{...payload, status:'BET_STATUS_' + payload.status, version:payload.version.toString(), financialState:'BET_STATE_CHANGED_EVENT_FINANCIAL_STATE_' + payload.financialState}}})).finish();

    await this.publisher.publish('sportsbook.betting.v1.state_changed', event.messageId, bytes, Date.parse(context.deadlineAt) - Date.parse(this.clock.now()));

return {messageId:event.messageId, acceptedAt:this.clock.now(), durable:true};
  }
}
