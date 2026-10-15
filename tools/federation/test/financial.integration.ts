import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

import type {ISchemaManifest} from '@sportsbook/persistence';
import {applyMigrations, assertSchema, PersistenceBackend, readMigrations} from '@sportsbook/persistence';
import type {IPrivateHostSettings} from '@sportsbook/service-transport';
import {jsonWire, objectValue, ServiceProtocol} from '@sportsbook/service-transport';
import {Pool} from 'pg';

import {contractEnvironment, contractGateway, publicHeaders} from '../../../apps/api-gateway/test/transports.fixture.js';
import {decodeInput} from '../../../apps/betting/src/adapters/outbound/clients/betting-client.dto.js';
import {LedgerGrpcClient} from '../../../apps/betting/src/adapters/outbound/clients/ledger-grpc.client.js';
import * as B from '../../../apps/betting/src/domain/betting.model.js';
import * as Output from '../../../apps/betting/src/domain/betting-output.policy.js';
import type {IBettingApplicationSettings, IBettingClients} from '../../../apps/betting/src/infra/betting-application.factory.js';
import {createBettingApplication} from '../../../apps/betting/src/infra/betting-application.factory.js';
import {startBettingTransports} from '../../../apps/betting/src/infra/betting-transport.module.js';
import {LedgerConcurrencyStrategy} from '../../../apps/ledger/src/adapters/outbound/persistence/sql-session.js';
import * as L from '../../../apps/ledger/src/domain/ledger.model.js';
import {createLedgerApplication} from '../../../apps/ledger/src/infra/ledger-application.factory.js';
import {startLedgerTransports} from '../../../apps/ledger/src/infra/ledger-transport.module.js';
import {docker, dockerUrl, pause, privateBindHost, root, startRouter} from './router.fixture.js';

assert.ok(privateBindHost);

const container = 'sportsbook-gateway-financial-' + process.pid;

const image = 'postgres:17.9@sha256:2a0d0fe14825b0939f78a8cad5cd4e6aa68bf94d0e5dd96e24b6d23af4315545';

const pg = docker(['run', '--rm', '--detach', '--name', container, '-e', 'POSTGRES_USER=migration_owner', '-e', 'POSTGRES_PASSWORD=password', '-p', '127.0.0.1::5432', image]);

let admin:Pool | undefined;

const owners:Pool[] = [];

let env:Awaited<ReturnType<typeof contractEnvironment>> | undefined;

let ledger:Awaited<ReturnType<typeof createLedgerApplication>> | undefined;

let betting:Awaited<ReturnType<typeof createBettingApplication>> | undefined;

let ledgerClient:LedgerGrpcClient | undefined;

let router:Awaited<ReturnType<typeof startRouter>> | undefined;

const gateways:Awaited<ReturnType<typeof contractGateway>>[] = [];

try {
 for (let attempt = 0;attempt < 100;attempt++) {try {docker(['exec', pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'migration_owner']);break;} catch {if (attempt === 99) throw new Error('Isolated PostgreSQL startup timed out');await pause(100);}}
 const address = docker(['port', pg, '5432/tcp']);

assert.match(address, /^127\.0\.0\.1:\d+$/);admin = new Pool({connectionString:'postgresql://migration_owner:password@' + address + '/postgres'});await admin.query("CREATE ROLE runtime_user LOGIN PASSWORD 'password'");const urls:Record<string, string> = {};

 for (const service of ['ledger', 'betting']) {const database = service + '_gateway';

await admin.query('CREATE DATABASE ' + database);const owner = new Pool({connectionString:'postgresql://migration_owner:password@' + address + '/' + database});

owners.push(owner);await applyMigrations(owner, readMigrations(path.join(root, 'apps', service, 'migrations')));const manifest:ISchemaManifest = JSON.parse(readFileSync(path.join(root, 'apps', service, 'migrations/schema.json'), 'utf8'));

await assertSchema(owner, manifest);assert.equal((await owner.query("SELECT conname FROM pg_constraint WHERE contype='f'")).rowCount, 0);await owner.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');await owner.query('GRANT USAGE ON SCHEMA public TO runtime_user');await owner.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO runtime_user');

if (service === 'ledger') {await owner.query('REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON ledger_transactions,ledger_entries FROM runtime_user');await owner.query('GRANT EXECUTE ON FUNCTION public.ledger_append_posting(jsonb,jsonb) TO runtime_user');}urls[service] = 'postgresql://runtime_user:password@' + address + '/' + database;}
 env = await contractEnvironment(privateBindHost);const f = env.fixture;

