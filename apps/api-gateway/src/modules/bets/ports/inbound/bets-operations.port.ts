import type * as M from '../../../../domain/gateway.model.js';

export interface PlaceBetPort {execute(input:M.IGatewayPlaceBetInput):Promise<M.IResult<M.IGatewayPlaceBetOutput>>;}

export interface GetMyBetPort {execute(input:M.IGatewayGetMyBetInput):Promise<M.IResult<M.IGatewayGetMyBetOutput>>;}

export interface GetMyBetStatusPort {execute(input:M.IGatewayGetMyBetStatusInput):Promise<M.IResult<M.IGatewayGetMyBetStatusOutput>>;}

export interface ListMyBetsPort {execute(input:M.IGatewayListMyBetsInput):Promise<M.IResult<M.IGatewayListMyBetsOutput>>;}

export interface CancelMyBetPort {execute(input:M.IGatewayCancelMyBetInput):Promise<M.IResult<M.IGatewayCancelMyBetOutput>>;}
