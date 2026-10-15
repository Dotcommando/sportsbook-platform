import 'reflect-metadata';

import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createServer} from 'node:net';
import path from 'node:path';
import test from 'node:test';

import {credentials, Metadata} from '@grpc/grpc-js';
import * as Wire from '@sportsbook/betting-client';
import {objectValue} from '@sportsbook/service-transport';

import {protobufOutput} from '../src/adapters/inbound/grpc/betting-wire.js';
import * as M from '../src/domain/betting.model.js';
import {failure} from '../src/domain/betting.policy.js';
import {startBettingTransports} from '../src/infra/betting-transport.module.js';
import type {IBettingOperationPorts} from '../src/ports/inbound/betting-application.port.js';

test('Betting private transports preserve bigint/quote snapshots and reject identity overrides', async()=>{
  const id = '00000000-0000-4000-8000-000000000001';const now = new Date().toISOString();const version = 9007199254740993n;let calls = 0;const context:M.ICallContext = {operatorId:id, actorId:id, actorKind:M.ActorKind.SYSTEM, playerId:id, capabilities:Object.values(M.Capability), correlationId:id, deadlineAt:new Date(Date.now() + 30000).toISOString()};
  const bet:M.IBetView = {betId:id, playerId:id, type:M.BetType.SINGLE, status:M.BetStatus.ACCEPTED, stake:{amountMinor:9007199254740993n, currency:'USD'}, potentialPayoutMinor:18014398509481986n, version, createdAt:now, acceptedAt:now, legs:[{legId:id, legNo:1, eventId:id, marketId:id, selectionId:id, state:M.BetLegState.PENDING, quote:{quoteId:id, quoteVersion:1n, eventId:id, marketId:id, selectionId:id, selection:M.Selection.HOME, odds:'2.00000000', state:M.MarketState.OPEN, validUntil:context.deadlineAt}}]};const reject = async():Promise<{ok:false;error:M.IError}>=>failure(M.ErrorCode.NOT_FOUND, context);
  const operations:IBettingOperationPorts = {placeBet:{execute:async()=>{calls++;

return {ok:true, value:{bet, outcome:M.PlaceOutcome.ACCEPTED}};}},
getBet:{execute:async()=>({ok:true, value:{bet}})},
listPlayerBets:{execute:async()=>({ok:true, value:{bets:[bet], observedAt:now}})},
getBetStatus:{execute:async()=>({ok:true, value:{betId:id, status:bet.status, financialState:M.FinancialState.RESERVED, version, observedAt:now}})},
cancelBet:{execute:reject},
recordEventResult:{execute:reject},
settleBet:{execute:reject},
retryPendingReservation:{execute:reject},
retryPendingSettlement:{execute:reject},
retryPendingCancellation:{execute:reject},
reconcileBetWithLedger:{execute:reject},
scheduleEventSettlements:{execute:reject},
publishOutboxBatch:{execute:reject}};
  const probe = createServer();

await new Promise<void>(resolve=>probe.listen(0, '127.0.0.1', resolve));const address = probe.address();

assert.ok(address && typeof address === 'object');const port = address.port;

await new Promise<void>(resolve=>probe.close(()=>resolve()));const identity = {issuer:'synthetic', audience:'betting', key:'test-key-at-least-thirty-two-bytes', maximumDeadlineMs:60000};const header = Buffer.from(JSON.stringify({alg:'HS256', typ:'JWT'})).toString('base64url');const payload = Buffer.from(JSON.stringify({iss:identity.issuer, aud:identity.audience, iat:Math.floor(Date.now() / 1000), exp:Math.floor(Date.now() / 1000) + 60, ...context})).toString('base64url');const authorization = 'Bearer ' + header + '.' + payload + '.' + createHmac('sha256', identity.key).update(header + '.' + payload).digest('base64url');const headers = {authorization, 'x-correlation-id':id, 'x-deadline-at':context.deadlineAt, 'content-type':'application/json'};
  const host = await startBettingTransports(operations, identity, {maximumBytes:65536, maximumDepth:8, maximumRootFields:20, maximumCost:1000, introspection:false}, {host:'127.0.0.1', httpPort:0, grpcPort:port, protoPath:path.resolve(import.meta.dirname, '../../../packages/contracts/proto/sportsbook/betting/v1/betting.proto'), protobufPackage:'sportsbook.betting.v1'});const base = await host.http.getUrl();const client = new Wire.BettingServiceClient('127.0.0.1:' + port, credentials.createInsecure());const body = {requestId:id, playerId:id, type:'SINGLE', stake:{amountMinor:'9007199254740993', currency:'USD'}, selection:{eventId:id, marketId:id, selectionId:id, quoteId:id, quoteVersion:'1'}};

  try {const rest = await fetch(base + '/internal/v1/bets', {method:'POST', headers, body:JSON.stringify(body)});

assert.equal(rest.status, 200);assert.equal(objectValue(objectValue(objectValue(await rest.json()).bet).stake).amount_minor, '9007199254740993');const metadata = new Metadata();

metadata.set('authorization', authorization);const rpc = await new Promise<unknown>((resolve, reject)=>client.placeBet(Wire.PlaceBetRequest.fromJSON(protobufOutput({...body, context}, 'PlaceBetRequest')), metadata, (error, result)=>error ? reject(error) : resolve(Wire.PlaceBetResponse.toJSON(result))));

assert.equal(objectValue(objectValue(objectValue(rpc).value).bet).version, version.toString());
    const graph = objectValue(await(await fetch(base + '/internal/graphql', {method:'POST', headers, body:JSON.stringify({query:'mutation($input:BettingBettingPlaceBetInputInput!){placeBet(input:$input){outcome bet{betId version player{playerId} event{eventId}}}}', variables:{input:body}})})).json());

assert.equal(graph.errors, undefined, JSON.stringify(graph));assert.equal(calls, 3);
    const entities = objectValue(await(await fetch(base + '/internal/graphql', {method:'POST', headers, body:JSON.stringify({query:'query($representations:[_Any!]!){_entities(representations:$representations){... on Player{playerId bets(limit:1){bets{betId}}}}}', variables:{representations:[{__typename:'Player', operatorId:id, playerId:id}]}})})).json());

assert.equal(entities.errors, undefined, JSON.stringify(entities));
    assert.equal((await fetch(base + '/internal/v1/bets', {method:'POST', headers, body:JSON.stringify({...body, operator_id:id})})).status, 400);assert.equal(calls, 3);
  } finally {client.close();await host.close();}
});
