import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { FederationBoundary } from '../src/graphql.js';
import { instantValue, SignedIdentity, uuidValue } from '../src/identity.js';
import { decodeShape, ShapeKind, strictJson } from '../src/wire.js';

const now = Date.parse('2026-10-14T12:00:00Z');

const settings = {issuer:'test', audience:'private-service', key:'test-key-at-least-thirty-two-bytes', maximumDeadlineMs:10000};

const id = '00000000-0000-4000-8000-000000000001';

function token(patch:Record<string, unknown> = {}, algorithm = 'HS256'):string {
  const header = Buffer.from(JSON.stringify({alg:algorithm, typ:'JWT'})).toString('base64url');
  const claims = Buffer.from(JSON.stringify({iss:settings.issuer, aud:settings.audience, iat:now / 1000, exp:now / 1000 + 60, operatorId:id, actorId:id, playerId:id, actorKind:'PLAYER', capabilities:['READ_WALLET'], ...patch})).toString('base64url');

  return 'Bearer ' + header + '.' + claims + '.' + createHmac('sha256', settings.key).update(header + '.' + claims).digest('base64url');
}

test('signed identity checks signature/issuer/audience/lifetime/delegation and clamps deadline', ()=> {
  const identity = new SignedIdentity(settings, ()=>now);
  const claims = identity.authenticate(token(), id, '2026-10-14T13:00:00Z');

  assert.equal(claims.deadlineAt, '2026-10-14T12:00:10.000Z');

  for (const invalid of [token({iss:'foreign'}), token({aud:'foreign'}), token({exp:now / 1000}), token({nbf:now / 1000 + 10}), token({playerId:'00000000-0000-4000-8000-000000000002'}), token({}, 'none'), token().slice(0, -5) + 'wrong'])assert.throws(()=>identity.authenticate(invalid, id, '2026-10-14T13:00:00Z'), /UNAUTHENTICATED/);
  assert.throws(()=>instantValue('2026-02-30T12:00:00Z'), /INVALID_INPUT/);
  assert.throws(()=>uuidValue('00000000-0000-0000-0000-000000000000'), /INVALID_INPUT/);
});

test('strict JSON and shapes reject duplicate fields, unsafe keys, numeric money, overflow and unknown fields', ()=> {
  for (const input of ['{"amount":"1","amount":"2"}', '{"__proto__":{}}', '{"a":1,}', '{"a":1/*comment*/}'])assert.throws(()=>strictJson(input));
  const schema = {kind:ShapeKind.OBJECT, fields:{amount:{kind:ShapeKind.BIGINT}}};

  assert.deepEqual(decodeShape({amount:'9007199254740993'}, schema), {amount:9007199254740993n});

  for (const value of [9007199254740992, '01', '1e3', '9223372036854775808'])assert.throws(()=>decodeShape({amount:value}, schema));
  assert.throws(()=>decodeShape({amount:'1', extra:true}, schema));
});

test('GraphQL structural limits reject fragment, root-alias and depth abuse independently of pagination', async()=> {
  let calls = 0;
  const boundary = new FederationBoundary('type Item { value:String! nested:Item } input Page {limit:Int!} type Query {items(page:Page!):[Item!]!}', {Query:{items:()=>{calls++;

return [{value:'ok'}];}}}, {maximumBytes:65536, maximumDepth:8, maximumRootFields:20, maximumSelectedFields:1000, maximumResponseBytes:1048576, introspection:false});
  const result = await boundary.execute({query:'query($page:Page!){items(page:$page){value}}', variables:{page:{limit:1}}}, {});

  assert.ok(result);assert.equal(calls, 1);
  await boundary.execute({query:'{' + Array.from({length:21}, (_, index)=>'a' + index + ':items(page:{limit:1}){value}').join(' ') + '}'}, {});assert.equal(calls, 1);
  await boundary.execute({query:'query{items(page:{limit:1}){...A}} fragment A on Item{...A}'}, {});assert.equal(calls, 1);
  await boundary.execute({query:'{items(page:{limit:1}){nested{nested{nested{nested{nested{nested{nested{nested{value}}}}}}}}}}'}, {});assert.equal(calls, 1);
});

test('GraphQL accepts page 200 with nested entries and counts expanded selected fields without cardinality weights', async()=>{
  let calls = 0;const boundary = new FederationBoundary('type Entry {value:String!} type Journal {entries:[Entry!]!} input Page {limit:Int!} type Query {transactions(page:Page!):[Journal!]!}', {Query:{transactions:()=>{calls++;

return Array.from({length:200}, ()=>({entries:[{value:'debit'}, {value:'credit'}]}));}}}, {maximumBytes:65536, maximumResponseBytes:1048576, maximumDepth:8, maximumRootFields:20, maximumSelectedFields:1000, introspection:false});
  const response = await boundary.execute({query:'query($page:Page!){transactions(page:$page){entries{value}}}', variables:{page:{limit:200}}}, {});

  assert.equal(JSON.stringify(response).includes('errors'), false);assert.equal(calls, 1);
  await boundary.execute({query:'{transactions(page:{limit:201}){entries{value}}}'}, {});assert.equal(calls, 1);
  const aliases = Array.from({length:1000}, (_, i)=>'f' + i + ':value').join(' ');

  await boundary.execute({query:'{transactions(page:{limit:1}){entries{' + aliases + '}}}'}, {});assert.equal(calls, 1);
  await boundary.execute({query:'{transactions(page:{limit:1}){entries{...F ...F}}} fragment F on Entry{' + Array.from({length:500}, (_, i)=>'a' + i + ':value').join(' ') + '}'}, {});assert.equal(calls, 1);
});

test('GraphQL separately bounds the envelope and response and preserves unknown mutation outcome after execution', async()=>{
  let writes = 0;const boundary = new FederationBoundary('type Query {large:String!} type Mutation {large:String!}', {Query:{large:()=>'x'.repeat(1048576)},
Mutation:{large:()=>{writes++;

return 'x'.repeat(1048576);}}}, {maximumBytes:65536, maximumResponseBytes:1048576, maximumDepth:8, maximumRootFields:20, maximumSelectedFields:1000, introspection:false});
  const read = await boundary.execute({query:'{large}'}, {});

assert.match(JSON.stringify(read), /OVERLOADED/);assert.match(JSON.stringify(read), /"outcomeUnknown":false/);
  const write = await boundary.execute({query:'mutation{large}'}, {});

assert.equal(writes, 1);assert.match(JSON.stringify(write), /"outcomeUnknown":true/);
  const oversized = await boundary.execute({query:'{large}', variables:{padding:'x'.repeat(65536)}}, {});

assert.match(JSON.stringify(oversized), /INVALID_INPUT/);
});
