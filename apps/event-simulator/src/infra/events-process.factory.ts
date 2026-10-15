import { randomUUID } from 'node:crypto';

import type { IProcessHandle } from '@sportsbook/runtime-settings';
import {
  beginObservation,
  closeAll,
  failureCode,
  startOperations,
  startWorkerLoop,
  validateOperationsSettings,
  validateWorkerLoopSettings,
  workerContext,
} from '@sportsbook/runtime-settings';
import type { IPrivateHost } from '@sportsbook/service-transport';
import { DurablePublisher, MessagingMetrics, validatePrivateHost } from '@sportsbook/service-transport';

import { EventsPublication } from '../adapters/outbound/nats/events-publication.js';
import { ActorKind, Capability } from '../domain/events.model.js';
import { createEventsApplication } from './events-application.factory.js';
import type { IEventsProcessConfiguration } from './events-process.configuration.js';
import { startEventsTransports } from './events-transport.module.js';

export async function startEventsProcess(config: IEventsProcessConfiguration): Promise<IProcessHandle> {
  validatePrivateHost(config.host);
  validateOperationsSettings(config.operations);
  validateWorkerLoopSettings(config.worker);

  if (!config.worker.actors.length || !Number.isInteger(config.worker.limit)
    || config.worker.limit < 1
    || config.worker.limit > 200
    || !Number.isFinite(Date.parse(config.worker.startsAt))
    || config.worker.schedule.some(
      item =>
        !Number.isInteger(item.atOffsetMs) || item.atOffsetMs < 0
        || Boolean(item.advance) === Boolean(item.complete),
    )
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
    throw new Error('Invalid Events worker configuration');
  }

  const observation = beginObservation('event-simulator', config.operations.observation);
  const clock = { now: () => new Date().toISOString() };
  const metrics = MessagingMetrics.forService('events');
  let publisher: DurablePublisher | undefined;
  let application: Awaited<ReturnType<typeof createEventsApplication>> | undefined;
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
        () => application?.close(),
        () => publisher?.close(),
        () => observation.close(),
      ],
    );
  };

  try {
    publisher = await DurablePublisher.connect(config.broker, metrics);
    application =
      await createEventsApplication(config.application, clock, new EventsPublication(publisher, clock));
    const app = application;

    host =
      await startEventsTransports(app.operations, config.identity, config.graphql, config.host);
    operations =
      await startOperations(
        config.operations,
        {
          ready: async () => {
            await app.ready();
            await publisher?.ready();

            return !stopping;
          },
          metrics: () => observation.render() + metrics.render(),
        },
      );

    for (const actor of config.worker.actors) {
      const callbacks: ((input: ReturnType<typeof workerContext<typeof actor>>) => Promise<void>)[] = [];

      if (actor.capabilities.includes(Capability.PUBLISH_EVENTS)) {
        callbacks.push(
          async (context) => {
            const result = await app.operations.publishOutboxBatch.execute(
              { input: { context, batchId: randomUUID(), limit: config.worker.limit, cutoff: clock.now() } },
            );

            if (!result.ok || result.value.report.failed) {
              throw new Error('Events outbox work incomplete');
            }
          },
        );
      }
      if (actor.capabilities.includes(Capability.MATCH_CONTROL)) {
        const completed = new Set<number>();

        callbacks.push(
          async (context) => {
            let count = 0;

            for (const [index, item] of config.worker.schedule.entries()) {
              if (completed.has(index) || Date.now() < Date.parse(config.worker.startsAt) + item.atOffsetMs) {
                continue;
              }
              if (++count > config.worker.limit) {
                break;
              }

              const result = item.advance
                ? await app.operations.advanceMatchPhase.execute({ context, ...item.advance })
                : item.complete
                  ? await app.operations.completeEvent.execute({ context, ...item.complete })
                  : undefined;

              if (!result?.ok) {
                throw new Error('Scheduled Events transition incomplete');
              }
              completed.add(index);
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
          error => console.error(JSON.stringify({ service: 'events', code: failureCode(error) })),
        ),
      );
    }

    return { close };
  } catch (error) {
    await close();
    throw error;
  }
}
