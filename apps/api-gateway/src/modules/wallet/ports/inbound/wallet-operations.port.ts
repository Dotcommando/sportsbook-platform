import type * as M from '../../../../domain/gateway.model.js';

export interface GetMyBalancePort {execute(input:M.IGatewayGetMyBalanceInput):Promise<M.IResult<M.IGatewayGetMyBalanceOutput>>;}

export interface TopUpTestWalletPort {execute(input:M.IGatewayTopUpTestWalletInput):Promise<M.IResult<M.IGatewayTopUpTestWalletOutput>>;}

export interface RequestMyWithdrawalPort {execute(input:M.IGatewayRequestMyWithdrawalInput):Promise<M.IResult<M.IGatewayRequestMyWithdrawalOutput>>;}

export interface GetMyWithdrawalPort {execute(input:M.IGatewayGetMyWithdrawalInput):Promise<M.IResult<M.IGatewayGetMyWithdrawalOutput>>;}

export interface GetMyTransactionsPort {execute(input:M.IGatewayGetMyTransactionsInput):Promise<M.IResult<M.IGatewayGetMyTransactionsOutput>>;}
