import {credentials} from '@grpc/grpc-js';
import * as Wire from '@sportsbook/ledger-client';
import type {IServiceClientSettings} from '@sportsbook/service-transport';
import {boundedServiceFetch, callServiceGrpc, camelWire, GRAPHQL_LIMITS, graphqlServiceFailure, GRPC_LIMITS, jsonWire, objectValue, ServiceCallError, serviceFailure, ServiceIdentity, snake} from '@sportsbook/service-transport';

import * as M from '../../../../../domain/gateway.model.js';
import type {ClockPort} from '../../../../../ports/outbound/gateway.port.js';
import type {WalletCommandPort, WalletQueryPort} from '../../../ports/outbound/wallet.port.js';
import {protobufOutput} from './ledger-wire.js';
import * as Dto from './wallet-client.dto.js';

interface ICall {(operation:string, context:M.ICallContext, body:Record<string, unknown>):Promise<unknown>;}

interface IDescriptor {verb:string;route:string;document:string;field:string;}

const descriptors:Record<string, IDescriptor> = {
  'DepositTestFunds': {
    'verb': 'POST',
    'route': '/internal/v1/wallets/:wallet_id/deposits',
    'document': 'mutation GatewayDepositTestFunds($input:LedgerLedgerDepositTestFundsInputInput!) { depositTestFunds(input:$input) { outcome { requestId  state  transactionId  businessRef  wallet { walletId  playerId  currency  status  availableMinor  reservedMinor  withdrawalHoldMinor  version  observedAt  } reasonCode  replayed  } } }',
    'field': 'depositTestFunds',
  },
  'RequestWithdrawal': {
    'verb': 'POST',
    'route': '/internal/v1/wallets/:wallet_id/withdrawals',
    'document': 'mutation GatewayRequestWithdrawal($input:LedgerLedgerRequestWithdrawalInputInput!) { requestWithdrawal(input:$input) { withdrawal { withdrawalId  walletId  amount { amountMinor  currency  } state  holdTransactionId  resolutionTransactionId  providerRef  reasonCode  createdAt  resolvedAt  } outcome { requestId  state  transactionId  businessRef  wallet { walletId  playerId  currency  status  availableMinor  reservedMinor  withdrawalHoldMinor  version  observedAt  } reasonCode  replayed  } } }',
    'field': 'requestWithdrawal',
  },
  'GetWallet': {
    'verb': 'GET',
    'route': '/internal/v1/players/:player_id/wallets/:currency',
    'document': 'query GatewayGetWallet($input:LedgerLedgerGetWalletInputInput!) { getWallet(input:$input) { wallet { walletId  playerId  currency  status  availableMinor  reservedMinor  withdrawalHoldMinor  version  observedAt  } } }',
    'field': 'getWallet',
  },
  'GetWithdrawal': {
    'verb': 'GET',
    'route': '/internal/v1/withdrawals/:withdrawal_id',
    'document': 'query GatewayGetWithdrawal($input:LedgerLedgerGetWithdrawalInputInput!) { getWithdrawal(input:$input) { withdrawal { withdrawalId  walletId  amount { amountMinor  currency  } state  holdTransactionId  resolutionTransactionId  providerRef  reasonCode  createdAt  resolvedAt  } } }',
    'field': 'getWithdrawal',
  },
  'GetWalletTransactions': {
    'verb': 'GET',
    'route': '/internal/v1/wallets/:wallet_id/transactions',
    'document': 'query GatewayGetWalletTransactions($input:LedgerLedgerGetWalletTransactionsInputInput!) { getWalletTransactions(input:$input) { transactions { transactionId  requestId  transactionType  businessRef  currency  status  postedAt  entries { entryId  accountId  transactionId  entryNo  side  amountMinor  currency  postedAt  } } nextCursor  observedAt  } }',
    'field': 'getWalletTransactions',
  },
};

