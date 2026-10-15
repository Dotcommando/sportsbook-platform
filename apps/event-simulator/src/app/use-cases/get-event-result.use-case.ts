import * as M from '../../domain/events.model.js';
import * as P from '../../domain/events.policy.js';
import type { GetEventResultPort } from '../../ports/inbound/events-operations.port.js';
import type { IEventsDependencies } from '../services/events-operation.service.js';
import { EventsOperationService } from '../services/events-operation.service.js';

export class GetEventResultUseCase implements GetEventResultPort {
  constructor(private readonly dependencies: IEventsDependencies) { }

  execute(input: M.IEventsGetEventResultInput): Promise<M.IResult<M.IEventsGetEventResultOutput>> {
    return new EventsOperationService(this.dependencies).read(input, M.Capability.EVENT_RESULT_READ, async ports => {
      const event = await ports.catalog.find(input.context, input.eventId);

      if (!event) {
        throw new P.EventsError(M.ErrorCode.NOT_FOUND);
      }

      const result = await ports.results.find(input.context, input.eventId);

      return { ready: result !== undefined, ...(result ? { result } : {}) };
    });
  }
}
