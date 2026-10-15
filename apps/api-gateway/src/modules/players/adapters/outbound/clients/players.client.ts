import {credentials} from '@grpc/grpc-js';
import * as Wire from '@sportsbook/player-client';
import type {IServiceClientSettings} from '@sportsbook/service-transport';
import {boundedServiceFetch, callServiceGrpc, camelWire, GRAPHQL_LIMITS, graphqlServiceFailure, GRPC_LIMITS, jsonWire, objectValue, ServiceCallError, serviceFailure, ServiceIdentity, snake} from '@sportsbook/service-transport';

import * as M from '../../../../../domain/gateway.model.js';
import type {ClockPort} from '../../../../../ports/outbound/gateway.port.js';
import type {PlayerCommandPort, PlayerQueryPort} from '../../../ports/outbound/players.port.js';
import {protobufOutput} from './player-wire.js';
import * as Dto from './players-client.dto.js';

interface ICall {(operation:string, context:M.ICallContext, body:Record<string, unknown>):Promise<unknown>;}

interface IDescriptor {verb:string;route:string;document:string;field:string;}

const descriptors:Record<string, IDescriptor> = {
  'RegisterPlayer': {
    'verb': 'POST',
    'route': '/internal/v1/players',
    'document': 'mutation GatewayRegisterPlayer($input:PlayerPlayerRegisterPlayerInputInput!) { registerPlayer(input:$input) { profile { playerId  status  firstName  lastName  birthDate  residenceCountry  nationalityCountry  locale  timeZone  version  createdAt  updatedAt  } created  } }',
    'field': 'registerPlayer',
  },
  'UpdatePlayerProfile': {
    'verb': 'PATCH',
    'route': '/internal/v1/players/:player_id/profile',
    'document': 'mutation GatewayUpdatePlayerProfile($input:PlayerPlayerUpdatePlayerProfileInputInput!) { updatePlayerProfile(input:$input) { profile { playerId  status  firstName  lastName  birthDate  residenceCountry  nationalityCountry  locale  timeZone  version  createdAt  updatedAt  } } }',
    'field': 'updatePlayerProfile',
  },
  'GetPlayer': {
    'verb': 'GET',
    'route': '/internal/v1/players/:player_id',
    'document': 'query GatewayGetPlayer($input:PlayerPlayerGetPlayerInputInput!) { getPlayer(input:$input) { profile { playerId  status  firstName  lastName  birthDate  residenceCountry  nationalityCountry  locale  timeZone  version  createdAt  updatedAt  } contacts { contactId  kind  displayValue  isPrimary  verifiedAt  } } }',
    'field': 'getPlayer',
  },
  'CheckEligibility': {
    'verb': 'POST',
    'route': '/internal/v1/players/:player_id/eligibility-checks',
    'document': 'query GatewayCheckEligibility($input:PlayerPlayerCheckEligibilityInputInput!) { checkEligibility(input:$input) { eligibility { allowed  reasonCode  policyVersion  evaluatedAt  validUntil  playerVersion  } } }',
    'field': 'checkEligibility',
  },
};

class PlayersClient implements PlayerCommandPort, PlayerQueryPort {constructor(private readonly call:ICall, readonly close:()=>void, private readonly protobuf:boolean, private readonly graphql = false) {}

register(input:M.IPlayerRegisterPlayerInput):Promise<M.IResult<M.IPlayerRegisterPlayerOutput>> {return this.result(input, 'RegisterPlayer', 'IPlayerRegisterPlayerOutput', Dto.isIPlayerRegisterPlayerOutput, true);}

updateProfile(input:M.IPlayerUpdatePlayerProfileInput):Promise<M.IResult<M.IPlayerUpdatePlayerProfileOutput>> {return this.result(input, 'UpdatePlayerProfile', 'IPlayerUpdatePlayerProfileOutput', Dto.isIPlayerUpdatePlayerProfileOutput, true);}

getProfile(input:M.IPlayerGetPlayerInput):Promise<M.IResult<M.IPlayerGetPlayerOutput>> {return this.result(input, 'GetPlayer', 'IPlayerGetPlayerOutput', Dto.isIPlayerGetPlayerOutput, false);}

checkEligibility(input:M.IPlayerCheckEligibilityInput):Promise<M.IResult<M.IPlayerCheckEligibilityOutput>> {return this.result(input, 'CheckEligibility', 'IPlayerCheckEligibilityOutput', Dto.isIPlayerCheckEligibilityOutput, false);}

private async result<T>(input:{context:M.ICallContext}, operation:string, shape:string, guard:(value:unknown)=>value is T, mutates:boolean):Promise<M.IResult<T>> {try {const {context, ...body} = input;const raw = await this.call(operation, context, body);const value = Dto.decodeInput(shape, raw, this.protobuf, this.graphql);

if (!guard(value)) throw new ServiceCallError({code:'ADAPTER_CONTRACT_VIOLATION', retryable:false, outcomeUnknown:mutates});

return {ok:true, value};} catch(error) {const detail = error instanceof ServiceCallError ? error.failure : {code:'ADAPTER_CONTRACT_VIOLATION', retryable:false, outcomeUnknown:mutates};const code = Object.values(M.ErrorCode).find(c=>c === detail.code) ?? M.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

return {ok:false, error:{code, message:code, correlationId:input.context.correlationId, retryable:detail.retryable, outcomeUnknown:detail.outcomeUnknown}};}}}

