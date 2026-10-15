import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';

import type {IJetStreamTopology} from '@sportsbook/service-transport';
import {configureJetStream} from '@sportsbook/service-transport';
import {connect} from 'nats';

const root = new URL('../../../', import.meta.url);

const env = parseEnv(readFileSync(new URL('infra/nats/.env', root), 'utf8'));

const servers = env.NATS_SERVERS?.split(',');

if (!servers?.length || !servers.every(server=>['localhost', '127.0.0.1'].includes(new URL(server).hostname)) || !env.NATS_TOPOLOGY_USER || !env.NATS_TOPOLOGY_PASSWORD) throw new Error('Explicit local NATS topology credentials required');

const topology:IJetStreamTopology = JSON.parse(readFileSync(new URL('infra/nats/topology.json', root), 'utf8'));

const connection = await connect({servers, user:env.NATS_TOPOLOGY_USER, pass:env.NATS_TOPOLOGY_PASSWORD, timeout:5000});

try {await configureJetStream(await connection.jetstreamManager(), topology);console.log('Local JetStream streams and BETTING_RESULTS durable consumer configured: ' + fileURLToPath(new URL('infra/nats/topology.json', root)));} finally {await connection.drain();}
