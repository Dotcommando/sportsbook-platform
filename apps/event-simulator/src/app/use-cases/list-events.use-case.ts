import * as M from '../../domain/events.model.js';
import * as P from '../../domain/events.policy.js';
import type { ListEventsPort } from '../../ports/inbound/events-operations.port.js';
import type { IEventsDependencies } from '../services/events-operation.service.js';
import { EventsOperationService } from '../services/events-operation.service.js';

export class ListEventsUseCase implements ListEventsPort {
  constructor(private readonly dependencies: IEventsDependencies) { }

  execute(input: M.IEventsListEventsInput): Promise<M.IResult<M.IEventsListEventsOutput>> {
    return new EventsOperationService(this.dependencies).read(
      input,
      M.Capability.EVENT_READ,
      async ports => {
        const page = input.page;

        P.requireRule(Number.isInteger(page.limit) && page.limit >= 1 && page.limit <= 200);

        if (page.from) {
          P.requireRule(P.validInstant(page.from));
        }
        if (page.to) {
          P.requireRule(P.validInstant(page.to));
        }
        P.requireRule(!page.from || !page.to || Date.parse(page.from) <= Date.parse(page.to));
        const result = await ports.catalog.list(input.context, page, input.phase);

        return {
          events: result.items,
          ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
          observedAt: this.dependencies.clock.now(),
        };
      },
    );
  }
}
