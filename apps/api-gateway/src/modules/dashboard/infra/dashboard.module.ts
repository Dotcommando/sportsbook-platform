import type {DynamicModule} from '@nestjs/common';
import {Module} from '@nestjs/common';
import {SignedIdentity} from '@sportsbook/service-transport';

import type {IDashboardOperations} from '../adapters/inbound/rest/dashboard-rest.controller.js';
import {DashboardRestController} from '../adapters/inbound/rest/dashboard-rest.controller.js';
import {DASHBOARD_IDENTITY, DASHBOARD_OPERATIONS} from './dashboard.tokens.js';

@Module({})
export class DashboardModule {static bind(operations:IDashboardOperations, identity:SignedIdentity):DynamicModule {return {module:DashboardModule, controllers:[DashboardRestController], providers:[{provide:DASHBOARD_OPERATIONS, useValue:operations}, {provide:DASHBOARD_IDENTITY, useValue:identity}]};}}
