import * as Wire from '@sportsbook/events-client';
import type { IDelivery } from '@sportsbook/service-transport';
import { DeliveryDisposition, NATS_LIMITS, objectValue } from '@sportsbook/service-transport';

import * as M from '../../../domain/betting.model.js';
import * as Output from '../../../domain/betting-output.policy.js';
import type { RecordEventResultPort } from '../../../ports/inbound/betting-operations.port.js';
import type { ClockPort } from '../../../ports/outbound/betting.port.js';
import { decodeInput } from '../shared/betting.dto.js';

export interface IResultConsumerRoute { operatorId: string; actorId: string; }

export class EventResultConsumer {
  constructor(
    private readonly operation: RecordEventResultPort,
    private readonly routes: readonly IResultConsumerRoute[],
    private readonly clock: ClockPort,
    private readonly handlingTimeoutMs: number,
  ) {
    if (!routes.length || new Set(routes.map(route => route.operatorId)).size !== routes.length
      || !Number.isInteger(handlingTimeoutMs)
      || handlingTimeoutMs < 1
      || handlingTimeoutMs > 60000) {
      throw new Error('Explicit result consumer routes and deadline required');
    }
  }

  async handle(delivery: IDelivery): Promise<DeliveryDisposition> {
    let input: M.IBettingRecordEventResultInput;

    try {
      if (delivery.subject !== 'sportsbook.events.v1.event_result'
        || delivery.data.byteLength > NATS_LIMITS.eventBytes) {
        throw new Error('Invalid result subject');
      }

      const raw = objectValue(Wire.EventEnvelope.toJSON(Wire.EventEnvelope.decode(delivery.data)));
      const payload = objectValue(raw.payload).eventResult;
      const route = this.routes.find(route => route.operatorId === raw.operatorId);

      if (!route || raw.messageId !== delivery.messageId) {
        throw new Error('Untrusted result route');
      }

      const context: M.ICallContext = {
        operatorId: route.operatorId,
        actorId: route.actorId,
        actorKind: M.ActorKind.SERVICE,
        capabilities: [M.Capability.SETTLE_BET],
        correlationId: typeof raw.correlationId === 'string' ? raw.correlationId : '',
        deadlineAt: new Date(Date.parse(this.clock.now()) + this.handlingTimeoutMs).toISOString(),
      };
      const decoded = decodeInput(
        'IBettingRecordEventResultInput',
        { context, envelope: { ...raw, payload }, result: payload },
        true,
      );

      if (!Output.isIBettingRecordEventResultInput(decoded)) {
        throw new Error('Invalid result');
      }
      input = decoded;
    } catch {
      return DeliveryDisposition.POISON;
    }
    const result = await this.operation.execute(input);

    if (result.ok) {
      return DeliveryDisposition.ACK;
    }

    return [
      M.ErrorCode.DEPENDENCY_UNAVAILABLE,
      M.ErrorCode.DEADLINE_EXCEEDED,
      M.ErrorCode.OVERLOADED,
      M.ErrorCode.IN_PROGRESS,
    ].includes(
      result.error.code,
    )
      || result.error.outcomeUnknown
      ? DeliveryDisposition.RETRY
      : DeliveryDisposition.POISON;
  }
}
