import * as Wire from '@sportsbook/player-client';
import type { DurablePublisher } from '@sportsbook/service-transport';

import * as M from '../../../domain/player.model.js';
import { requireRule } from '../../../domain/player.policy.js';
import type { ClockPort, MessagePublicationPort } from '../../../ports/outbound/player.port.js';

const subjects:Record<M.EventType, string> = {[M.EventType.PLAYER_REGISTERED]:'sportsbook.player.v1.registered', [M.EventType.PLAYER_PROFILE_CHANGED]:'sportsbook.player.v1.profile_changed', [M.EventType.PLAYER_ELIGIBILITY_CHANGED]:'sportsbook.player.v1.eligibility_changed'};

const payloadFields:Record<M.EventType, string> = {[M.EventType.PLAYER_REGISTERED]:'playerRegisteredEvent', [M.EventType.PLAYER_PROFILE_CHANGED]:'playerProfileChangedEvent', [M.EventType.PLAYER_ELIGIBILITY_CHANGED]:'playerEligibilityChangedEvent'};

export class PlayerPublication implements MessagePublicationPort {
  constructor(private readonly publisher:DurablePublisher, private readonly clock:ClockPort) {}

  async publish(context:M.ICallContext, event:M.IEventEnvelope):Promise<M.IPublicationReceipt> {requireRule(event.source === M.EventSource.PLAYER && event.operatorId === context.operatorId && event.schemaVersion === 1 && Object.values(M.EventType).includes(event.eventType), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);const payload = {...event.payload, ...(event.payload.version === undefined ? {} : {version:event.payload.version.toString()})};const encoded = Wire.EventEnvelope.encode(Wire.EventEnvelope.fromJSON({...event, source:'EVENT_ENVELOPE_SOURCE_PLAYER', eventType:'EVENT_TYPE_' + event.eventType, payload:{[payloadFields[event.eventType]]:payload}})).finish();

await this.publisher.publish(subjects[event.eventType], event.messageId, encoded, Date.parse(context.deadlineAt) - Date.parse(this.clock.now()));

return {messageId:event.messageId, acceptedAt:this.clock.now(), durable:true};}
}
