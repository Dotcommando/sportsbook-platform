import type {IncomingMessage, ServerResponse} from 'node:http';
import {isIP} from 'node:net';

import type {DynamicModule, INestApplication} from '@nestjs/common';
import {Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import type {IIdentitySettings} from '@sportsbook/service-transport';
import {installHttpResponseLimits, objectValue, REST_LIMITS, SignedIdentity, strictJson} from '@sportsbook/service-transport';

import {BetsModule} from '../modules/bets/infra/bets.module.js';
import {DashboardModule} from '../modules/dashboard/infra/dashboard.module.js';
import {EventsModule} from '../modules/events/infra/events.module.js';
import {PlayersModule} from '../modules/players/infra/players.module.js';
import {WalletModule} from '../modules/wallet/infra/wallet.module.js';
import type {IGatewayOperationPorts} from '../ports/inbound/gateway-application.port.js';

@Module({})
export class GatewayTransportModule {static bind(operations:IGatewayOperationPorts, settings:IIdentitySettings):DynamicModule {const identity = new SignedIdentity(settings);

return {module:GatewayTransportModule, imports:[PlayersModule.bind(operations, identity), WalletModule.bind(operations, identity), BetsModule.bind(operations, identity), EventsModule.bind(operations, identity), DashboardModule.bind(operations, identity)]};}}

export async function startGatewayRest(operations:IGatewayOperationPorts, identity:IIdentitySettings, host:string, port:number):Promise<INestApplication> {if (!isIP(host) || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Explicit REST listener required');

const http = await NestFactory.create(GatewayTransportModule.bind(operations, identity), {logger:false, bodyParser:false});

installHttpResponseLimits(http);http.use((request:IncomingMessage & {body?:unknown}, response:ServerResponse, next:()=>void):void=>{if (!['POST', 'PATCH', 'PUT'].includes(request.method ?? '')) {if (Number(request.headers['content-length'] ?? 0) > 0 || request.headers['transfer-encoding']) {response.writeHead(400, {'Content-Type':'application/json'});response.end('{"code":"INVALID_INPUT"}');

return;}next();

return;}

 const reject = ():void=>{if (!response.writableEnded) {response.writeHead(400, {'Content-Type':'application/json'});response.end('{"code":"INVALID_INPUT"}');}};

if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type'] ?? ''))) {reject();

return;}

 const chunks:Buffer[] = [];let length = 0;let rejected = false;

request.on('data', (chunk:Buffer)=>{length += chunk.length;

if (length > REST_LIMITS.requestBytes) {rejected = true;chunks.length = 0;} else if (!rejected)chunks.push(chunk);});request.on('end', ()=>{try {if (rejected) throw new Error('Oversize body');request.body = objectValue(strictJson(new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(chunks))));next();} catch {reject();}});request.on('error', ()=>{if (!response.writableEnded)response.end();});});

try {await http.listen(port, host);

return http;} catch(error) {await http.close();throw error;}}
