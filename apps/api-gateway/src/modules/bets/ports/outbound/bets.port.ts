import type * as M from '../../../../domain/gateway.model.js';

export interface BetCommandPort {place(input:M.IBettingPlaceBetInput):Promise<M.IResult<M.IBettingPlaceBetOutput>>;cancel(input:M.IBettingCancelBetInput):Promise<M.IResult<M.IBettingCancelBetOutput>>;}

export interface BetQueryPort {get(input:M.IBettingGetBetInput):Promise<M.IResult<M.IBettingGetBetOutput>>;status(input:M.IBettingGetBetStatusInput):Promise<M.IResult<M.IBettingGetBetStatusOutput>>;list(input:M.IBettingListPlayerBetsInput):Promise<M.IResult<M.IBettingListPlayerBetsOutput>>;}
