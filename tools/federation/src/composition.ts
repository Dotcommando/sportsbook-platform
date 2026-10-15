import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {composeServices} from '@apollo/composition';
import {parse} from 'graphql';
import ts from 'typescript';

export interface ISubgraph {name:string;source:string;symbol:string;file:string;url:string;}

export interface IFederationRegistry {compositionVersion:string;compatibilityVersion:string;pluginArchiveSha256:string;routerImage:string;roverImage:string;subgraphs:ISubgraph[];}

export function readRegistry(root:string):IFederationRegistry {
  const raw:unknown = JSON.parse(readFileSync(path.join(root, 'infra/router/registry.json'), 'utf8'));

  if (!raw || typeof raw !== 'object') throw new Error('Invalid federation registry');

  const record = Object.fromEntries(Object.entries(raw));

  if (record.compositionVersion !== '2.14.0' || record.compatibilityVersion !== '2.14.4' || typeof record.pluginArchiveSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(record.pluginArchiveSha256) || typeof record.routerImage !== 'string' || typeof record.roverImage !== 'string' || ![record.routerImage, record.roverImage].every(v=>/@sha256:[0-9a-f]{64}$/.test(v)) || !Array.isArray(record.subgraphs) || record.subgraphs.length !== 4) throw new Error('Pinned federation versions and four owners required');

  const subgraphs:ISubgraph[] = record.subgraphs.map((item:unknown)=>{if (!item || typeof item !== 'object') throw new Error('Invalid subgraph');

const v = Object.fromEntries(Object.entries(item));

if (typeof v.name !== 'string' || !['ledger', 'player', 'events', 'betting'].includes(v.name) || typeof v.source !== 'string' || !v.source.startsWith('apps/') || v.source.includes('..') || typeof v.symbol !== 'string' || typeof v.file !== 'string' || !/^\w+\.graphql$/.test(v.file) || typeof v.url !== 'string') throw new Error('Invalid subgraph record');

const url = new URL(v.url);

if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/internal/graphql') throw new Error('Explicit private subgraph URL required');

return {name:v.name, source:v.source, symbol:v.symbol, file:v.file, url:v.url};});

  if (new Set(subgraphs.map(s=>s.name)).size !== 4) throw new Error('Duplicate subgraph owner');

  return {compositionVersion:record.compositionVersion, compatibilityVersion:record.compatibilityVersion, pluginArchiveSha256:record.pluginArchiveSha256, routerImage:record.routerImage, roverImage:record.roverImage, subgraphs};
}

export function sourceSdl(root:string, subgraph:ISubgraph):string {
  const file = path.join(root, subgraph.source);const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

  for (const statement of source.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.name.text === subgraph.symbol && declaration.initializer && ts.isStringLiteral(declaration.initializer)) return declaration.initializer.text.trim() + '\n';
  throw new Error('Subgraph SDL must be an exported static literal: ' + subgraph.name);
}

export function exportSubgraphs(root:string, check = false):void {
  const registry = readRegistry(root);const directory = path.join(root, 'infra/router/subgraphs');

  if (!check)mkdirSync(directory, {recursive:true});

  for (const subgraph of registry.subgraphs) {const sdl = sourceSdl(root, subgraph);

parse(sdl);const target = path.join(directory, subgraph.file);

if (check) {if (readFileSync(target, 'utf8') !== sdl) throw new Error('Stale exported SDL: ' + subgraph.name);} else writeFileSync(target, sdl);}
}

export function composeSubgraphs(root:string, urls:Readonly<Record<string, string>> = {}, overrides:Readonly<Record<string, string>> = {}):string {
  const registry = readRegistry(root);const result = composeServices(registry.subgraphs.map(s=>({name:s.name, url:urls[s.name] ?? s.url, typeDefs:parse(overrides[s.name] ?? readFileSync(path.join(root, 'infra/router/subgraphs', s.file), 'utf8'))})));

  if (result.errors?.length || !result.supergraphSdl) throw new Error('Federation composition failed: ' + result.errors?.map(e=>e.message).join('; '));

  return result.supergraphSdl + '\n';
}

