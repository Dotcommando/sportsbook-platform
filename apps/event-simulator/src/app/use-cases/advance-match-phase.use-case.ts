import * as M from '../../domain/events.model.js';
import { EventsError } from '../../domain/events.policy.js';
import * as Output from '../../domain/events-output.policy.js';
import { Match } from '../../domain/match.policy.js';
import type { AdvanceMatchPhasePort } from '../../ports/inbound/events-operations.port.js';
import type { IEventsDependencies } from '../services/events-operation.service.js';
import { EventsOperationService } from '../services/events-operation.service.js';

export class AdvanceMatchPhaseUseCase implements AdvanceMatchPhasePort {
  constructor(private readonly dependencies: IEventsDependencies) { }

  execute(input: M.IEventsAdvanceMatchPhaseInput): Promise<M.IResult<M.IEventsAdvanceMatchPhaseOutput>> {
    return new EventsOperationService(this.dependencies).command(
      'AdvanceMatchPhase',
      input,
      Output.isIEventsAdvanceMatchPhaseOutput,
      async (ports, messageId) => {
        const previous = await ports.catalog.find(input.context, input.eventId);

        if (!previous) {
          throw new EventsError(M.ErrorCode.NOT_FOUND);
        }
        Match.advance(previous, input.expectedPhaseSeq, input.nextPhase, input.simulatedAt);
        const event = await ports.catalog.changePhase(
          input.context,
          input.eventId,
          input.expectedPhaseSeq,
          input.nextPhase,
          input.simulatedAt,
        );

        await ports.quotes.changeMarketStates(input.context, input.eventId, event.phase, event.phaseSeq);
        const envelope: M.IEventEnvelope = {
          messageId,
          source: M.EventSource.EVENTS,
          eventType: M.EventType.MATCH_PHASE_CHANGED,
          schemaVersion: 1,
          operatorId: input.context.operatorId,
          correlationId: input.context.correlationId,
          occurredAt: this.dependencies.clock.now(),
          payload: {
            eventId: event.eventId,
            runId: event.runId,
            phase: event.phase,
            phaseSeq: event.phaseSeq,
            simulatedAt: event.simulatedAt,
          },
        };

        await ports.resultIntent.storePhaseIntent(input.context, event, envelope);

        return { event };
      },
    );
  }
}
