import type { IOperationsSettings } from '@sportsbook/runtime-settings';
import type {
  IDurableConsumerSettings,
  IDurablePublisherSettings,
  IGraphqlSettings,
  IIdentitySettings,
  IPrivateHostSettings,
} from '@sportsbook/service-transport';

import type { IPlayerRegisteredRoute } from '../adapters/inbound/nats/player-registered.consumer.js';
import type { ISyntheticPaymentSettings } from '../adapters/outbound/clients/synthetic-payment.client.js';
import type { ILedgerPersistenceSettings } from '../adapters/outbound/persistence/financial-persistence.factory.js';
import type { ICallContext, IOperatorFinancialPolicy } from '../domain/ledger.model.js';

export interface ILedgerProcessConfiguration {
  service: 'ledger';
  namespace: string;
  persistence: Omit<ILedgerPersistenceSettings, 'jitter'>;
  policies: IOperatorFinancialPolicy[];
  outboxRetryMs: number;
  identity: IIdentitySettings;
  host: IPrivateHostSettings;
  graphql: IGraphqlSettings;
  broker: IDurablePublisherSettings;
  consumer: IDurableConsumerSettings;
  registrationRoutes: IPlayerRegisteredRoute[];
  worker: {
    intervalMs: number;
    timeoutMs: number;
    limit: number;
    actors: Omit<ICallContext, 'correlationId' | 'deadlineAt'>[];
  };
  syntheticPayments: ISyntheticPaymentSettings;
  operations: IOperationsSettings;
}
