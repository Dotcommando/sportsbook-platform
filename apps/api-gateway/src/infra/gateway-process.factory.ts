import type { INestApplication } from '@nestjs/common';
import type { IProcessHandle } from '@sportsbook/runtime-settings';
import { beginObservation, closeAll, startOperations, validateOperationsSettings } from '@sportsbook/runtime-settings';

import { UuidGenerator } from '../adapters/outbound/ids/uuid-generator.js';
import { createGatewayApplication } from './gateway-application.factory.js';
import { createGatewayClients } from './gateway-client.factory.js';
import type { IGatewayProcessConfiguration } from './gateway-process.configuration.js';
import { startGatewayRest } from './gateway-transport.module.js';

export async function startGatewayProcess(config: IGatewayProcessConfiguration): Promise<IProcessHandle> {
  validateOperationsSettings(config.operations);
  const observation = beginObservation('api-gateway', config.operations.observation);
  const clock = { now: () => new Date().toISOString() };
  const ids = new UuidGenerator(config.namespace);
  const clients = createGatewayClients(config.clients, clock);
  let app: INestApplication | undefined;
  let operations: IProcessHandle | undefined;
  let closing = false;
  const close = async (): Promise<void> => {
    closing = true;
    await closeAll(
      [
        () => app?.close(),
        () => operations?.close(),
        () => clients.close(),
        () => observation.close(),
      ],
    );
  };

  try {
    const application = createGatewayApplication(config.operators, clock, ids, clients.clients);

    app = await startGatewayRest(application, config.identity, config.host, config.port);
    operations =
      await startOperations(
        config.operations,
        { ready: async () => !closing, metrics: () => observation.render() },
      );

    return { close };
  } catch (error) {
    await close();
    throw error;
  }
}