export class PlayersGrpcClient extends PlayersClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = new URL('grpc://' + settings.endpoint);

if (!endpoint.hostname || !endpoint.port || endpoint.pathname || endpoint.username || endpoint.password || typeof settings.tls !== 'boolean') throw new Error('Invalid gRPC endpoint');

const native = new Wire.PlayerServiceClient(settings.endpoint, settings.tls ? credentials.createSsl() : credentials.createInsecure(), {'grpc.max_send_message_length':GRPC_LIMITS.requestBytes, 'grpc.max_receive_message_length':GRPC_LIMITS.responseBytes});

super(async(operation, context, body)=>{switch (operation) {
case 'RegisterPlayer':{const request = Wire.RegisterPlayerRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'RegisterPlayerRequest'));

return callServiceGrpc(identity, context, true, (metadata, options, done)=>native.registerPlayer(request, metadata, options, done), Wire.RegisterPlayerResponse.toJSON);}
case 'UpdatePlayerProfile':{const request = Wire.UpdatePlayerProfileRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'UpdatePlayerProfileRequest'));

return callServiceGrpc(identity, context, true, (metadata, options, done)=>native.updatePlayerProfile(request, metadata, options, done), Wire.UpdatePlayerProfileResponse.toJSON);}
case 'GetPlayer':{const request = Wire.GetPlayerRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'GetPlayerRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.getPlayer(request, metadata, options, done), Wire.GetPlayerResponse.toJSON);}
case 'CheckEligibility':{const request = Wire.CheckEligibilityRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'CheckEligibilityRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.checkEligibility(request, metadata, options, done), Wire.CheckEligibilityResponse.toJSON);}
default:throw new Error('Unregistered RPC');}}, ()=>native.close(), true);}}

export class PlayersRestClient extends PlayersClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = httpEndpoint(settings.endpoint, settings.tls);

super(async(operation, context, body)=>{const descriptor = descriptors[operation];

if (!descriptor) throw new Error('Unregistered operation');

let route = descriptor.route;const args = {...body};

for (const token of route.matchAll(/:(\w+)/g)) {const key = token[1]?.replace(/_([a-z])/g, (_m, c:string)=>c.toUpperCase()) ?? '';const id = args[key];

if (typeof id !== 'string') throw new Error('Missing route identity');route = route.replace(token[0], encodeURIComponent(id));delete args[key];} const url = new URL(route, endpoint);let init:RequestInit;

if (descriptor.verb === 'GET') {for (const [key, value] of Object.entries(args)) {if (value === undefined) continue;if (key === 'page') {for (const [k, v] of Object.entries(objectValue(value))) if (v !== undefined)url.searchParams.set(snake(k), String(v));} else url.searchParams.set(snake(key), String(value));}init = {method:'GET'};} else init = {method:descriptor.verb, body:JSON.stringify(jsonWire(args, true))};

const response = await boundedServiceFetch(url, init, identity, context, (descriptor.verb !== 'GET' && operation !== 'CheckEligibility'));

if (response.status < 200 || response.status >= 300) throw serviceFailure(response.body, (descriptor.verb !== 'GET' && operation !== 'CheckEligibility'));

return camelWire(response.body);}, ()=>{}, false);}}

export class PlayersGraphqlClient extends PlayersClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = httpEndpoint(settings.endpoint, settings.tls);

super(async(operation, context, body)=>{const descriptor = descriptors[operation];

if (!descriptor) throw new Error('Unregistered operation');

const response = await boundedServiceFetch(endpoint, {method:'POST', body:JSON.stringify({query:descriptor.document, operationName:'Gateway' + operation, variables:{input:jsonWire(body)}})}, identity, context, (descriptor.verb !== 'GET' && operation !== 'CheckEligibility'), GRAPHQL_LIMITS);const result = objectValue(response.body);

if (response.status !== 200 || result.errors !== undefined) {const errors = Array.isArray(result.errors) ? result.errors : [];const first = objectValue(errors[0] ?? {});

throw graphqlServiceFailure(first.extensions ?? result, (descriptor.verb !== 'GET' && operation !== 'CheckEligibility'));}

 const data = objectValue(result.data);

if (data[descriptor.field] === undefined) throw new Error('Missing GraphQL result');

return data[descriptor.field];}, ()=>{}, false, true);}}

function httpEndpoint(value:string, tls:boolean):URL {const url = new URL(value);

if (typeof tls !== 'boolean' || tls !== (url.protocol === 'https:') || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw new Error('Explicit service endpoint required');

return url;}
