import type {DynamicModule} from '@nestjs/common';
import {Module} from '@nestjs/common';
import {SignedIdentity} from '@sportsbook/service-transport';

import type {IPlayersOperations} from '../adapters/inbound/rest/players-rest.controller.js';
import {PlayersRestController} from '../adapters/inbound/rest/players-rest.controller.js';
import {PLAYERS_IDENTITY, PLAYERS_OPERATIONS} from './players.tokens.js';

@Module({})
export class PlayersModule {static bind(operations:IPlayersOperations, identity:SignedIdentity):DynamicModule {return {module:PlayersModule, controllers:[PlayersRestController], providers:[{provide:PLAYERS_OPERATIONS, useValue:operations}, {provide:PLAYERS_IDENTITY, useValue:identity}]};}}
