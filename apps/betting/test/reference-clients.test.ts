import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ServiceProtocol } from '@sportsbook/service-transport';
import { jsonWire } from '@sportsbook/service-transport';

import { contractEnvironment } from '../../api-gateway/test/transports.fixture.js';
import * as EventsDto from '../../event-simulator/src/adapters/inbound/shared/events.dto.js';
import * as B from '../src/domain/betting.model.js';
import { createBettingClients } from '../src/infra/betting-client.factory.js';

for (const protocol of Object.values(ServiceProtocol)) {
  test(
    'Betting reference clients preserve eligibility and exact quotes through ' + protocol,
    async () => {
      const env = await contractEnvironment(
        '127.0.0.1',
        {
          execute: async () => {
            const value = EventsDto.decodeInput(
              'IEventsValidateSelectionQuoteOutput',
              jsonWire({ acceptedQuote: env.fixture.bet.legs[0]?.quote, evaluatedAt: env.fixture.now }),
              false,
            );

            assert.ok(EventsDto.isIEventsValidateSelectionQuoteOutput(value));

            return { ok: true, value };
          },
        },
      );
      const f = env.fixture;

      assert.ok(f.context.playerId);
      const config = async (owner: string): Promise<{
        protocol: ServiceProtocol;
        endpoint: string;
        tls: boolean;
        issuer: string;
        audience: string;
        key: string;
        actorId: string;
        operators: string[];
        capabilities: string[];
        timeoutMs: number;
      }> => {
        const server = env.hosts[owner];

        assert.ok(server);

        return {
          ...env.privateIdentity,
          protocol,
          endpoint: protocol === ServiceProtocol.GRPC
            ? '127.0.0.1:' + env.grpcPorts[owner]
            : await server.http.getUrl() + (protocol === ServiceProtocol.GRAPHQL ? '/internal/graphql' : ''),
          tls: false,
          actorId: env.serviceActor,
          operators: [f.context.operatorId],
          capabilities: owner === 'player'
            ? ['EVALUATE_ELIGIBILITY']
            : owner === 'events' ? ['EVENT_READ'] : ['READ_WALLET'],
          timeoutMs: 5000,
        };
      };
      const resources = createBettingClients(
        {
          player: await config('player'),
          events: await config('events'),
          ledger: await config('ledger'),
        },
        f.clock,
      );
      const context: B.ICallContext = {
        operatorId: f.context.operatorId,
        actorId: f.context.actorId,
        actorKind: B.ActorKind.PLAYER,
        playerId: f.context.playerId,
        capabilities: [B.Capability.PLACE_BET],
        correlationId: f.context.correlationId,
        deadlineAt: new Date(Date.now() + 60000).toISOString(),
      };

      try {
        assert.ok(context.playerId);
        const eligible =
          await resources.clients.eligibility.check(
            context,
            context.playerId,
            B.PlayerCapability.PLACE_BET,
          );

        assert.equal(eligible.eligibility.allowed, true);
        const selection = f.place.selection;
        const quote = await resources.clients.quotes.validateSelection(
          context,
          context.playerId,
          selection.eventId,
          selection.marketId,
          selection.selectionId,
          selection.quoteId,
          selection.quoteVersion,
        );

        assert.equal(quote.acceptedQuote.quoteVersion, selection.quoteVersion);
        assert.equal(quote.acceptedQuote.odds, f.bet.legs[0]?.quote?.odds);
        assert.equal(
          (await resources.clients.quotes.getEvent(context, selection.eventId)).event.eventId,
          selection.eventId,
        );
      } finally {
        resources.close();
        await env.close();
      }
    },
  );
}
