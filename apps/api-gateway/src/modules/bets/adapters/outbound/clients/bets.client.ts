import {credentials} from '@grpc/grpc-js';
import * as Wire from '@sportsbook/betting-client';
import type {IServiceClientSettings} from '@sportsbook/service-transport';
import {boundedServiceFetch, callServiceGrpc, camelWire, GRAPHQL_LIMITS, graphqlServiceFailure, GRPC_LIMITS, jsonWire, objectValue, ServiceCallError, serviceFailure, ServiceIdentity, snake} from '@sportsbook/service-transport';

import * as M from '../../../../../domain/gateway.model.js';
import type {ClockPort} from '../../../../../ports/outbound/gateway.port.js';
import type {BetCommandPort, BetQueryPort} from '../../../ports/outbound/bets.port.js';
import * as Dto from './bets-client.dto.js';
import {protobufOutput} from './betting-wire.js';

interface ICall {(operation:string, context:M.ICallContext, body:Record<string, unknown>):Promise<unknown>;}

interface IDescriptor {verb:string;route:string;document:string;field:string;}

const descriptors:Record<string, IDescriptor> = {
  'PlaceBet': {
    'verb': 'POST',
    'route': '/internal/v1/bets',
    'document': 'mutation GatewayPlaceBet($input:BettingBettingPlaceBetInputInput!) { placeBet(input:$input) { bet { betId  playerId  type  status  stake { amountMinor  currency  } potentialPayoutMinor  actualPayoutMinor  legs { legId  legNo  eventId  marketId  selectionId  quote { quoteId  quoteVersion  eventId  marketId  selectionId  selection  odds  validUntil  state  } state  resultRef  } createdAt  acceptedAt  settledAt  reasonCode  version  } outcome  } }',
    'field': 'placeBet',
  },
  'CancelBet': {
    'verb': 'POST',
    'route': '/internal/v1/bets/:bet_id/cancellations',
    'document': 'mutation GatewayCancelBet($input:BettingBettingCancelBetInputInput!) { cancelBet(input:$input) { bet { betId  playerId  type  status  stake { amountMinor  currency  } potentialPayoutMinor  actualPayoutMinor  legs { legId  legNo  eventId  marketId  selectionId  quote { quoteId  quoteVersion  eventId  marketId  selectionId  selection  odds  validUntil  state  } state  resultRef  } createdAt  acceptedAt  settledAt  reasonCode  version  } outcome  } }',
    'field': 'cancelBet',
  },
  'GetBet': {
    'verb': 'GET',
    'route': '/internal/v1/bets/:bet_id',
    'document': 'query GatewayGetBet($input:BettingBettingGetBetInputInput!) { getBet(input:$input) { bet { betId  playerId  type  status  stake { amountMinor  currency  } potentialPayoutMinor  actualPayoutMinor  legs { legId  legNo  eventId  marketId  selectionId  quote { quoteId  quoteVersion  eventId  marketId  selectionId  selection  odds  validUntil  state  } state  resultRef  } createdAt  acceptedAt  settledAt  reasonCode  version  } } }',
    'field': 'getBet',
  },
  'GetBetStatus': {
    'verb': 'GET',
    'route': '/internal/v1/bets/:bet_id/status',
    'document': 'query GatewayGetBetStatus($input:BettingBettingGetBetStatusInputInput!) { getBetStatus(input:$input) { betId  status  financialState  version  observedAt  } }',
    'field': 'getBetStatus',
  },
  'ListPlayerBets': {
    'verb': 'GET',
    'route': '/internal/v1/players/:player_id/bets',
    'document': 'query GatewayListPlayerBets($input:BettingBettingListPlayerBetsInputInput!) { listPlayerBets(input:$input) { bets { betId  playerId  type  status  stake { amountMinor  currency  } potentialPayoutMinor  actualPayoutMinor  legs { legId  legNo  eventId  marketId  selectionId  quote { quoteId  quoteVersion  eventId  marketId  selectionId  selection  odds  validUntil  state  } state  resultRef  } createdAt  acceptedAt  settledAt  reasonCode  version  } nextCursor  observedAt  } }',
    'field': 'listPlayerBets',
  },
};

class BetsClient implements BetCommandPort, BetQueryPort {constructor(private readonly call:ICall, readonly close:()=>void, private readonly protobuf:boolean, private readonly graphql = false) {}

place(input:M.IBettingPlaceBetInput):Promise<M.IResult<M.IBettingPlaceBetOutput>> {return this.result(input, 'PlaceBet', 'IBettingPlaceBetOutput', Dto.isIBettingPlaceBetOutput, true);}

cancel(input:M.IBettingCancelBetInput):Promise<M.IResult<M.IBettingCancelBetOutput>> {return this.result(input, 'CancelBet', 'IBettingCancelBetOutput', Dto.isIBettingCancelBetOutput, true);}

get(input:M.IBettingGetBetInput):Promise<M.IResult<M.IBettingGetBetOutput>> {return this.result(input, 'GetBet', 'IBettingGetBetOutput', Dto.isIBettingGetBetOutput, false);}

status(input:M.IBettingGetBetStatusInput):Promise<M.IResult<M.IBettingGetBetStatusOutput>> {return this.result(input, 'GetBetStatus', 'IBettingGetBetStatusOutput', Dto.isIBettingGetBetStatusOutput, false);}

list(input:M.IBettingListPlayerBetsInput):Promise<M.IResult<M.IBettingListPlayerBetsOutput>> {return this.result(input, 'ListPlayerBets', 'IBettingListPlayerBetsOutput', Dto.isIBettingListPlayerBetsOutput, false);}

private async result<T>(input:{context:M.ICallContext}, operation:string, shape:string, guard:(value:unknown)=>value is T, mutates:boolean):Promise<M.IResult<T>> {try {const {context, ...body} = input;const raw = await this.call(operation, context, body);const value = Dto.decodeInput(shape, raw, this.protobuf, this.graphql);

if (!guard(value)) throw new ServiceCallError({code:'ADAPTER_CONTRACT_VIOLATION', retryable:false, outcomeUnknown:mutates});

return {ok:true, value};} catch(error) {const detail = error instanceof ServiceCallError ? error.failure : {code:'ADAPTER_CONTRACT_VIOLATION', retryable:false, outcomeUnknown:mutates};const code = Object.values(M.ErrorCode).find(c=>c === detail.code) ?? M.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

return {ok:false, error:{code, message:code, correlationId:input.context.correlationId, retryable:detail.retryable, outcomeUnknown:detail.outcomeUnknown}};}}}

