import {Controller, Get, Inject, Post, Req, Res} from '@nestjs/common';
import { camelWire, jsonWire, objectValue } from '@sportsbook/service-transport';

import { BETTING_BOUNDARY } from '../../../infra/betting-transport.tokens.js';
import {BettingBoundary} from '../shared/betting-boundary.js';

export interface IRestRequest {body:unknown;params:Record<string, string>;query:Record<string, unknown>;headers:Record<string, unknown>;}

export interface IRestResponse {status(code:number):IRestResponse;json(value:unknown):unknown;setHeader(key:string, value:string):void;}

@Controller()
export class BettingRestController {constructor(@Inject(BETTING_BOUNDARY) private readonly boundary:BettingBoundary) {}

@Post('/internal/v1/bets')
async placeBet(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.body ?? {}));
const result = await this.boundary.execute('PlaceBet', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}

@Get('/internal/v1/bets/:bet_id')
async getBet(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.query ?? {}));

if ('betId' in body && body.betId !== request.params.bet_id) return response.status(400).json({code:'INVALID_INPUT'});body.betId = request.params.bet_id;
const result = await this.boundary.execute('GetBet', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}

@Get('/internal/v1/players/:player_id/bets')
async listPlayerBets(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.query ?? {}));

if ('playerId' in body && body.playerId !== request.params.player_id) return response.status(400).json({code:'INVALID_INPUT'});body.playerId = request.params.player_id;
const page = {limit:body.limit === undefined ? 50 : Number(body.limit), ...(body.cursor === undefined ? {} : {cursor:body.cursor}), ...(body.from === undefined ? {} : {from:body.from}), ...(body.to === undefined ? {} : {to:body.to})};

for (const key of ['limit', 'cursor', 'from', 'to']) delete body[key];body.page = page;
const result = await this.boundary.execute('ListPlayerBets', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}

@Get('/internal/v1/bets/:bet_id/status')
async getBetStatus(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.query ?? {}));

if ('betId' in body && body.betId !== request.params.bet_id) return response.status(400).json({code:'INVALID_INPUT'});body.betId = request.params.bet_id;
const result = await this.boundary.execute('GetBetStatus', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}

@Post('/internal/v1/bets/:bet_id/cancellations')
async cancelBet(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.body ?? {}));

if ('betId' in body && body.betId !== request.params.bet_id) return response.status(400).json({code:'INVALID_INPUT'});body.betId = request.params.bet_id;
const result = await this.boundary.execute('CancelBet', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}

@Post('/internal/v1/event-results')
async recordEventResult(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.body ?? {}));
const result = await this.boundary.execute('RecordEventResult', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}

@Post('/internal/v1/bets/:bet_id/settlements')
async settleBet(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.body ?? {}));

if ('betId' in body && body.betId !== request.params.bet_id) return response.status(400).json({code:'INVALID_INPUT'});body.betId = request.params.bet_id;
const result = await this.boundary.execute('SettleBet', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}

@Post('/internal/v1/recovery/reservations')
async retryPendingReservation(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.body ?? {}));
const result = await this.boundary.execute('RetryPendingReservation', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}

@Post('/internal/v1/recovery/settlements')
async retryPendingSettlement(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.body ?? {}));
const result = await this.boundary.execute('RetryPendingSettlement', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}

@Post('/internal/v1/reconciliation-runs')
async reconcileBetWithLedger(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.body ?? {}));
const result = await this.boundary.execute('ReconcileBetWithLedger', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}

@Post('/internal/v1/recovery/cancellations')
async retryPendingCancellation(@Req() request:IRestRequest, @Res() response:IRestResponse):Promise<unknown> {
const body = objectValue(camelWire(request.body ?? {}));
const result = await this.boundary.execute('RetryPendingCancellation', body, {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']});

if (!result.ok) {response.setHeader('x-correlation-id', result.error.correlationId);

return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));}

 return response.status(200).json(jsonWire(result.value, true));}
}

export function httpCode(code:string):number {return ({INVALID_INPUT:400, AMOUNT_OUT_OF_RANGE:400, CURRENCY_MISMATCH:400, UNAUTHENTICATED:401, PERMISSION_DENIED:403, NOT_FOUND:404, IDEMPOTENCY_CONFLICT:409, VERSION_CONFLICT:409, IN_PROGRESS:202, OVERLOADED:429, DEADLINE_EXCEEDED:504, DEPENDENCY_UNAVAILABLE:503, ADAPTER_CONTRACT_VIOLATION:500, INVARIANT_VIOLATION:500}[code] ?? 422);}
