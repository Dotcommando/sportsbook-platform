import * as Wire from '@sportsbook/player-client';
import type { IDelivery } from '@sportsbook/service-transport';
import { DeliveryDisposition, NATS_LIMITS, objectValue } from '@sportsbook/service-transport';

import * as M from '../../../domain/ledger.model.js';
import type { ProvisionPlayerWalletPort } from '../../../ports/inbound/ledger-operations.port.js';
import type { ClockPort } from '../../../ports/outbound/financial.port.js';
import {
  decodeInput,
  isILedgerProvisionPlayerWalletInput,
  isILedgerProvisionPlayerWalletOutput,
} from '../shared/ledger.dto.js';

export interface IPlayerRegisteredRoute {
  operatorId: string;
  actorId: string;
  currencies: string[];
}

export class PlayerRegisteredConsumer {
  constructor(
    private readonly operation: ProvisionPlayerWalletPort,
    private readonly routes: readonly IPlayerRegisteredRoute[],
    private readonly clock: ClockPort,
    private readonly timeoutMs: number,
  ) {
    if (!routes.length || new Set(routes.map(route => route.operatorId)).size !== routes.length
      || !Number.isInteger(timeoutMs)
      || timeoutMs < 1
      || timeoutMs > 60000) {
      throw new Error('Explicit player registration routes and deadline required');
    }
  }

  async handle(delivery: IDelivery): Promise<DeliveryDisposition> {
    let input: M.ILedgerProvisionPlayerWalletInput;

    try {
      if (delivery.subject !== 'sportsbook.player.v1.registered'
        || delivery.data.byteLength > NATS_LIMITS.eventBytes) {
        throw new Error('Invalid registration subject');
      }

      const raw = objectValue(Wire.EventEnvelope.toJSON(Wire.EventEnvelope.decode(delivery.data)));
      const payload = objectValue(objectValue(raw.payload).playerRegisteredEvent);
      const route = this.routes.find(value => value.operatorId === raw.operatorId);

      if (!route || raw.messageId !== delivery.messageId || raw.source !== 'EVENT_ENVELOPE_SOURCE_PLAYER'
        || raw.eventType !== 'EVENT_TYPE_PLAYER_REGISTERED') {
        throw new Error('Untrusted player event');
      }

      const decoded = decodeInput(
        'ILedgerProvisionPlayerWalletInput',
        {
          context: {
            operatorId: route.operatorId,
            actorId: route.actorId,
            actorKind: M.ActorKind.SYSTEM,
            playerId: payload.playerId,
            capabilities: [M.Capability.CREATE_WALLET],
            correlationId: raw.correlationId,
            deadlineAt: new Date(Date.parse(this.clock.now()) + this.timeoutMs).toISOString(),
          },
          envelope: {
            messageId: raw.messageId,
            source: M.EventSource.PLAYER,
            eventType: M.EventType.PLAYER_REGISTERED,
            schemaVersion: raw.schemaVersion,
            operatorId: raw.operatorId,
            correlationId: raw.correlationId,
            occurredAt: raw.occurredAt,
            payload,
          },
          playerId: payload.playerId,
          currencies: route.currencies,
        },
        false,
      );

      if (!isILedgerProvisionPlayerWalletInput(decoded)) {
        throw new Error('Invalid registration envelope');
      }
      input = decoded;
    } catch {
      return DeliveryDisposition.POISON;
    }
    const result = await this.operation.execute(input);

    if (result.ok) {
      return isILedgerProvisionPlayerWalletOutput(result.value)
        ? DeliveryDisposition.ACK
        : DeliveryDisposition.RETRY;
    }

    return result.error.retryable || result.error.outcomeUnknown
      ? DeliveryDisposition.RETRY
      : DeliveryDisposition.POISON;
  }
}
