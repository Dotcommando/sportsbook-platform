import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EventEnvelope } from '@sportsbook/player-client';
import { DeliveryDisposition } from '@sportsbook/service-transport';

import { PlayerRegisteredConsumer } from '../src/adapters/inbound/nats/player-registered.consumer.js';
import { ProvisionPlayerWalletUseCase } from '../src/app/use-cases/provision-player-wallet.use-case.js';
import type { IOperatorFinancialPolicy } from '../src/domain/ledger.model.js';
import { transportFixture } from './transport.fixture.js';

test(
  'registered-player consumer uses its trusted SYSTEM actor and safely replays wallet provisioning',
  async () => {
    const now = '2026-10-15T12:00:00.000Z';
    const f = transportFixture(now);
    const policies: IOperatorFinancialPolicy[] = [
      {
        operatorId: f.system.operatorId,
        currencies: [{ currency: 'USD', minimumMinor: 1n, maximumMinor: 9223372036854775807n }],
        providerNames: ['synthetic'],
        rejectionReasons: ['PAYMENT_REJECTED'],
        trustedActors: [{ ...f.system, providerName: 'synthetic' }],
      },
    ];
    const provision = new ProvisionPlayerWalletUseCase(
      f.operations.createWallet,
      f.ids,
      { now: () => now },
      policies,
    );
    const consumer = new PlayerRegisteredConsumer(
      provision,
      [{ operatorId: f.system.operatorId, actorId: f.system.actorId, currencies: ['USD'] }],
      { now: () => now },
      10000,
    );
    const messageId = f.ids.derive(f.system.operatorId, f.playerId, 'registered');
    const data = EventEnvelope.encode(
      EventEnvelope.fromJSON(
        {
          messageId,
          operatorId: f.system.operatorId,
          source: 'EVENT_ENVELOPE_SOURCE_PLAYER',
          eventType: 'EVENT_TYPE_PLAYER_REGISTERED',
          schemaVersion: 1,
          correlationId: f.system.correlationId,
          occurredAt: now,
          payload: { playerRegisteredEvent: { playerId: f.playerId, registeredAt: now } },
        },
      ),
    ).finish();
    const delivery = { subject: 'sportsbook.player.v1.registered', messageId, data, deliveryCount: 1 };

    assert.equal(await consumer.handle(delivery), DeliveryDisposition.ACK);
    assert.equal(await consumer.handle({ ...delivery, deliveryCount: 2 }), DeliveryDisposition.ACK);
    const wallet = await f.operations.getWallet.execute({ context: f.player, playerId: f.playerId, currency: 'USD' });

    assert.ok(wallet.ok);
    assert.equal(f.store.state.wallets.size, 1);
    assert.equal(
      await consumer.handle({ ...delivery, messageId: f.playerId }),
      DeliveryDisposition.POISON,
    );
    assert.equal(
      await consumer.handle({ ...delivery, subject: 'sportsbook.player.v1.changed' }),
      DeliveryDisposition.POISON,
    );
  },
);
