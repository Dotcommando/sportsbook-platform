import type * as M from '../../../../domain/gateway.model.js';

export interface GetMyDashboardPort {
  execute(input: M.IGatewayGetMyDashboardInput): Promise<M.IResult<M.IGatewayGetMyDashboardOutput>>;
}
