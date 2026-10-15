import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type {
  IGraphqlSettings,
  IIdentitySettings,
  IPrivateHost,
  IPrivateHostSettings,
} from '@sportsbook/service-transport';
import { SignedIdentity, startPrivateHost } from '@sportsbook/service-transport';

import { PlayerGraphqlController } from '../adapters/inbound/graphql/player.resolver.js';
import { PlayerGrpcController } from '../adapters/inbound/grpc/player-grpc.controller.js';
import { PlayerRestController } from '../adapters/inbound/rest/player-rest.controller.js';
import { PlayerBoundary } from '../adapters/inbound/shared/player-boundary.js';
import type { IPlayerOperationPorts } from '../ports/inbound/player-application.port.js';
import {
  PLAYER_BOUNDARY,
  PLAYER_GRAPHQL_SETTINGS,
  PLAYER_IDENTITY,
  PLAYER_OPERATIONS,
} from './player-transport.tokens.js';

@Module({})
export class PlayerTransportModule {
  static bind(
    operations: IPlayerOperationPorts,
    identity: IIdentitySettings,
    graphql: IGraphqlSettings,
  ): DynamicModule {
    return {
      module: PlayerTransportModule,
      controllers: [PlayerRestController, PlayerGrpcController, PlayerGraphqlController],
      providers: [
        { provide: PLAYER_OPERATIONS, useValue: operations },
        { provide: PLAYER_IDENTITY, useValue: new SignedIdentity(identity) },
        { provide: PLAYER_BOUNDARY, useClass: PlayerBoundary },
        { provide: PLAYER_GRAPHQL_SETTINGS, useValue: Object.freeze({ ...graphql }) },
      ],
    };
  }
}

export function startPlayerTransports(
  operations: IPlayerOperationPorts,
  identity: IIdentitySettings,
  graphql: IGraphqlSettings,
  host: IPrivateHostSettings,
): Promise<IPrivateHost> {
  return startPrivateHost(PlayerTransportModule.bind(operations, identity, graphql), host);
}
