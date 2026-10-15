import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type {
  IGraphqlSettings,
  IIdentitySettings,
  IPrivateHost,
  IPrivateHostSettings,
} from '@sportsbook/service-transport';
import { SignedIdentity, startPrivateHost } from '@sportsbook/service-transport';

import { BettingGraphqlController } from '../adapters/inbound/graphql/betting.resolver.js';
import { BettingGrpcController } from '../adapters/inbound/grpc/betting-grpc.controller.js';
import { BettingRestController } from '../adapters/inbound/rest/betting-rest.controller.js';
import { BettingBoundary } from '../adapters/inbound/shared/betting-boundary.js';
import type { IBettingOperationPorts } from '../ports/inbound/betting-application.port.js';
import {
  BETTING_BOUNDARY,
  BETTING_GRAPHQL_SETTINGS,
  BETTING_IDENTITY,
  BETTING_OPERATIONS,
} from './betting-transport.tokens.js';

@Module({})
export class BettingTransportModule {
  static bind(
    operations: IBettingOperationPorts,
    identity: IIdentitySettings,
    graphql: IGraphqlSettings,
  ): DynamicModule {
    return {
      module: BettingTransportModule,
      controllers: [BettingRestController, BettingGrpcController, BettingGraphqlController],
      providers: [
        { provide: BETTING_OPERATIONS, useValue: operations },
        { provide: BETTING_IDENTITY, useValue: new SignedIdentity(identity) },
        { provide: BETTING_BOUNDARY, useClass: BettingBoundary },
        { provide: BETTING_GRAPHQL_SETTINGS, useValue: Object.freeze({ ...graphql }) },
      ],
    };
  }
}

export function startBettingTransports(
  operations: IBettingOperationPorts,
  identity: IIdentitySettings,
  graphql: IGraphqlSettings,
  host: IPrivateHostSettings,
): Promise<IPrivateHost> {
  return startPrivateHost(BettingTransportModule.bind(operations, identity, graphql), host);
}
