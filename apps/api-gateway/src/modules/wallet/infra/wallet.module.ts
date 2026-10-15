import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { SignedIdentity } from '@sportsbook/service-transport';

import type { IWalletOperations } from '../adapters/inbound/rest/wallet-rest.controller.js';
import { WalletRestController } from '../adapters/inbound/rest/wallet-rest.controller.js';
import { WALLET_IDENTITY, WALLET_OPERATIONS } from './wallet.tokens.js';

@Module({})
export class WalletModule {
  static bind(operations: IWalletOperations, identity: SignedIdentity): DynamicModule {
    return {
      module: WalletModule,
      controllers: [WalletRestController],
      providers: [
        { provide: WALLET_OPERATIONS, useValue: operations },
        { provide: WALLET_IDENTITY, useValue: identity },
      ],
    };
  }
}
