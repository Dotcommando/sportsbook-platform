import type {DynamicModule} from '@nestjs/common';
import {Module} from '@nestjs/common';
import {SignedIdentity} from '@sportsbook/service-transport';

import type {IEventsOperations} from '../adapters/inbound/rest/events-rest.controller.js';
import {EventsRestController} from '../adapters/inbound/rest/events-rest.controller.js';
import {EVENTS_IDENTITY, EVENTS_OPERATIONS} from './events.tokens.js';

@Module({})
export class EventsModule {static bind(operations:IEventsOperations, identity:SignedIdentity):DynamicModule {return {module:EventsModule, controllers:[EventsRestController], providers:[{provide:EVENTS_OPERATIONS, useValue:operations}, {provide:EVENTS_IDENTITY, useValue:identity}]};}}
