import type * as M from '../../../../domain/gateway.model.js';

export interface ListEventsPort {
  execute(input: M.IGatewayListEventsInput): Promise<M.IResult<M.IGatewayListEventsOutput>>;
}

export interface GetEventPort {
  execute(input: M.IGatewayGetEventInput): Promise<M.IResult<M.IGatewayGetEventOutput>>;
}

export interface ListMarketsPort {
  execute(input: M.IGatewayListMarketsInput): Promise<M.IResult<M.IGatewayListMarketsOutput>>;
}