f.clock.now = ()=>new Date().toISOString();const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';const bettingActor = f.id();const systemActor = f.id();const system:L.ICallContext = {operatorId:f.context.operatorId, actorId:systemActor, actorKind:L.ActorKind.SYSTEM, capabilities:Object.values(L.Capability), correlationId:f.context.correlationId, deadlineAt:f.context.deadlineAt};
 const ledgerCaps = [L.Capability.READ_WALLET, L.Capability.RESERVE_STAKE, L.Capability.CANCEL_RESERVATION, L.Capability.SETTLE_BET];
 const policies:L.IOperatorFinancialPolicy[] = [{operatorId:f.context.operatorId, currencies:[{currency:'USD', minimumMinor:1n, maximumMinor:9223372036854775807n}], providerNames:['synthetic'], rejectionReasons:['PAYMENT_REJECTED'], trustedActors:[{actorId:systemActor, actorKind:L.ActorKind.SYSTEM, capabilities:Object.values(L.Capability), providerName:'synthetic'}, {actorId:env.serviceActor, actorKind:L.ActorKind.SERVICE, capabilities:[L.Capability.READ_WALLET, L.Capability.READ_JOURNAL, L.Capability.FUND_SYNTHETIC, L.Capability.WITHDRAW], providerName:'synthetic'}, {actorId:bettingActor, actorKind:L.ActorKind.SERVICE, capabilities:ledgerCaps}]}];

 ledger = await createLedgerApplication({backend:PersistenceBackend.Pg, strategy:LedgerConcurrencyStrategy.CONDITIONAL, connectionString:urls.ledger ?? '', poolMax:4, replicaCount:1, aggregateConnectionBudget:4, acquisitionTimeoutMs:5000, transactionTimeoutMs:10000, retry:{serializationAttempts:5, deadlockAttempts:5, versionAttempts:10, retryBaseMs:1, retryMaxMs:16, statementTimeoutMs:5000, lockTimeoutMs:1000}, outboxLeaseMs:1000, jitter:()=>0.5}, namespace, policies, f.clock, {publish:async(_context, event)=>({messageId:event.messageId, acceptedAt:f.now, durable:true})}, 10);
 const created = await ledger.operations.createWallet.execute({context:system, requestId:f.id(), playerId:f.context.playerId ?? '', currency:'USD'});

assert.ok(created.ok, JSON.stringify(jsonWire(created)));const walletId = created.value.wallet.walletId;

assert.ok((await ledger.operations.depositTestFunds.execute({context:system, requestId:f.id(), walletId, amount:{amountMinor:30000000000000000n, currency:'USD'}, providerRef:'synthetic:gateway-e2e'})).ok);
 const graphql = {maximumBytes:65536, maximumDepth:8, maximumRootFields:20, maximumSelectedFields:1000, maximumResponseBytes:1048576, introspection:false};

 function host(owner:string):IPrivateHostSettings {assert.ok(env);

return {host:privateBindHost ?? '', httpPort:0, grpcPort:env.grpcPorts[owner] ?? 0, protoPath:path.join(root, 'packages/contracts/proto/sportsbook', owner, 'v1', owner + '.proto'), protobufPackage:'sportsbook.' + owner + '.v1'};}
 await env.hosts.ledger?.close();delete env.hosts.ledger;let loseReserveReply = false;const actualLedger = ledger;

 env.hosts.ledger = await startLedgerTransports({...ledger.operations,
reserveStake:{execute:async input=>{assert.equal(input.context.actorId, bettingActor, 'Only Betting initiates the financial reserve');const result = await actualLedger.operations.reserveStake.execute(input);

if (result.ok && loseReserveReply) {loseReserveReply = false;

return {ok:false, error:{code:L.ErrorCode.DEPENDENCY_UNAVAILABLE, message:'DEPENDENCY_UNAVAILABLE', correlationId:input.context.correlationId, retryable:true, outcomeUnknown:true}};}

 return result;}}}, env.privateIdentity, graphql, host('ledger'));
 ledgerClient = new LedgerGrpcClient({...env.privateIdentity, endpoint:privateBindHost + ':' + env.grpcPorts.ledger, tls:false, actorId:bettingActor, operators:[f.context.operatorId], capabilities:ledgerCaps, timeoutMs:5000}, f.clock);
 const checked = decodeInput('IPlayerCheckEligibilityOutput', jsonWire({eligibility:f.eligibility}), false);