export class BetsGrpcClient extends BetsClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = new URL('grpc://' + settings.endpoint);

if (!endpoint.hostname || !endpoint.port || endpoint.pathname || endpoint.username || endpoint.password || typeof settings.tls !== 'boolean') throw new Error('Invalid gRPC endpoint');

const native = new Wire.BettingServiceClient(settings.endpoint, settings.tls ? credentials.createSsl() : credentials.createInsecure(), {'grpc.max_send_message_length':GRPC_LIMITS.requestBytes, 'grpc.max_receive_message_length':GRPC_LIMITS.responseBytes});

super(async(operation, context, body)=>{switch (operation) {
case 'PlaceBet':{const request = Wire.PlaceBetRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'PlaceBetRequest'));

return callServiceGrpc(identity, context, true, (metadata, options, done)=>native.placeBet(request, metadata, options, done), Wire.PlaceBetResponse.toJSON);}
case 'CancelBet':{const request = Wire.CancelBetRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'CancelBetRequest'));

return callServiceGrpc(identity, context, true, (metadata, options, done)=>native.cancelBet(request, metadata, options, done), Wire.CancelBetResponse.toJSON);}
case 'GetBet':{const request = Wire.GetBetRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'GetBetRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.getBet(request, metadata, options, done), Wire.GetBetResponse.toJSON);}
case 'GetBetStatus':{const request = Wire.GetBetStatusRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'GetBetStatusRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.getBetStatus(request, metadata, options, done), Wire.GetBetStatusResponse.toJSON);}
case 'ListPlayerBets':{const request = Wire.ListPlayerBetsRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'ListPlayerBetsRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.listPlayerBets(request, metadata, options, done), Wire.ListPlayerBetsResponse.toJSON);}
default:throw new Error('Unregistered RPC');}}, ()=>native.close(), true);}}

export class BetsRestClient extends BetsClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = httpEndpoint(settings.endpoint, settings.tls);

super(async(operation, context, body)=>{const descriptor = descriptors[operation];

if (!descriptor) throw new Error('Unregistered operation');

let route = descriptor.route;const args = {...body};

for (const token of route.matchAll(/:(\w+)/g)) {const key = token[1]?.replace(/_([a-z])/g, (_m, c:string)=>c.toUpperCase()) ?? '';const id = args[key];

if (typeof id !== 'string') throw new Error('Missing route identity');route = route.replace(token[0], encodeURIComponent(id));delete args[key];} const url = new URL(route, endpoint);let init:RequestInit;

if (descriptor.verb === 'GET') {for (const [key, value] of Object.entries(args)) {if (value === undefined) continue;if (key === 'page') {for (const [k, v] of Object.entries(objectValue(value))) if (v !== undefined)url.searchParams.set(snake(k), String(v));} else url.searchParams.set(snake(key), String(value));}init = {method:'GET'};} else init = {method:descriptor.verb, body:JSON.stringify(jsonWire(args, true))};

const response = await boundedServiceFetch(url, init, identity, context, descriptor.verb !== 'GET');

if (response.status < 200 || response.status >= 300) throw serviceFailure(response.body, descriptor.verb !== 'GET');

return camelWire(response.body);}, ()=>{}, false);}}

export class BetsGraphqlClient extends BetsClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = httpEndpoint(settings.endpoint, settings.tls);

super(async(operation, context, body)=>{const descriptor = descriptors[operation];

if (!descriptor) throw new Error('Unregistered operation');

const response = await boundedServiceFetch(endpoint, {method:'POST', body:JSON.stringify({query:descriptor.document, operationName:'Gateway' + operation, variables:{input:jsonWire(body)}})}, identity, context, descriptor.verb !== 'GET', GRAPHQL_LIMITS);const result = objectValue(response.body);

if (response.status !== 200 || result.errors !== undefined) {const errors = Array.isArray(result.errors) ? result.errors : [];const first = objectValue(errors[0] ?? {});

throw graphqlServiceFailure(first.extensions ?? result, descriptor.verb !== 'GET');}

 const data = objectValue(result.data);

if (data[descriptor.field] === undefined) throw new Error('Missing GraphQL result');

return data[descriptor.field];}, ()=>{}, false, true);}}

function httpEndpoint(value:string, tls:boolean):URL {const url = new URL(value);

if (typeof tls !== 'boolean' || tls !== (url.protocol === 'https:') || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw new Error('Explicit service endpoint required');

return url;}