export async function prepareRoverPlugin(root:string, registry:IFederationRegistry):Promise<string> {
  const directory = path.join(root, '.tmp/federation-plugin');

mkdirSync(directory, {recursive:true});const archive = path.join(directory, 'supergraph-' + registry.compositionVersion + '.tar.gz');

  if (!existsSync(archive)) {const response = await fetch('https://rover.apollo.dev/tar/supergraph/x86_64-unknown-linux-gnu/v' + registry.compositionVersion, {signal:AbortSignal.timeout(30000)});

if (!response.ok) throw new Error('Pinned Rover plugin unavailable: ' + response.status);

const body = Buffer.from(await response.arrayBuffer());

if (body.length > 64 * 1048576 || createHash('sha256').update(body).digest('hex') !== registry.pluginArchiveSha256) throw new Error('Rover plugin checksum mismatch');writeFileSync(archive, body);}
  if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== registry.pluginArchiveSha256) throw new Error('Cached Rover plugin checksum mismatch');

  const unpacked = spawnSync('tar', ['-xzf', archive, '-C', directory], {encoding:'utf8', timeout:10000});

if (unpacked.status !== 0) throw new Error(unpacked.stderr || 'Cannot unpack pinned Rover plugin');

const bin = path.join(directory, 'bin');

mkdirSync(bin, {recursive:true});writeFileSync(path.join(bin, 'supergraph-v' + registry.compositionVersion), readFileSync(path.join(directory, 'dist/supergraph')), {mode:0o755});

return bin;
}

export async function composeWithRover(root:string, check = false):Promise<void> {
  exportSubgraphs(root, check);const registry = readRegistry(root);const config = 'federation_version: "=' + registry.compositionVersion + '"\nsubgraphs:\n' + registry.subgraphs.map(s=>'  ' + s.name + ':\n    routing_url: ' + s.url + '\n    schema:\n      file: subgraphs/' + s.file + '\n').join('');const directory = path.join(root, 'infra/router');

  if (!check)writeFileSync(path.join(directory, 'supergraph.yaml'), config);else if (readFileSync(path.join(directory, 'supergraph.yaml'), 'utf8') !== config) throw new Error('Stale supergraph configuration');

  const plugin = await prepareRoverPlugin(root, registry);const container = 'sportsbook-federation-compose-' + process.pid;
  const result = spawnSync('docker', ['run', '--rm', '--name', container, '--platform', 'linux/amd64', '-e', 'APOLLO_ELV2_LICENSE=accept', '-e', 'APOLLO_ROVER_DOWNLOAD_ENABLED=false', '-v', plugin + ':/home/rover/.rover/bin:ro', '-v', directory + ':/work', '-w', '/work', registry.roverImage, 'supergraph', 'compose', '--config', 'supergraph.yaml'], {encoding:'utf8', timeout:30000, maxBuffer:4 * 1048576});

  if (result.error)spawnSync('docker', ['rm', '--force', container], {encoding:'utf8', timeout:10000});
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Rover composition failed');

  const sdl = result.stdout.trim() + '\n';

parse(sdl);const file = path.join(directory, 'supergraph.graphql');

  if (check) {if (readFileSync(file, 'utf8') !== sdl) throw new Error('Rover supergraph artifact drift');} else {writeFileSync(file, sdl);writeFileSync(path.join(directory, 'supergraph.manifest.json'), JSON.stringify({compositionVersion:registry.compositionVersion, roverImage:registry.roverImage, routerImage:registry.routerImage, sha256:createHash('sha256').update(sdl).digest('hex'), subgraphs:registry.subgraphs.map(s=>({name:s.name, sha256:createHash('sha256').update(sourceSdl(root, s)).digest('hex')}))}, null, 2) + '\n');}
}
