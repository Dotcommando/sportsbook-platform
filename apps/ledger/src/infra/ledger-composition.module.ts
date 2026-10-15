import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { UuidGenerator } from '../adapters/outbound/ids/uuid-generator.js';
import type { ILedgerPersistence } from '../adapters/outbound/persistence/financial-persistence.factory.js';
import { createFinancialPersistence } from '../adapters/outbound/persistence/financial-persistence.factory.js';
import type { ClockPort, FinancialUnitOfWorkPort, MessagePublicationPort } from '../ports/outbound/financial.port.js';
import type { ILedgerApplication } from './ledger-application.factory.js';
import { composeLedgerApplication } from './ledger-application.factory.js';
import { LEDGER_APPLICATION, LEDGER_PERSISTENCE, LEDGER_WRITE_PORT } from './ledger-composition.tokens.js';
import type { ILedgerProcessConfiguration } from './ledger-process.configuration.js';

@Module({})
export class LedgerCompositionModule {
}

export async function createLedgerComposition(
  config: ILedgerProcessConfiguration,
  clock: ClockPort,
  publication: MessagePublicationPort,
): Promise<ILedgerApplication> {
  if (!Number.isInteger(config.outboxRetryMs) || config.outboxRetryMs < 1 || config.outboxRetryMs > 60000) {
    throw new Error('Invalid outbox retry');
  }

  let selected: ILedgerPersistence | undefined;
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) {
      return;
    }
    closed = true;
    await selected?.close();
  };
  const module: DynamicModule =
    {
      module: LedgerCompositionModule,
      providers:
      [
        {
          provide: LEDGER_PERSISTENCE,
          useFactory: async (): Promise<ILedgerPersistence & {
            onModuleDestroy(): Promise<void>;
          }> => {
            selected = await createFinancialPersistence(
              { ...config.persistence, jitter: Math.random },
              new UuidGenerator(config.namespace),
              clock,
              config.policies,
            );

            return { ...selected, onModuleDestroy: close };
          },
        },
        {
          provide: LEDGER_WRITE_PORT,
          inject: [LEDGER_PERSISTENCE],
          useFactory: (persistence: ILedgerPersistence): FinancialUnitOfWorkPort => persistence.unitOfWork,
        },
        {
          provide: LEDGER_APPLICATION,
          inject: [LEDGER_PERSISTENCE, LEDGER_WRITE_PORT],
          useFactory:
            (
              persistence: ILedgerPersistence,
              writer: FinancialUnitOfWorkPort,
            ): ILedgerApplication => composeLedgerApplication(
              { ...persistence, unitOfWork: writer },
              config.namespace,
              config.policies,
              clock,
              publication,
              config.outboxRetryMs,
            ),
        },
      ],
      exports: [LEDGER_WRITE_PORT, LEDGER_APPLICATION],
    };

  try {
    const context = await NestFactory.createApplicationContext(module, { logger: false, abortOnError: false });
    const application = context.get<ILedgerApplication>(LEDGER_APPLICATION);

    return { ...application, close: () => context.close() };
  } catch (error) {
    await close();
    throw error;
  }
}
