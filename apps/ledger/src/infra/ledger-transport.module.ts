import type {DynamicModule} from '@nestjs/common';
import {Module} from '@nestjs/common';
import type {IGraphqlSettings, IIdentitySettings, IPrivateHost, IPrivateHostSettings} from '@sportsbook/service-transport';
import {SignedIdentity, startPrivateHost} from '@sportsbook/service-transport';

import {LedgerGraphqlController} from '../adapters/inbound/graphql/ledger.resolver.js';
import {LedgerGrpcController} from '../adapters/inbound/grpc/ledger-grpc.controller.js';
import {LedgerRestController} from '../adapters/inbound/rest/ledger-rest.controller.js';
import {LedgerBoundary} from '../adapters/inbound/shared/ledger-boundary.js';
import type {ILedgerOperationPorts} from '../ports/inbound/ledger-application.port.js';
import {LEDGER_BOUNDARY, LEDGER_GRAPHQL_SETTINGS, LEDGER_IDENTITY, LEDGER_OPERATIONS} from './ledger-transport.tokens.js';

@Module({})
export class LedgerTransportModule {static bind(operations:ILedgerOperationPorts, identity:IIdentitySettings, graphql:IGraphqlSettings):DynamicModule {return {module:LedgerTransportModule, controllers:[LedgerRestController, LedgerGrpcController, LedgerGraphqlController], providers:[{provide:LEDGER_OPERATIONS, useValue:operations}, {provide:LEDGER_IDENTITY, useValue:new SignedIdentity(identity)}, {provide:LEDGER_BOUNDARY, useClass:LedgerBoundary}, {provide:LEDGER_GRAPHQL_SETTINGS, useValue:Object.freeze({...graphql})}]};}}

export function startLedgerTransports(operations:ILedgerOperationPorts, identity:IIdentitySettings, graphql:IGraphqlSettings, host:IPrivateHostSettings):Promise<IPrivateHost> {return startPrivateHost(LedgerTransportModule.bind(operations, identity, graphql), host);}
