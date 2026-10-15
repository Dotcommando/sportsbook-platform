import type { IOperationsSettings } from '@sportsbook/runtime-settings';
import type {
  IDurablePublisherSettings,
  IGraphqlSettings,
  IIdentitySettings,
  IPrivateHostSettings,
} from '@sportsbook/service-transport';

import type { ICallContext } from '../domain/player.model.js';
import type { IPlayerApplicationSettings } from './player-application.factory.js';

export interface IPlayerProcessConfiguration {
  service: 'player';
  application: IPlayerApplicationSettings;
  identity: IIdentitySettings;
  host: IPrivateHostSettings;
  graphql: IGraphqlSettings;
  broker: IDurablePublisherSettings;
  worker: {
    intervalMs: number;
    timeoutMs: number;
    limit: number;
    actors: Omit<ICallContext, 'correlationId' | 'deadlineAt'>[];
  };
  operations: IOperationsSettings;
}
