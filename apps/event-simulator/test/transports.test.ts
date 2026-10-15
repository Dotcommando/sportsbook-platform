import 'reflect-metadata';

import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createServer} from 'node:net';
import path from 'node:path';
import test from 'node:test';

import {credentials, Metadata} from '@grpc/grpc-js';
import * as Wire from '@sportsbook/events-client';
import {objectValue} from '@sportsbook/service-transport';

import {protobufOutput} from '../src/adapters/inbound/grpc/events-wire.js';
import * as M from '../src/domain/events.model.js';
import {startEventsTransports} from '../src/infra/events-transport.module.js';
import type {IEventsOperationPorts} from '../src/ports/inbound/events-application.port.js';

test('Events REST, gRPC and Federation preserve exact quotes, versions and trusted identities', async()=>{
  const id = '00000000-0000-4000-8000-000000000001';const now = new Date().toISOString();const version = 9007199254740993n;let calls = 0;
  const event:M.IEvent = {eventId:id, runId:id, sport:M.Sport.FOOTBALL, homeTeam:'Home', awayTeam:'Away', startsAt:now, phase:M.EventPhase.LIVE, phaseSeq:version, simulatedAt:now};
  const quote:M.IQuote = {eventId:id, marketId:id, selectionId:id, quoteId:id, quoteVersion:version, selection:M.Selection.HOME, odds:'2.12345678', state:M.MarketState.OPEN, validUntil:now};
  const result:M.IEventResult = {resultId:id, eventId:id, runId:id, resultSeq:1n, homeGoals:1, awayGoals:0, outcome:M.ResultOutcome.HOME, occurredAt:now};
  const operations:IEventsOperationPorts = {listEvents:{execute:async()=>({ok:true, value:{events:[event], observedAt:now}})},
getEvent:{execute:async()=>{calls++;

return {ok:true, value:{event}};}},
getMarkets:{execute:async()=>({ok:true, value:{markets:[{marketId:id, eventId:id, type:M.MarketType.MATCH_RESULT, state:M.MarketState.OPEN, selections:[quote]}], observedAt:now}})},
getEventResult:{execute:async()=>({ok:true, value:{ready:true, result}})},
validateSelectionQuote:{execute:async()=>({ok:true, value:{acceptedQuote:quote, evaluatedAt:now}})},
advanceMatchPhase:{execute:async()=>({ok:true, value:{event}})},
completeEvent:{execute:async()=>({ok:true, value:{event, result, delivery:M.DeliveryState.PENDING}})},
publishOutboxBatch:{execute:async()=>({ok:true, value:{report:{selected:0, applied:0, replayed:0, rejected:0, pending:0, failed:0}}})}};
  const probe = createServer();

await new Promise<void>(resolve=>probe.listen(0, '127.0.0.1', resolve));const address = probe.address();

assert.ok(address && typeof address === 'object');const grpcPort = address.port;

await new Promise<void>(resolve=>probe.close(()=>resolve()));
  const identity = {issuer:'synthetic', audience:'events', key:'test-key-at-least-thirty-two-bytes', maximumDeadlineMs:60000};const context:M.ICallContext = {operatorId:id, actorId:id, actorKind:M.ActorKind.SYSTEM, capabilities:Object.values(M.Capability), correlationId:id, deadlineAt:new Date(Date.now() + 60000).toISOString()};
  const header = Buffer.from(JSON.stringify({alg:'HS256', typ:'JWT'})).toString('base64url');const payload = Buffer.from(JSON.stringify({iss:identity.issuer, aud:identity.audience, iat:Math.floor(Date.now() / 1000), exp:Math.floor(Date.now() / 1000) + 120, ...context})).toString('base64url');const authorization = 'Bearer ' + header + '.' + payload + '.' + createHmac('sha256', identity.key).update(header + '.' + payload).digest('base64url');const headers = {authorization, 'x-correlation-id':id, 'x-deadline-at':context.deadlineAt, 'content-type':'application/json'};
  const host = await startEventsTransports(operations, identity, {maximumBytes:65536, maximumDepth:8, maximumRootFields:20, maximumSelectedFields:1000, maximumResponseBytes:1048576, introspection:false}, {host:'127.0.0.1', httpPort:0, grpcPort, protoPath:path.resolve(import.meta.dirname, '../../../packages/contracts/proto/sportsbook/events/v1/events.proto'), protobufPackage:'sportsbook.events.v1'});const base = await host.http.getUrl();const client = new Wire.EventsServiceClient('127.0.0.1:' + grpcPort, credentials.createInsecure());

  try {
    const response = await fetch(base + '/internal/v1/events/' + id, {headers});

assert.equal(response.status, 200);assert.equal(objectValue(objectValue(await response.json()).event).phase_seq, version.toString());

    for (const url of ['/internal/v1/events?limit=1', '/internal/v1/events/' + id + '/markets', '/internal/v1/events/' + id + '/result'])assert.equal((await fetch(base + url, {headers})).status, 200);
    const body = {player_id:id, event_id:id, market_id:id, selection_id:id, quote_id:id, quote_version:version.toString()};const validation = await fetch(base + '/internal/v1/quote-validations', {method:'POST', headers, body:JSON.stringify(body)});

assert.equal(validation.status, 200);assert.equal(objectValue(objectValue(await validation.json()).accepted_quote).odds, quote.odds);
    assert.equal((await fetch(base + '/internal/v1/events/' + id + '/phase-advances', {method:'POST', headers, body:JSON.stringify({request_id:id, expected_phase_seq:version.toString(), next_phase:'LIVE', simulated_at:now})})).status, 200);
    assert.equal((await fetch(base + '/internal/v1/events/' + id + '/completions', {method:'POST', headers, body:JSON.stringify({request_id:id, expected_phase_seq:version.toString(), result:{...result, resultSeq:'1'}})})).status, 200);
    const metadata = new Metadata();

metadata.set('authorization', authorization);
    const rpc = await new Promise<unknown>((resolve, reject)=>client.getEvent(Wire.GetEventRequest.fromJSON(protobufOutput({context, eventId:id}, 'GetEventRequest')), metadata, (error, value)=>error ? reject(error) : resolve(Wire.GetEventResponse.toJSON(value))));

assert.equal(objectValue(objectValue(objectValue(rpc).value).event).phaseSeq, version.toString());
    const gql = objectValue(await(await fetch(base + '/internal/graphql', {method:'POST', headers, body:JSON.stringify({query:'query($input:EventsEventsGetEventInputInput!){getEvent(input:$input){event{operatorId eventId phaseSeq}}}', variables:{input:{eventId:id}}})})).json());

assert.equal(gql.errors, undefined, JSON.stringify(gql));assert.equal(objectValue(objectValue(objectValue(gql.data).getEvent).event).phaseSeq, version.toString());
    const entities = objectValue(await(await fetch(base + '/internal/graphql', {method:'POST', headers, body:JSON.stringify({query:'query($representations:[_Any!]!){_entities(representations:$representations){... on Event{eventId phaseSeq}}}', variables:{representations:[{__typename:'Event', operatorId:id, eventId:id}]}})})).json());

assert.equal(entities.errors, undefined, JSON.stringify(entities));
    const count = calls;

assert.equal((await fetch(base + '/internal/v1/events/' + id + '?operator_id=' + id, {headers})).status, 400);assert.equal(calls, count);assert.equal((await fetch(base + '/internal/v1/events/' + id)).status, 401);
  } finally {client.close();await host.close();}
});
