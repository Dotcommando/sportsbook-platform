import type * as M from '../../../../domain/gateway.model.js';

export interface EventCatalogPort {
  listEvents(input: M.IEventsListEventsInput): Promise<M.IResult<M.IEventsListEventsOutput>>;
  getEvent(input: M.IEventsGetEventInput): Promise<M.IResult<M.IEventsGetEventOutput>>;
  listMarkets(input: M.IEventsGetMarketsInput): Promise<M.IResult<M.IEventsGetMarketsOutput>>;
}
