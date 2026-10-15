import { randomUUID } from 'node:crypto';

import type { IProcessHandle } from '@sportsbook/runtime-settings';
import {
  beginObservation,
  closeAll,
  failureCode,
  recordWorkerBatch,
  startOperations,
  startWorkerLoop,
  validateOperationsSettings,
  validateWorkerLoopSettings,
  workerContext,
} from '@sportsbook/runtime-settings';
import type { IPrivateHost } from '@sportsbook/service-transport';
import {
  DurableConsumer,
  DurablePublisher,
  MessagingMetrics,
  validatePrivateHost,
} from '@sportsbook/service-transport';

import { EventResultConsumer } from '../adapters/inbound/nats/event-result.consumer.js';
import { BettingPublication } from '../adapters/outbound/nats/betting-publication.js';
import { ActorKind, Capability } from '../domain/betting.model.js';
import { createBettingApplication } from './betting-application.factory.js';
import { createBettingClients } from './betting-client.factory.js';
import type { IBettingProcessConfiguration } from './betting-process.configuration.js';
import { startBettingTransports } from './betting-transport.module.js';

export async function startBettingProcess(config: IBettingProcessConfiguration): Promise<IProcessHandle> {
  validatePrivateHost(config.host);
  validateOperationsSettings(config.operations);
  validateWorkerLoopSettings(config.worker);

  if (!config.worker.actors.length || !Number.isInteger(config.worker.limit)
    || config.worker.limit < 1
    || config.worker.limit > 200
    || config.worker.actors.some(
      actor =>
        actor.actorKind !== ActorKind.SYSTEM
        || !config.application.operators.some(
          policy =>
            policy.operatorId === actor.operatorId
            && policy.trustedActors.some(
              trusted =>
                trusted.actorId === actor.actorId && trusted.actorKind === actor.actorKind
                && actor.capabilities.every(capability => trusted.capabilities.includes(capability)),
            ),
        ),
    )) {
    throw new Error('Invalid Betting worker identities');
  }

  const observation = beginObservation('betting', config.operations.observation);
  const clock = { now: () => new Date().toISOString() };
  const metrics = MessagingMetrics.forService('betting');
  const clients = createBettingClients(config.clients, clock);
  let publisher: DurablePublisher | undefined;
  let consumer: DurableConsumer | undefined;
  let app: Awaited<ReturnType<typeof createBettingApplication>> | undefined;
  let host: IPrivateHost | undefined;
  let operations: IProcessHandle | undefined;
  const loops: IProcessHandle[] = [];
  let stopping = false;
  const close = async (): Promise<void> => {
    stopping = true;
    await closeAll(
      [
        () => host?.close(),
        ...loops.map(loop => () => loop.close()),
        () => operations?.close(),
        () => consumer?.close(),
        () => app?.close(),
        () => clients.close(),
        () => publisher?.close(),
        () => observation.close(),
      ],
    );
  };

  try {
    publisher = await DurablePublisher.connect(config.broker, metrics);
    app =
      await createBettingApplication(
        config.application,
        clock,
        clients.clients,
        new BettingPublication(publisher, clock),
      );
    const application = app;

    consumer = await DurableConsumer.connect(config.consumer, metrics);
    const delivery = consumer;
    const resultConsumer = new EventResultConsumer(
      application.operations.recordEventResult,
      config.resultRoutes,
      clock,
      config.worker.timeoutMs,
    );

    host =
      await startBettingTransports(application.operations, config.identity, config.graphql, config.host);
    operations =
      await startOperations(
        config.operations,
        {
          ready: async () => {
            await application.ready();
            await publisher?.ready();

            return !stopping;
          },
          metrics: () => observation.render() + metrics.render(),
        },
      );
    loops.push(
      startWorkerLoop(
        config.worker,
        async () => {
          const batch = await delivery.consumeBatch(config.worker.limit, message => resultConsumer.handle(message));

          if (batch.failed) {
            throw new Error('Result acknowledgment incomplete');
          }
        },
        error => console.error(JSON.stringify({ service: 'betting', code: failureCode(error) })),
      ),
    );

    for (const actor of config.worker.actors) {
      const callbacks: ((context: ReturnType<typeof workerContext<typeof actor>>) => Promise<void>)[] = [];

      if (actor.capabilities.includes(Capability.PUBLISH_EVENTS)) {
        callbacks.push(
          async (context) => {
            const result = await application.operations.publishOutboxBatch.execute(
              { input: { context, batchId: randomUUID(), limit: config.worker.limit, cutoff: clock.now() } },
            );

            if (result.ok) {
              recordWorkerBatch('betting-work', result.value.report);
            }
            if (!result.ok || result.value.report.failed) {
              throw new Error('Betting outbox work incomplete');
            }
          },
        );
      }
      if (actor.capabilities.includes(Capability.RECOVER_BETS)) {
        callbacks.push(
          async (context) => {
            const input = {
              context,
              batchId: randomUUID(),
              page: { limit: config.worker.limit },
              pendingBefore: clock.now(),
            };

            for (const operation of [
              application.operations.retryPendingReservation,
              application.operations.retryPendingCancellation,
            ]) {
              const result = await operation.execute(input);

              if (!result.ok || result.value.report.failed) {
                throw new Error('Betting recovery incomplete');
              }
            }
          },
        );
      }
      if (actor.capabilities.includes(Capability.SETTLE_BET)) {
        callbacks.push(
          async (context) => {
            const sweep = await application.workers.settlements.scheduleResults(
              { context, batchId: randomUUID(), limit: config.worker.limit, cutoff: clock.now() },
            );

            recordWorkerBatch('betting-sweep', sweep);

            if (sweep.failed) {
              throw new Error('Settlement sweep incomplete');
            }

            const result = await application.operations.retryPendingSettlement.execute(
              {
                context,
                batchId: randomUUID(),
                page: { limit: config.worker.limit },
                pendingBefore: clock.now(),
              },
            );

            if (!result.ok || result.value.report.failed) {
              throw new Error('Settlement work incomplete');
            }
          },
        );
      }
      loops.push(
        startWorkerLoop(
          config.worker,
          async () => {
            for (const callback of callbacks) {
              await callback(workerContext(actor, config.worker.timeoutMs));
            }
          },
          error => console.error(JSON.stringify({ service: 'betting', code: failureCode(error) })),
        ),
      );
    }

    return { close };
  } catch (error) {
    await close();
    throw error;
  }
}