class WalletClient implements WalletCommandPort, WalletQueryPort {constructor(private readonly call:ICall, readonly close:()=>void, private readonly protobuf:boolean, private readonly graphql = false) {}

deposit(input:M.ILedgerDepositTestFundsInput):Promise<M.IResult<M.ILedgerDepositTestFundsOutput>> {return this.result(input, 'DepositTestFunds', 'ILedgerDepositTestFundsOutput', Dto.isILedgerDepositTestFundsOutput, true);}

requestWithdrawal(input:M.ILedgerRequestWithdrawalInput):Promise<M.IResult<M.ILedgerRequestWithdrawalOutput>> {return this.result(input, 'RequestWithdrawal', 'ILedgerRequestWithdrawalOutput', Dto.isILedgerRequestWithdrawalOutput, true);}

getWallet(input:M.ILedgerGetWalletInput):Promise<M.IResult<M.ILedgerGetWalletOutput>> {return this.result(input, 'GetWallet', 'ILedgerGetWalletOutput', Dto.isILedgerGetWalletOutput, false);}

getWithdrawal(input:M.ILedgerGetWithdrawalInput):Promise<M.IResult<M.ILedgerGetWithdrawalOutput>> {return this.result(input, 'GetWithdrawal', 'ILedgerGetWithdrawalOutput', Dto.isILedgerGetWithdrawalOutput, false);}

listTransactions(input:M.ILedgerGetWalletTransactionsInput):Promise<M.IResult<M.ILedgerGetWalletTransactionsOutput>> {return this.result(input, 'GetWalletTransactions', 'ILedgerGetWalletTransactionsOutput', Dto.isILedgerGetWalletTransactionsOutput, false);}

private async result<T>(input:{context:M.ICallContext}, operation:string, shape:string, guard:(value:unknown)=>value is T, mutates:boolean):Promise<M.IResult<T>> {try {const {context, ...body} = input;const raw = await this.call(operation, context, body);const value = Dto.decodeInput(shape, raw, this.protobuf, this.graphql);

if (!guard(value)) throw new ServiceCallError({code:'ADAPTER_CONTRACT_VIOLATION', retryable:false, outcomeUnknown:mutates});

return {ok:true, value};} catch(error) {const detail = error instanceof ServiceCallError ? error.failure : {code:'ADAPTER_CONTRACT_VIOLATION', retryable:false, outcomeUnknown:mutates};const code = Object.values(M.ErrorCode).find(c=>c === detail.code) ?? M.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

return {ok:false, error:{code, message:code, correlationId:input.context.correlationId, retryable:detail.retryable, outcomeUnknown:detail.outcomeUnknown}};}}}

export class WalletGrpcClient extends WalletClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = new URL('grpc://' + settings.endpoint);

if (!endpoint.hostname || !endpoint.port || endpoint.pathname || endpoint.username || endpoint.password || typeof settings.tls !== 'boolean') throw new Error('Invalid gRPC endpoint');

const native = new Wire.LedgerServiceClient(settings.endpoint, settings.tls ? credentials.createSsl() : credentials.createInsecure(), {'grpc.max_send_message_length':GRPC_LIMITS.requestBytes, 'grpc.max_receive_message_length':GRPC_LIMITS.responseBytes});

super(async(operation, context, body)=>{switch (operation) {
case 'DepositTestFunds':{const request = Wire.DepositTestFundsRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'DepositTestFundsRequest'));

return callServiceGrpc(identity, context, true, (metadata, options, done)=>native.depositTestFunds(request, metadata, options, done), Wire.DepositTestFundsResponse.toJSON);}
case 'RequestWithdrawal':{const request = Wire.RequestWithdrawalRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'RequestWithdrawalRequest'));

return callServiceGrpc(identity, context, true, (metadata, options, done)=>native.requestWithdrawal(request, metadata, options, done), Wire.RequestWithdrawalResponse.toJSON);}
case 'GetWallet':{const request = Wire.GetWalletRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'GetWalletRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.getWallet(request, metadata, options, done), Wire.GetWalletResponse.toJSON);}
case 'GetWithdrawal':{const request = Wire.GetWithdrawalRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'GetWithdrawalRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.getWithdrawal(request, metadata, options, done), Wire.GetWithdrawalResponse.toJSON);}
case 'GetWalletTransactions':{const request = Wire.GetWalletTransactionsRequest.fromJSON(protobufOutput({...body, context:identity.delegate(context)}, 'GetWalletTransactionsRequest'));

return callServiceGrpc(identity, context, false, (metadata, options, done)=>native.getWalletTransactions(request, metadata, options, done), Wire.GetWalletTransactionsResponse.toJSON);}
default:throw new Error('Unregistered RPC');}}, ()=>native.close(), true);}}

export class WalletRestClient extends WalletClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = httpEndpoint(settings.endpoint, settings.tls);

super(async(operation, context, body)=>{const descriptor = descriptors[operation];

if (!descriptor) throw new Error('Unregistered operation');

let route = descriptor.route;const args = {...body};

for (const token of route.matchAll(/:(\w+)/g)) {const key = token[1]?.replace(/_([a-z])/g, (_m, c:string)=>c.toUpperCase()) ?? '';const id = args[key];

if (typeof id !== 'string') throw new Error('Missing route identity');route = route.replace(token[0], encodeURIComponent(id));delete args[key];} const url = new URL(route, endpoint);let init:RequestInit;

if (descriptor.verb === 'GET') {for (const [key, value] of Object.entries(args)) {if (value === undefined) continue;if (key === 'page') {for (const [k, v] of Object.entries(objectValue(value))) if (v !== undefined)url.searchParams.set(snake(k), String(v));} else url.searchParams.set(snake(key), String(value));}init = {method:'GET'};} else init = {method:descriptor.verb, body:JSON.stringify(jsonWire(args, true))};

const response = await boundedServiceFetch(url, init, identity, context, descriptor.verb !== 'GET');

if (response.status < 200 || response.status >= 300) throw serviceFailure(response.body, descriptor.verb !== 'GET');

return camelWire(response.body);}, ()=>{}, false);}}

export class WalletGraphqlClient extends WalletClient {constructor(settings:IServiceClientSettings, clock:ClockPort) {const identity = new ServiceIdentity(settings, ()=>Date.parse(clock.now()));const endpoint = httpEndpoint(settings.endpoint, settings.tls);

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
