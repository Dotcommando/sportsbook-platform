import type { IOperationsSettings } from '@sportsbook/runtime-settings';
import type { IIdentitySettings } from '@sportsbook/service-transport';

import type { IGatewayOperatorSettings } from '../domain/gateway.model.js';
import type { IGatewayClientSettings } from './gateway-client.factory.js';

export interface IGatewayProcessConfiguration {
  service: 'api-gateway';
  namespace: string;
  operators: IGatewayOperatorSettings[];
  clients: IGatewayClientSettings;
  identity: IIdentitySettings;
  host: string;
  port: number;
  operations: IOperationsSettings;
}
