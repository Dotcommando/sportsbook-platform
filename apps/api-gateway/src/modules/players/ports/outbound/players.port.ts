import type * as M from '../../../../domain/gateway.model.js';

export interface PlayerCommandPort {register(input:M.IPlayerRegisterPlayerInput):Promise<M.IResult<M.IPlayerRegisterPlayerOutput>>;updateProfile(input:M.IPlayerUpdatePlayerProfileInput):Promise<M.IResult<M.IPlayerUpdatePlayerProfileOutput>>;}

export interface PlayerQueryPort {getProfile(input:M.IPlayerGetPlayerInput):Promise<M.IResult<M.IPlayerGetPlayerOutput>>;checkEligibility(input:M.IPlayerCheckEligibilityInput):Promise<M.IResult<M.IPlayerCheckEligibilityOutput>>;}
