import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import type {ObjectTypeDefinitionNode} from 'graphql';
import {Kind, parse, parseType, print, visit} from 'graphql';

import {composeSubgraphs, exportSubgraphs, readRegistry} from '../src/composition.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

test('actual exported owner SDLs match source and all four subgraphs compose with pinned artifact integrity', ()=>{
  exportSubgraphs(root, true);const registry = readRegistry(root);

assert.equal(registry.subgraphs.length, 4);assert.match(composeSubgraphs(root), /@join__graph/);
  const manifest:unknown = JSON.parse(readFileSync(path.join(root, 'infra/router/supergraph.manifest.json'), 'utf8'));

assert.ok(manifest && typeof manifest === 'object' && 'sha256' in manifest);assert.equal(manifest.sha256, createHash('sha256').update(readFileSync(path.join(root, 'infra/router/supergraph.graphql'))).digest('hex'));
});

test('incompatible entity field types fail Federation composition independently of Buf', ()=>{
  const player = readFileSync(path.join(root, 'infra/router/subgraphs/player.graphql'), 'utf8');

assert.ok(player.includes('playerId: String!'));
  const incompatible = print(visit(parse(player), {ObjectTypeDefinition(node):ObjectTypeDefinitionNode | undefined {if (node.name.value !== 'Player') return;

return {...node, fields:(node.fields ?? []).map(field=>field.name.value === 'playerId' ? {...field, type:parseType('Int!')} : field)};}}));

  assert.throws(()=>composeSubgraphs(root, {}, {player:incompatible}), /Federation composition failed/);
});

test('minimal Player entity never acquires private profile or KYC fields', ()=>{
  const sdl = readFileSync(path.join(root, 'infra/router/subgraphs/player.graphql'), 'utf8');const document = parse(sdl);const entity = document.definitions.find(d=>d.kind === Kind.OBJECT_TYPE_DEFINITION && d.name.value === 'Player');

assert.ok(entity?.kind === Kind.OBJECT_TYPE_DEFINITION);

  for (const field of entity.fields ?? [])assert.ok(['operatorId', 'playerId', 'exists'].includes(field.name.value), 'Private Player field: ' + field.name.value);
  assert.match(sdl, /type PlayerProfile /);
});

test('Ledger financial cancellation and Betting cancellation have separate root fields', ()=>{
 const ledger = readFileSync(path.join(root, 'infra/router/subgraphs/ledger.graphql'), 'utf8');

assert.match(ledger, /cancelStakeReservation\(input:/);
 assert.throws(()=>composeSubgraphs(root, {}, {ledger:ledger.replace('cancelStakeReservation(input:', 'cancelBet(input:')}), /Federation composition failed/);
});
