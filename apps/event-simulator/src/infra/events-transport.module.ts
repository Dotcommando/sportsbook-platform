import type {DynamicModule} from '@nestjs/common';
import {Module} from '@nestjs/common';
import type {IGraphqlSettings, IIdentitySettings, IPrivateHost, IPrivateHostSettings} from '@sportsbook/service-transport';
import {SignedIdentity, startPrivateHost} from '@sportsbook/service-transport';

import {EventsGraphqlController} from '../adapters/inbound/graphql/events.resolver.js';
import {EventsGrpcController} from '../adapters/inbound/grpc/events-grpc.controller.js';
import {EventsRestController} from '../adapters/inbound/rest/events-rest.controller.js';
import {EventsBoundary} from '../adapters/inbound/shared/events-boundary.js';
import type {IEventsOperationPorts} from '../ports/inbound/events-application.port.js';
import {EVENTS_BOUNDARY, EVENTS_GRAPHQL_SETTINGS, EVENTS_IDENTITY, EVENTS_OPERATIONS} from './events-transport.tokens.js';

@Module({})
export class EventsTransportModule {static bind(operations:IEventsOperationPorts, identity:IIdentitySettings, graphql:IGraphqlSettings):DynamicModule {return {module:EventsTransportModule, controllers:[EventsRestController, EventsGrpcController, EventsGraphqlController], providers:[{provide:EVENTS_OPERATIONS, useValue:operations}, {provide:EVENTS_IDENTITY, useValue:new SignedIdentity(identity)}, {provide:EVENTS_BOUNDARY, useClass:EventsBoundary}, {provide:EVENTS_GRAPHQL_SETTINGS, useValue:Object.freeze({...graphql})}]};}}

export function startEventsTransports(operations:IEventsOperationPorts, identity:IIdentitySettings, graphql:IGraphqlSettings, host:IPrivateHostSettings):Promise<IPrivateHost> {return startPrivateHost(EventsTransportModule.bind(operations, identity, graphql), host);}
