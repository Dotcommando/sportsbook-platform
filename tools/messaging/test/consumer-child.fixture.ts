import type { IDurableConsumerSettings } from '@sportsbook/service-transport';
import { DeliveryDisposition, DurableConsumer, MessagingMetrics } from '@sportsbook/service-transport';

import { EventResultConsumer } from '../../../apps/betting/src/adapters/inbound/nats/event-result.consumer.js';
import type {
  IBettingApplicationSettings,
  IBettingClients,
} from '../../../apps/betting/src/infra/betting-application.factory.js';
import { createBettingApplication } from '../../../apps/betting/src/infra/betting-application.factory.js';

const config: IBettingApplicationSettings = JSON.parse(process.env.TEST_BETTING_CONFIG ?? 'null');

const settings: IDurableConsumerSettings = JSON.parse(process.env.TEST_CONSUMER_SETTINGS ?? 'null');

const route: { operatorId: string; actorId: string } = JSON.parse(process.env.TEST_EVENT_ROUTE ?? 'null');

const clock = { now: () => new Date().toISOString() };

const unused = async (): Promise<never> => {
  throw new Error('Consumer attempted financial RPC');
};

const clients: IBettingClients = {
  eligibility: { check: unused },
  quotes: { validateSelection: unused, getEvent: unused },
  reservations: { reserve: unused, cancel: unused, getStatus: unused },
  settlements: { settleWin: unused, settleLoss: unused, void: unused, getStatus: unused },
};

const app = await createBettingApplication(config, clock, clients, { publish: unused });

const consumer = await DurableConsumer.connect(settings, MessagingMetrics.forService('betting'));

const handler = new EventResultConsumer(app.operations.recordEventResult, [route], clock, 10000);

try {
  await consumer.consumeBatch(
    1,
    async delivery => {
      const result = await handler.handle(delivery);

      if (result === DeliveryDisposition.ACK) {
        process.stdout.write('COMMITTED\n');
        await new Promise<void>(() => { });
      }

      return result;
    },
  );
} finally {
  await consumer.close();
  await app.close();
}
