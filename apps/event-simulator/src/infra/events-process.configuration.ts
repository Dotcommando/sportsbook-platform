import type { IOperationsSettings } from '@sportsbook/runtime-settings';
import type {
  IDurablePublisherSettings,
  IGraphqlSettings,
  IIdentitySettings,
  IPrivateHostSettings,
} from '@sportsbook/service-transport';

import type { ICallContext, IEventsAdvanceMatchPhaseInput, IEventsCompleteEventInput } from '../domain/events.model.js';
import type { IEventsApplicationSettings } from './events-application.factory.js';

export interface IEventScheduleItem {
  atOffsetMs: number;
  advance?: Omit<IEventsAdvanceMatchPhaseInput, 'context'>;
  complete?: Omit<IEventsCompleteEventInput, 'context'>;
}

export interface IEventsProcessConfiguration {
  service: 'event-simulator';
  application: IEventsApplicationSettings;
  identity: IIdentitySettings;
  host: IPrivateHostSettings;
  graphql: IGraphqlSettings;
  broker: IDurablePublisherSettings;
  worker: {
    intervalMs: number;
    timeoutMs: number;
    limit: number;
    actors: Omit<ICallContext, 'correlationId' | 'deadlineAt'>[];
    schedule: IEventScheduleItem[];
    startsAt: string;
  };
  operations: IOperationsSettings;
}
