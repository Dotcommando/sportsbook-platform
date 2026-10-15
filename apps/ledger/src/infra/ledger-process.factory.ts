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

import { PlayerRegisteredConsumer } from '../adapters/inbound/nats/player-registered.consumer.js';
import { LedgerPublication } from '../adapters/outbound/nats/ledger-publication.js';
import { ActorKind, Capability } from '../domain/ledger.model.js';
import type { ILedgerApplication } from './ledger-application.factory.js';
import { createLedgerComposition } from './ledger-composition.module.js';
import type { ILedgerProcessConfiguration } from './ledger-process.configuration.js';
import { startLedgerTransports } from './ledger-transport.module.js';
import { createLedgerPaymentWorker } from './ledger-worker.factory.js';

export async function startLedgerProcess(config: ILedgerProcessConfiguration): Promise<IProcessHandle> {
  validatePrivateHost(config.host);
  validateOperationsSettings(config.operations);
  validateWorkerLoopSettings(config.worker);

  if (!config.worker.actors.length || !Number.isInteger(config.worker.limit)
    || config.worker.limit < 1
    || config.worker.limit > 200
    || config.worker.actors.some(
      actor =>
        actor.actorKind !== ActorKind.SYSTEM
        || !config.policies.some(
          policy =>
            policy.operatorId === actor.operatorId
            && policy.trustedActors.some(
              trusted =>
                trusted.actorId === actor.actorId && trusted.actorKind === actor.actorKind
                && actor.capabilities.every(capability => trusted.capabilities.includes(capability)),
            ),
        ),
    )) {
    throw new Error('Invalid Ledger worker identities');
  }

  const observation = beginObservation('ledger', config.operations.observation);
  const clock = { now: () => new Date().toISOString() };
  const metrics = MessagingMetrics.forService('ledger');
  let publisher: DurablePublisher | undefined;
  let consumer: DurableConsumer | undefined;
  let application: ILedgerApplication | undefined;
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
        () => application?.close(),
        () => publisher?.close(),
        () => observation.close(),
      ],
    );
  };

  try {
    publisher = await DurablePublisher.connect(config.broker, metrics);
    application =
      await createLedgerComposition(config, clock, new LedgerPublication(publisher, clock));
    const app = application;
    const payments = createLedgerPaymentWorker(
      app,
      config.namespace,
      config.policies,
      clock,
      config.syntheticPayments,
    );

    consumer = await DurableConsumer.connect(config.consumer, metrics);
    const delivery = consumer;
    const registrations = new PlayerRegisteredConsumer(
      app.operations.provisionPlayerWallet,
      config.registrationRoutes,
      clock,
      config.worker.timeoutMs,
    );

    host =
      await startLedgerTransports(app.operations, config.identity, config.graphql, config.host);
    operations =
      await startOperations(
        config.operations,
        {
          ready: async () => {
            await app.persistence.databaseWaits();
            await publisher?.ready();

            return !stopping;
          },
          metrics: async () => {
            const db = await app.persistence.databaseWaits();
            const counters = app.persistence.metrics();

            return observation.render() + metrics.render()
              + `sportsbook_ledger_posted_transactions_total ${db.committedTransactions}
sportsbook_postgres_wal_bytes_total ${db.walBytes}
sportsbook_postgres_blocks_read_total ${db.blocksRead}
sportsbook_postgres_blocks_hit_total ${db.blocksHit}
sportsbook_postgres_lock_waiting_sessions ${db.lockWaitingSessions}
`
              + Object.entries(counters).filter(
                ([, value]) => typeof value === 'number' && Number.isFinite(value),
              ).map(
                ([key, value]) => `sportsbook_ledger_persistence{metric="${key}"} ${value}
`,
              ).join(
                '',
              );
          },
        },
      );
    loops.push(
      startWorkerLoop(
        config.worker,
        async () => {
          const report = await delivery.consumeBatch(config.worker.limit, message => registrations.handle(message));

          if (report.failed) {
            throw new Error('Registration acknowledgment incomplete');
          }
        },
        error => console.error(JSON.stringify({ service: 'ledger', code: failureCode(error) })),
      ),
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
              recordWorkerBatch('ledger-outbox', result.value.report);
            }
            if (!result.ok || result.value.report.failed) {
              throw new Error('Ledger outbox work incomplete');
            }
          },
        );
      }
      if (actor.capabilities.includes(Capability.PAYMENT_SIMULATOR)) {
        callbacks.push(
          async (context) => {
            const result = await payments.execute(
              { context, batchId: randomUUID(), limit: config.worker.limit, cutoff: clock.now() },
            );

            if (result.ok) {
              recordWorkerBatch('ledger-synthetic', result.value);
            }
            if (!result.ok || result.value.failed) {
              throw new Error('Synthetic payment work incomplete');
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
          error => console.error(JSON.stringify({ service: 'ledger', code: failureCode(error) })),
        ),
      );
    }

    return { close };
  } catch (error) {
    await close();
    throw error;
  }
}
