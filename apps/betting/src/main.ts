import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { createServiceLogger } from '@sportsbook/observability';

import { ServiceModule } from './infra/service.module.js';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.createApplicationContext(ServiceModule, {
    logger: createServiceLogger('betting'),
  });

  application.enableShutdownHooks();
}

await bootstrap();
