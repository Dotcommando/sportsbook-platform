import type { IServiceClientSettings } from '@sportsbook/service-transport';
import { ServiceProtocol } from '@sportsbook/service-transport';

import { EventsGrpcClient } from '../adapters/outbound/clients/events-grpc.client.js';
import {
  EventsHttpClient,
  LedgerHttpClient,
  PlayerHttpClient,
} from '../adapters/outbound/clients/http-service.clients.js';
import { LedgerGrpcClient } from '../adapters/outbound/clients/ledger-grpc.client.js';
import { PlayerGrpcClient } from '../adapters/outbound/clients/player-grpc.client.js';
import type {
  ClockPort,
  LedgerReservationPort,
  LedgerSettlementPort,
  MarketQuotePort,
  PlayerEligibilityPort,
} from '../ports/outbound/betting.port.js';
import type { IBettingClients } from './betting-application.factory.js';

export function createBettingClients(
  settings: {
    player: IServiceClientSettings;
    events: IServiceClientSettings;
    ledger: IServiceClientSettings;
  },
  clock: ClockPort,
): {
  clients: IBettingClients;
  close(): void;
} {
  const config = structuredClone(settings);
  const opened: {
    close(): void;
  }[] = [];

  function choose<T>(s: IServiceClientSettings, registry: Record<ServiceProtocol, () => T>): T {
    const build = registry[s.protocol];

    if (!build) {
      throw new Error('Unsupported Betting transport');
    }

    return build();
  }

  try {
    const player = choose<PlayerEligibilityPort & {
      close(): void;
    }>(
      config.player,
      {
        [ServiceProtocol.GRPC]: () => new PlayerGrpcClient(config.player, clock),
        [ServiceProtocol.REST]: () => new PlayerHttpClient(config.player, clock),
        [ServiceProtocol.GRAPHQL]: () => new PlayerHttpClient(config.player, clock),
      },
    );

    opened.push(player);
    const events = choose<MarketQuotePort & {
      close(): void;
    }>(
      config.events,
      {
        [ServiceProtocol.GRPC]: () => new EventsGrpcClient(config.events, clock),
        [ServiceProtocol.REST]: () => new EventsHttpClient(config.events, clock),
        [ServiceProtocol.GRAPHQL]: () => new EventsHttpClient(config.events, clock),
      },
    );

    opened.push(events);
    const ledger = choose<LedgerReservationPort & LedgerSettlementPort & {
      close(): void;
    }>(
      config.ledger,
      {
        [ServiceProtocol.GRPC]: () => new LedgerGrpcClient(config.ledger, clock),
        [ServiceProtocol.REST]: () => new LedgerHttpClient(config.ledger, clock),
        [ServiceProtocol.GRAPHQL]: () => new LedgerHttpClient(config.ledger, clock),
      },
    );

    opened.push(ledger);

    return {
      clients: { eligibility: player, quotes: events, reservations: ledger, settlements: ledger },
      close: () => {
        for (const client of opened) {
          client.close();
        }
      },
    };
  } catch (error) {
    for (const client of opened) {
      client.close();
    }
    throw error;
  }
}
