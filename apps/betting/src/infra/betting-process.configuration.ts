import type { IOperationsSettings } from '@sportsbook/runtime-settings';
import type {
  IDurableConsumerSettings,
  IDurablePublisherSettings,
  IGraphqlSettings,
  IIdentitySettings,
  IPrivateHostSettings,
  IServiceClientSettings,
} from '@sportsbook/service-transport';

import type { IResultConsumerRoute } from '../adapters/inbound/nats/event-result.consumer.js';
import type { ICallContext } from '../domain/betting.model.js';
import type { IBettingApplicationSettings } from './betting-application.factory.js';

export interface IBettingProcessConfiguration {
  service: 'betting';
  application: IBettingApplicationSettings;
  identity: IIdentitySettings;
  host: IPrivateHostSettings;
  graphql: IGraphqlSettings;
  broker: IDurablePublisherSettings;
  clients: {
    player: IServiceClientSettings;
    events: IServiceClientSettings;
    ledger: IServiceClientSettings;
  };
  consumer: IDurableConsumerSettings;
  resultRoutes: IResultConsumerRoute[];
  worker: {
    intervalMs: number;
    timeoutMs: number;
    limit: number;
    actors: Omit<ICallContext, 'correlationId' | 'deadlineAt'>[];
  };
  operations: IOperationsSettings;
}
