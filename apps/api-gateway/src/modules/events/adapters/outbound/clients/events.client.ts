import {credentials} from '@grpc/grpc-js';
import * as Wire from '@sportsbook/events-client';
import type {IServiceClientSettings} from '@sportsbook/service-transport';
import {boundedServiceFetch, callServiceGrpc, camelWire, GRAPHQL_LIMITS, graphqlServiceFailure, GRPC_LIMITS, jsonWire, objectValue, ServiceCallError, serviceFailure, ServiceIdentity, snake} from '@sportsbook/service-transport';

import * as M from '../../../../../domain/gateway.model.js';
import type {ClockPort} from '../../../../../ports/outbound/gateway.port.js';
import type {EventCatalogPort} from '../../../ports/outbound/events.port.js';
import * as Dto from './events-client.dto.js';
import {protobufOutput} from './events-wire.js';

interface ICall {(operation:string, context:M.ICallContext, body:Record<string, unknown>):Promise<unknown>;}

interface IDescriptor {verb:string;route:string;document:string;field:string;}

const descriptors:Record<string, IDescriptor> = {
  'ListEvents': {
    'verb': 'GET',
    'route': '/internal/v1/events',
    'document': 'query GatewayListEvents($input:EventsEventsListEventsInputInput!) { listEvents(input:$input) { events { eventId  runId  sport  homeTeam  awayTeam  startsAt  phase  phaseSeq  simulatedAt  resultRef  } nextCursor  observedAt  } }',
    'field': 'listEvents',
  },
  'GetEvent': {
    'verb': 'GET',
    'route': '/internal/v1/events/:event_id',
    'document': 'query GatewayGetEvent($input:EventsEventsGetEventInputInput!) { getEvent(input:$input) { event { eventId  runId  sport  homeTeam  awayTeam  startsAt  phase  phaseSeq  simulatedAt  resultRef  } } }',
    'field': 'getEvent',
  },
  'GetMarkets': {
    'verb': 'GET',
    'route': '/internal/v1/events/:event_id/markets',
    'document': 'query GatewayGetMarkets($input:EventsEventsGetMarketsInputInput!) { getMarkets(input:$input) { markets { marketId  eventId  type  state  selections { quoteId  quoteVersion  eventId  marketId  selectionId  selection  odds  validUntil  state  } } observedAt  } }',
    'field': 'getMarkets',
  },
};

class EventsClient implements EventCatalogPort {constructor(private readonly call:ICall, readonly close:()=>void, private readonly protobuf:boolean, private readonly graphql = false) {}

listEvents(input:M.IEventsListEventsInput):Promise<M.IResult<M.IEventsListEventsOutput>> {return this.result(input, 'ListEvents', 'IEventsListEventsOutput', Dto.isIEventsListEventsOutput, false);}

getEvent(input:M.IEventsGetEventInput):Promise<M.IResult<M.IEventsGetEventOutput>> {return this.result(input, 'GetEvent', 'IEventsGetEventOutput', Dto.isIEventsGetEventOutput, false);}

listMarkets(input:M.IEventsGetMarketsInput):Promise<M.IResult<M.IEventsGetMarketsOutput>> {return this.result(input, 'GetMarkets', 'IEventsGetMarketsOutput', Dto.isIEventsGetMarketsOutput, false);}

private async result<T>(input:{context:M.ICallContext}, operation:string, shape:string, guard:(value:unknown)=>value is T, mutates:boolean):Promise<M.IResult<T>> {try {const {context, ...body} = input;const raw = await this.call(operation, context, body);const value = Dto.decodeInput(shape, raw, this.protobuf, this.graphql);

if (!guard(value)) throw new ServiceCallError({code:'ADAPTER_CONTRACT_VIOLATION', retryable:false, outcomeUnknown:mutates});

return {ok:true, value};} catch(error) {const detail = error instanceof ServiceCallError ? error.failure : {code:'ADAPTER_CONTRACT_VIOLATION', retryable:false, outcomeUnknown:mutates};const code = Object.values(M.ErrorCode).find(c=>c === detail.code) ?? M.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

return {ok:false, error:{code, message:code, correlationId:input.context.correlationId, retryable:detail.retryable, outcomeUnknown:detail.outcomeUnknown}};}}}

export class EventsGrpcClient extends EventsClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = new URL('grpc://' + settings.endpoint);

if (!endpoint.hostname || !endpoint.port || endpoint.pathname || endpoint.username || endpoint.password || typeof settings.tls !== 'boolean') throw new Error('Invalid gRPC endpoint');

const native = new Wire.EventsServiceClient(settings.endpoint, settings.tls ? credentials.createSsl() : credentials.createInsecure(), {'grpc.max_send_message_length':GRPC_LIMITS.requestBytes, 'grpc.max_receive_message_length':GRPC_LIMITS.responseBytes});

super(async(operation, context, body)=>{switch (operation) {
case 'ListEvents':{const request = Wire.ListEventsRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'ListEventsRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.listEvents(request, metadata, options, done), Wire.ListEventsResponse.toJSON);}
case 'GetEvent':{const request = Wire.GetEventRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'GetEventRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.getEvent(request, metadata, options, done), Wire.GetEventResponse.toJSON);}
case 'GetMarkets':{const request = Wire.GetMarketsRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'GetMarketsRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.getMarkets(request, metadata, options, done), Wire.GetMarketsResponse.toJSON);}
default:throw new Error('Unregistered RPC');}}, ()=>native.close(), true);}}

export class EventsRestClient extends EventsClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = httpEndpoint(settings.endpoint, settings.tls);

super(async(operation, context, body)=>{const descriptor = descriptors[operation];

if (!descriptor) throw new Error('Unregistered operation');

let route = descriptor.route;const args = {...body};

for (const token of route.matchAll(/:(\w+)/g)) {const key = token[1]?.replace(/_([a-z])/g, (_m, c:string)=>c.toUpperCase()) ?? '';const id = args[key];

if (typeof id !== 'string') throw new Error('Missing route identity');route = route.replace(token[0], encodeURIComponent(id));delete args[key];} const url = new URL(route, endpoint);let init:RequestInit;

if (descriptor.verb === 'GET') {for (const [key, value] of Object.entries(args)) {if (value === undefined) continue;if (key === 'page') {for (const [k, v] of Object.entries(objectValue(value))) if (v !== undefined)url.searchParams.set(snake(k), String(v));} else url.searchParams.set(snake(key), String(value));}init = {method:'GET'};} else init = {method:descriptor.verb, body:JSON.stringify(jsonWire(args, true))};

const response = await boundedServiceFetch(url, init, identity, context, descriptor.verb !== 'GET');

if (response.status < 200 || response.status >= 300) throw serviceFailure(response.body, descriptor.verb !== 'GET');

return camelWire(response.body);}, ()=>{}, false);}}

export class EventsGraphqlClient extends EventsClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = httpEndpoint(settings.endpoint, settings.tls);

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
