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
import { DurablePublisher, MessagingMetrics, validatePrivateHost } from '@sportsbook/service-transport';

import { PlayerPublication } from '../adapters/outbound/nats/player-publication.js';
import { ActorKind, Capability } from '../domain/player.model.js';
import { createPlayerApplication } from './player-application.factory.js';
import type { IPlayerProcessConfiguration } from './player-process.configuration.js';
import { startPlayerTransports } from './player-transport.module.js';

export async function startPlayerProcess(config: IPlayerProcessConfiguration): Promise<IProcessHandle> {
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
    throw new Error('Invalid Player worker identities');
  }

  const observation = beginObservation('player', config.operations.observation);
  const clock = { now: () => new Date().toISOString() };
  const metrics = MessagingMetrics.forService('player');
  let publisher: DurablePublisher | undefined;
  let application: Awaited<ReturnType<typeof createPlayerApplication>> | undefined;
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
      await createPlayerApplication(config.application, clock, new PlayerPublication(publisher, clock));
    const app = application;

    host =
      await startPlayerTransports(app.operations, config.identity, config.graphql, config.host);
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

            if (result.ok) {
              recordWorkerBatch('player-outbox', result.value.report);
            }
            if (!result.ok || result.value.report.failed) {
              throw new Error('Player outbox work incomplete');
            }
          },
        );
      }
      if (actor.capabilities.includes(Capability.SYNTHETIC_KYC)) {
        callbacks.push(
          async (context) => {
            const result = await app.workers.syntheticKyc.execute(
              { context, batchId: randomUUID(), limit: config.worker.limit, cutoff: clock.now() },
            );

            if (result.ok) {
              recordWorkerBatch('player-synthetic', result.value);
            }
            if (!result.ok || result.value.failed) {
              throw new Error('Synthetic KYC work incomplete');
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
          error => console.error(JSON.stringify({ service: 'player', code: failureCode(error) })),
        ),
      );
    }

    return { close };
  } catch (error) {
    await close();
    throw error;
  }
}