assert.ok(Output.isIPlayerCheckEligibilityOutput(checked));const selected = decodeInput('IEventsValidateSelectionQuoteOutput', jsonWire({acceptedQuote:f.bet.legs[0]?.quote, evaluatedAt:f.now}), false);

assert.ok(Output.isIEventsValidateSelectionQuoteOutput(selected));const event = decodeInput('IEventsGetEventOutput', jsonWire({event:f.event}), false);

assert.ok(Output.isIEventsGetEventOutput(event));
 const clients:IBettingClients = {eligibility:{check:async()=>checked}, quotes:{validateSelection:async()=>selected, getEvent:async()=>event}, reservations:ledgerClient, settlements:ledgerClient};
 const config:IBettingApplicationSettings = {namespace, persistence:{backend:PersistenceBackend.TypeOrm, connectionString:urls.betting ?? '', poolMax:4, replicaCount:1, connectionBudget:4, acquisitionTimeoutMs:5000, transactionTimeoutMs:10000, statementTimeoutMs:5000, lockTimeoutMs:1000, retryAttempts:10, outboxLeaseMs:1000}, operators:[{operatorId:f.context.operatorId, currencies:['USD'], marketPeriod:B.MarketPeriod.NORMAL_TIME, trustedActors:[{actorId:env.serviceActor, actorKind:B.ActorKind.SERVICE, capabilities:[B.Capability.PLACE_BET, B.Capability.CANCEL_BET, B.Capability.BET_READ]}, {actorId:systemActor, actorKind:B.ActorKind.SYSTEM, capabilities:Object.values(B.Capability)}]}], outboxRetryMs:10};
 const publication = {publish:async(_context:B.ICallContext, event:B.IEventEnvelope)=>({messageId:event.messageId, acceptedAt:f.now, durable:true})};

betting = await createBettingApplication(config, f.clock, clients, publication);await env.hosts.betting?.close();delete env.hosts.betting;env.hosts.betting = await startBettingTransports(betting.operations, env.privateIdentity, graphql, host('betting'));
 const routerUrls:Record<string, string> = {};

for (const [owner, server] of Object.entries(env.hosts))routerUrls[owner] = dockerUrl(await server.http.getUrl() + '/internal/graphql');router = await startRouter(routerUrls, 'financial');
 const headers = publicHeaders(env);const place = jsonWire({requestId:f.place.requestId, type:f.place.type, stake:f.place.stake, selection:f.place.selection}, true);let betId = '';let version = '';

 for (const protocol of Object.values(ServiceProtocol)) {const gateway = await contractGateway(env, protocol, router.endpoint);

gateways.push(gateway);const response = await fetch(gateway.base + '/v1/bets', {method:'POST', headers, body:JSON.stringify(place)});const result = objectValue(await response.json());

assert.equal(response.status, 201, protocol + ' ' + JSON.stringify(result));assert.equal(result.outcome, 'ACCEPTED');const bet = objectValue(result.bet);

if (betId)assert.equal(bet.bet_id, betId);betId = String(bet.bet_id);version = String(bet.version);const balance = objectValue(await(await fetch(gateway.base + '/v1/wallet?currency=USD', {headers})).json());

assert.equal(objectValue(balance.wallet).reserved_minor, '9007199254740993');}
 const ledgerOwner = owners[0], bettingOwner = owners[1];

