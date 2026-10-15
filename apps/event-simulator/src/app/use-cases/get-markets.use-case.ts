import * as M from '../../domain/events.model.js';
import * as P from '../../domain/events.policy.js';
import type { GetMarketsPort } from '../../ports/inbound/events-operations.port.js';
import type { IEventsDependencies } from '../services/events-operation.service.js';
import { EventsOperationService } from '../services/events-operation.service.js';

export class GetMarketsUseCase implements GetMarketsPort {
  constructor(private readonly dependencies: IEventsDependencies) { }

  execute(input: M.IEventsGetMarketsInput): Promise<M.IResult<M.IEventsGetMarketsOutput>> {
    return new EventsOperationService(this.dependencies).read(
      input,
      M.Capability.EVENT_READ,
      async ports => {
        const event = await ports.catalog.find(input.context, input.eventId);

        if (!event) {
          throw new P.EventsError(M.ErrorCode.NOT_FOUND);
        }

        return {
          markets: await ports.quotes.list(input.context, input.eventId),
          observedAt: this.dependencies.clock.now(),
        };
      },
    );
  }
}
