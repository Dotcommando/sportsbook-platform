import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { SignedIdentity } from '@sportsbook/service-transport';

import type { IBetsOperations } from '../adapters/inbound/rest/bets-rest.controller.js';
import { BetsRestController } from '../adapters/inbound/rest/bets-rest.controller.js';
import { BETS_IDENTITY, BETS_OPERATIONS } from './bets.tokens.js';

@Module({})
export class BetsModule {
  static bind(operations: IBetsOperations, identity: SignedIdentity): DynamicModule {
    return {
      module: BetsModule,
      controllers: [BetsRestController],
      providers: [
        { provide: BETS_OPERATIONS, useValue: operations },
        { provide: BETS_IDENTITY, useValue: identity },
      ],
    };
  }
}
