import assert from 'node:assert/strict';
import {test} from 'node:test';

import {graphqlServiceFailure, protobufJsonDefaults, ServiceIdentity} from '../src/service-client.js';
import type {IShape} from '../src/wire.js';
import {decodeGraphqlShape, decodeShape, ShapeKind} from '../src/wire.js';

test('GraphQL null is omitted only for optional contract fields; REST null and missing required fields still fail', ()=>{
  const shape:IShape = {kind:ShapeKind.OBJECT, fields:{name:{kind:ShapeKind.STRING, optional:true}, version:{kind:ShapeKind.BIGINT}}};

  assert.deepEqual(decodeGraphqlShape({name:null, version:'9007199254740993'}, shape), {version:9007199254740993n});
  assert.throws(()=>decodeShape({name:null, version:'1'}, shape));assert.throws(()=>decodeGraphqlShape({version:null}, shape));assert.throws(()=>decodeGraphqlShape({version:'1', extra:null}, shape));
});

test('protobuf JSON preserves decoded repeated/scalar defaults and message presence without changing REST semantics', ()=>{
  const native = {value:{contacts:[], reservedMinor:0n, created:false, version:1n, status:1, profile:undefined}};
  const encoded = {value:{version:'1', status:'PLAYER_STATUS_ACTIVE'}};

  assert.deepEqual(protobufJsonDefaults(native, encoded), {value:{contacts:[], reservedMinor:0n, created:false, version:'1', status:'PLAYER_STATUS_ACTIVE'}});
  assert.deepEqual(protobufJsonDefaults({result:{$case:'value', value:{contacts:[]}}}, {value:{}}), {value:{contacts:[]}});
});

test('service delegation retains scope and bounds time without giving a new identity to foreign operators', ()=>{
  const id = '00000000-0000-4000-8000-000000000001';const now = Date.parse('2026-10-15T12:00:00Z');
  const identity = new ServiceIdentity({issuer:'test', audience:'private', key:'s'.repeat(32), actorId:id, operators:[id], capabilities:['PROFILE_READ'], timeoutMs:100}, ()=>now);
  const context = {operatorId:id, actorId:id, actorKind:'PLAYER', playerId:id, capabilities:['PROFILE_READ'], correlationId:id, deadlineAt:'2026-10-15T12:01:00Z'};

  assert.equal(identity.remaining(context), 100);assert.equal(identity.delegate(context).playerId, id);assert.equal(identity.delegate(context).actorKind, 'SERVICE');assert.throws(()=>identity.delegate({...context, operatorId:'00000000-0000-4000-8000-000000000002'}));assert.throws(()=>identity.remaining({...context, deadlineAt:'2026-10-15T12:00:00Z'}));
});

test('Router subrequest failure preserves dependency semantics and unknown mutation outcomes', ()=>{
 assert.deepEqual(graphqlServiceFailure({code:'SUBREQUEST_HTTP_ERROR', service:'events'}, false).failure, {code:'DEPENDENCY_UNAVAILABLE', retryable:true, outcomeUnknown:false});
 assert.equal(graphqlServiceFailure({code:'SUBREQUEST_HTTP_ERROR'}, true).failure.outcomeUnknown, true);
 assert.deepEqual(graphqlServiceFailure({code:'NOT_FOUND', retryable:false, outcomeUnknown:false}, false).failure, {code:'NOT_FOUND', retryable:false, outcomeUnknown:false});
 assert.equal(graphqlServiceFailure({code:'UNRECOGNIZED_ROUTER_CODE'}, false).failure.code, 'ADAPTER_CONTRACT_VIOLATION');
});
