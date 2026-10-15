import type * as M from '../../../../domain/gateway.model.js';

export interface RegisterPlayerPort {
  execute(input: M.IGatewayRegisterPlayerInput): Promise<M.IResult<M.IGatewayRegisterPlayerOutput>>;
}

export interface GetMyProfilePort {
  execute(input: M.IGatewayGetMyProfileInput): Promise<M.IResult<M.IGatewayGetMyProfileOutput>>;
}

export interface UpdateMyProfilePort {
  execute(input: M.IGatewayUpdateMyProfileInput): Promise<M.IResult<M.IGatewayUpdateMyProfileOutput>>;
}

export interface GetMyEligibilityPort {
  execute(input: M.IGatewayGetMyEligibilityInput): Promise<M.IResult<M.IGatewayGetMyEligibilityOutput>>;
}
