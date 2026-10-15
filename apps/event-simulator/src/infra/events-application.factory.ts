import { CommandFingerprint } from '../adapters/outbound/ids/command-fingerprint.js';
import { UuidGenerator } from '../adapters/outbound/ids/uuid-generator.js';
import type { IEventsPersistenceSettings } from '../adapters/outbound/persistence/events-persistence.factory.js';
import { createEventsPersistence } from '../adapters/outbound/persistence/events-persistence.factory.js';
import type { IFixtureSettings } from '../adapters/outbound/persistence/seeded-fixtures.js';
import { AdvanceMatchPhaseUseCase } from '../app/use-cases/advance-match-phase.use-case.js';
import { CompleteEventUseCase } from '../app/use-cases/complete-event.use-case.js';
import { GetEventUseCase } from '../app/use-cases/get-event.use-case.js';
import { GetEventResultUseCase } from '../app/use-cases/get-event-result.use-case.js';
import { GetMarketsUseCase } from '../app/use-cases/get-markets.use-case.js';
import { ListEventsUseCase } from '../app/use-cases/list-events.use-case.js';
import { PublishOutboxBatchUseCase } from '../app/use-cases/publish-outbox-batch.use-case.js';
import { ValidateSelectionQuoteUseCase } from '../app/use-cases/validate-selection-quote.use-case.js';
import type { IEventsOperatorSettings } from '../domain/events.model.js';
import type { IEventsOperationPorts } from '../ports/inbound/events-application.port.js';
import type { ClockPort, MessagePublicationPort } from '../ports/outbound/events.port.js';

export interface IEventsApplicationSettings {
  namespace: string;
  persistence: IEventsPersistenceSettings;
  fixtures: readonly IFixtureSettings[];
  operators: readonly IEventsOperatorSettings[];
  outboxRetryMs: number;
}

export async function createEventsApplication(
  config: IEventsApplicationSettings,
  clock: ClockPort,
  publication: MessagePublicationPort,
): Promise<{
  ready(): Promise<void>;
  operations: IEventsOperationPorts;
  close(): Promise<void>;
}> {
  const snapshot = structuredClone(config);

  function freeze(value: unknown): void {
    if (value !== null && typeof value === 'object') {
      Object.freeze(value);

      for (const item of Object.values(value)) {
        freeze(item);
      }
    }
  }
  freeze(snapshot);

  if (!Number.isInteger(snapshot.outboxRetryMs) || snapshot.outboxRetryMs < 1
    || snapshot.outboxRetryMs > 60000) {
    throw new Error('Invalid outbox retry');
  }

  const ids = new UuidGenerator(snapshot.namespace);
  const persistence = await createEventsPersistence(
    snapshot.persistence,
    snapshot.fixtures,
    snapshot.operators,
    ids,
    clock,
  );
  const dependencies = {
    unitOfWork: persistence.unitOfWork,
    clock,
    ids,
    fingerprint: new CommandFingerprint(),
    settings: snapshot.operators,
  };
  const operations: IEventsOperationPorts = {
    listEvents: new ListEventsUseCase(dependencies),
    getEvent: new GetEventUseCase(dependencies),
    getMarkets: new GetMarketsUseCase(dependencies),
    validateSelectionQuote: new ValidateSelectionQuoteUseCase(dependencies),
    getEventResult: new GetEventResultUseCase(dependencies),
    advanceMatchPhase: new AdvanceMatchPhaseUseCase(dependencies),
    completeEvent: new CompleteEventUseCase(dependencies),
    publishOutboxBatch: new PublishOutboxBatchUseCase(
      persistence.outbox,
      publication,
      clock,
      snapshot.outboxRetryMs,
      snapshot.operators,
    ),
  };

  return { ready: () => persistence.ready(), operations, close: () => persistence.close() };
}