assert.ok(ledgerOwner && bettingOwner);assert.equal((await bettingOwner.query('SELECT bet_id FROM bets')).rowCount, 1);const reserve = await ledgerOwner.query<{request_id:string}>("SELECT request_id FROM ledger_transactions WHERE transaction_type='RESERVE_STAKE'");

assert.equal(reserve.rowCount, 1);
 const stored = await bettingOwner.query<{reserve_request_id:string}>("SELECT child->>'id' AS reserve_request_id FROM bet_commands CROSS JOIN LATERAL jsonb_array_elements(stable_child_ids) child WHERE request_id=$1 AND child->>'purpose'='betting:reserve'", [f.place.requestId]);

assert.equal(reserve.rows[0]?.request_id, stored.rows[0]?.reserve_request_id, 'Financial ID is the persisted Betting child ID');assert.notEqual(reserve.rows[0]?.request_id, f.place.requestId);
 const cancel = {request_id:f.id(), expected_version:version};

for (const gateway of gateways) {const response = await fetch(gateway.base + '/v1/bets/' + betId + '/cancel', {method:'POST', headers, body:JSON.stringify(cancel)});const result = objectValue(await response.json());

assert.equal(response.status, 200, JSON.stringify(result));assert.equal(result.outcome, 'CANCELED');}assert.equal((await ledgerOwner.query("SELECT ledger_transaction_id FROM ledger_transactions WHERE transaction_type='CANCEL_RESERVATION'")).rowCount, 1);
 const first = gateways[0];

assert.ok(first);loseReserveReply = true;const pendingHeaders = publicHeaders(env, {...f.context, deadlineAt:new Date(Date.now() + 2000).toISOString()});const pending = await fetch(first.base + '/v1/bets', {method:'POST', headers:pendingHeaders, body:JSON.stringify({...objectValue(place), request_id:f.id()})});const pendingResult = objectValue(await pending.json());

assert.equal(pending.status, 202, JSON.stringify(pendingResult));assert.equal(pendingResult.outcome, 'PENDING');assert.equal((await ledgerOwner.query("SELECT ledger_transaction_id FROM ledger_transactions WHERE transaction_type='RESERVE_STAKE'")).rowCount, 2);
 await env.hosts.betting?.close();delete env.hosts.betting;await betting.close();await pause(2100);betting = await createBettingApplication(config, f.clock, clients, publication);const recovery = await betting.operations.retryPendingReservation.execute({context:{...system, actorKind:B.ActorKind.SYSTEM, capabilities:Object.values(B.Capability)}, batchId:f.id(), page:{limit:200}, pendingBefore:f.clock.now()});

assert.ok(recovery.ok, JSON.stringify(jsonWire(recovery)));assert.equal((await bettingOwner.query("SELECT bet_id FROM bets WHERE status='PENDING_RESERVATION'")).rowCount, 0);assert.equal((await ledgerOwner.query("SELECT ledger_transaction_id FROM ledger_transactions WHERE transaction_type='RESERVE_STAKE'")).rowCount, 2);
 const audit = await ledger.operations.reconcileLedger.execute({context:system, requestId:f.id(), runId:f.id(), cutoff:f.clock.now(), page:{limit:200}});

assert.ok(audit.ok, JSON.stringify(jsonWire(audit)));assert.equal(audit.value.report.status, L.AuditState.PASS);
 console.log('Financial E2E: REST/gRPC/Router Gateway -> real Betting -> real Ledger; cross-transport replay, persisted child IDs, one cancellation, post-commit unknown outcome and restart recovery, bigint balance/journal reconciliation verified');
} finally {for (const gateway of gateways) await gateway.close();router?.close();await env?.close();ledgerClient?.close();await betting?.close();await ledger?.close();

for (const owner of owners) await owner.end();await admin?.end();docker(['rm', '--force', pg]);}
