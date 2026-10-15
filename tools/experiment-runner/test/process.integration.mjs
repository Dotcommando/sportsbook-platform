import './process.fixture.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { UuidGenerator } from '../../../apps/ledger/dist/adapters/outbound/ids/uuid-generator.js';
import { OwnedFailureControls, ReplyFault, startReplyFaultProxy } from '../dist/fault-controls.js';
import { sendAction, stableId } from '../dist/load.js';
import { reconcile } from '../dist/reconcile.js';
import { ExperimentRunner } from '../dist/runner.js';
import { startTelemetry } from '../dist/telemetry.js';

const require = createRequire(new URL('../package.json', import.meta.url));

const { Pool } = require('pg');

const root = process.cwd();

const read = name => JSON.parse(readFileSync('.tmp/process-control/' + name + '.json', 'utf8'));

const id = name => stableId('42', 0, name);

const ids = new UuidGenerator('6ba7b810-9dad-11d1-80b4-00c04fd430c8');

const operatorId = id('operator');

const playerId = ids.derive(operatorId, id('registration'), 'player:player');

const caseId = ids.derive(operatorId, id('kyc-open'), 'player:kyc-case');

const p = read('player');

p.application.persistence.connectionString = 'postgresql://never:secret@192.0.2.1:5432/never';

p.application.checks =
  ['IDENTITY', 'AGE', 'RESIDENCE'].map(
    checkType =>
      ({
        operatorId,
        check: {
          checkId: ids.derive(operatorId, caseId, 'player:kyc-check:' + checkType + ':1'),
          caseId,
          checkType,
          attemptNo: 1,
          provider: 'SYNTHETIC',
          providerCheckRef: 'synthetic:' + checkType,
          status: 'PASSED',
          resultCode: 'PASSED',
          completedAt: new Date().toISOString(),
        },
      }),
  );

writeFileSync('.tmp/process-control/player.json', JSON.stringify(p));

const runner = new ExperimentRunner(root);

const profile = runner.loadProfile('.tmp/process-control/profile.yaml');

let run;

let telemetry;

let db;

let proxy;

let barrierClient;

const checks = [];

const check = name => {
  checks.push(name);
  writeFileSync('.tmp/process-control-check-progress.json', JSON.stringify(checks));
};

let seq = 1000;

const pause = ms => new Promise(r => setTimeout(r, ms));

try {
  const manifest = await runner.prepare(profile, randomUUID());

  run = runner.preparedRun(manifest);
  assert.ok(run);
  writeFileSync(
    '.tmp/process-control-check-run.json',
    JSON.stringify({ runId: manifest.runId, directory: run.directory }),
  );
  const controls = new OwnedFailureControls(run);

  telemetry = await startTelemetry(run);
  assert.equal(
    new URL(run.settings.get('player-r0').application.persistence.connectionString).hostname,
    'player-db',
  );
  check('owned database URL overrides literal external template');
  const endpoint = async (service) => run.endpoint(service);
  const actor = service =>
    read('fixture').setup.find(s => s.service === service)?.action.actor
    ?? read('fixture').auditActor;

  async function call(service, path, body, method = 'POST', who = actor(service)) {
    const config = run.settings.get(service + '-r0');

    return sendAction(
      await endpoint(service),
      config.identity,
      { method, path, body, actor: who },
      '42',
      seq++,
    );
  }

  for (const setup of read('fixture').setup) {
    let result;

    for (let i = 0; i < 40; i++) {
      result =
        await call(
          setup.service,
          setup.action.path,
          setup.action.body,
          setup.action.method,
          setup.action.actor,
        );

      if (result.status !== 404) {
        break;
      }
      await pause(100);
    }
    assert.equal(result.status, setup.expectedStatus, JSON.stringify(result));
  }
  check('real player registration delivered and wallet funded');
  const playerPath = '/internal/v1/players/' + playerId;

  for (const [path, body, method] of [
    [
      playerPath + '/profile',
      {
        request_id: id('profile'),
        expected_version: '1',
        patch: { birth_date: '1990-01-01', residence_country: 'US' },
      },
      'PATCH',
    ],
    [
      playerPath + '/status-changes',
      {
        request_id: id('activate'),
        expected_version: '2',
        status: 'ACTIVE',
        reason_code: 'ACTIVATE',
      },
      'POST',
    ],
    [playerPath + '/kyc-cases', { request_id: id('kyc-open'), required_level: 'BASIC' }, 'POST'],
  ]) {
    const result = await call('player', path, body, method);

    assert.ok([200, 201].includes(result.status), JSON.stringify(result));
  }
  db = new Pool({ connectionString: run.databaseUrls.get('player'), max: 1 });
  let kyc;

  for (let i = 0; i < 100; i++) {
    kyc =
      await db.query('SELECT count(*)::text AS n FROM player_kyc_checks WHERE kyc_case_id=$1', [caseId]);

    if (kyc.rows[0].n === '3') {
      break;
    }
    await pause(100);
  }
  assert.equal(kyc.rows[0].n, '3');
  await db.end();
  db = undefined;
  check('process KYC worker recorded three stable checks');
  const approved = await call(
    'player',
    playerPath + '/kyc-cases/' + caseId + '/decisions',
    {
      request_id: id('approve'),
      expected_version: '4',
      decision: 'APPROVED',
      decision_code: 'APPROVED',
      valid_until: new Date(Date.now() + 86400000).toISOString(),
    },
  );

  assert.equal(approved.status, 200, JSON.stringify(approved));
  const eventRun = id('events-run');
  const derive = x => ids.derive(operatorId, eventRun, 'events:seed:42:0:' + x);
  const selectionId = derive('selection:HOME');
  const betBody = {
    request_id: id('real-bet'),
    type: 'SINGLE',
    stake: { amount_minor: '100', currency: 'USD' },
    selection: {
      event_id: derive('event'),
      market_id: derive('market'),
      selection_id: selectionId,
      quote_id: ids.derive(operatorId, selectionId, 'events:quote:1'),
      quote_version: '1',
    },
  };
  const playerActor = read('fixture').actions[0].actor;
  const placed = await call('api-gateway', '/v1/bets', betBody, 'POST', playerActor);

  assert.equal(placed.status, 201, JSON.stringify(placed));
  assert.equal(placed.body.bet.status, 'ACCEPTED');
  check('Gateway Betting Ledger real accepted bet');
  const cancel = await call(
    'api-gateway',
    '/v1/bets/' + placed.body.bet.bet_id + '/cancel',
    { request_id: id('cancel-real'), expected_version: placed.body.bet.version },
    'POST',
    playerActor,
  );

  assert.equal(cancel.status, 200, JSON.stringify(cancel));
  check('public cancel refunded once');
  const ledgerEndpoint = await endpoint('ledger');
  const ledgerConfig = run.settings.get('ledger-r0');
  const fundPath = read('fixture').setup.find(s => s.service === 'ledger').action.path;
  const ledgerActor = actor('ledger');
  const funding = key =>
    ({
      method: 'POST',
      path: fundPath,
      actor: ledgerActor,
      body: {
        request_id: id(key),
        amount: { amount_minor: '50', currency: 'USD' },
        provider_ref: 'synthetic:' + key,
      },
    });

  db =
    new Pool(
      {
        connectionString: run.databaseUrls.get('ledger'),
        max: 2,
        options: '-c statement_timeout=5000',
      },
    );
  const restartLedger = async () => {
    await controls.restart('ledger-r0');
    const addr = await run.command(['port', 'ledger-r0', '9100']);

    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch('http://' + addr + '/health/ready')).ok) {
          return;
        }
      } catch { /* Wait for the restarted private listener. */ }
      await pause(100);
    }
    throw Error('Ledger restart timed out');
  };

  barrierClient = await db.connect();
  const lock = barrierClient;

  await lock.query('SELECT pg_advisory_lock(87654321)');
  await db.query(
    'CREATE FUNCTION synthetic_commit_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(87654321); RETURN NEW; END; $$',
  );
  await db.query(
    'CREATE TRIGGER synthetic_commit_barrier BEFORE INSERT ON ledger_transactions FOR EACH ROW EXECUTE FUNCTION synthetic_commit_barrier()',
  );
  const pre = funding('precommit');
  const interrupted = sendAction(ledgerEndpoint, ledgerConfig.identity, pre, '42', seq++).catch(() => undefined);
  let waiting = false;

  for (let i = 0; i < 50; i++) {
    const rows = await db.query(
      "SELECT count(*)::text AS n FROM pg_stat_activity WHERE datname=current_database() AND usename='runtime_user' AND wait_event_type='Lock'",
    );

    if (rows.rows[0].n !== '0') {
      waiting = true;
      break;
    }
    await pause(100);
  }
  assert.ok(waiting);
  await controls.kill('ledger-r0');
  await interrupted;
  await lock.query('SELECT pg_advisory_unlock(87654321)');
  lock.release();
  barrierClient = undefined;
  await db.query('DROP TRIGGER synthetic_commit_barrier ON ledger_transactions');
  await db.query('DROP FUNCTION synthetic_commit_barrier()');
  assert.equal(
    (await db.query(
      'SELECT count(*)::text AS n FROM ledger_transactions WHERE request_id=$1',
      [id('precommit')],
    )).rows[0].n,
    '0',
  );
  await restartLedger();
  assert.equal(
    (await sendAction(await endpoint('ledger'), ledgerConfig.identity, pre, '42', seq++)).status,
    200,
  );
  check('actual Ledger SIGKILL before COMMIT rolled back and stable retry posted once');
  proxy = await startReplyFaultProxy(await endpoint('ledger'));
  proxy.arm(ReplyFault.DROP);
  const post = funding('postcommit');

  await assert.rejects(sendAction(proxy.url, ledgerConfig.identity, post, '42', seq++));
  assert.equal(
    (await db.query(
      'SELECT count(*)::text AS n FROM ledger_transactions WHERE request_id=$1',
      [id('postcommit')],
    )).rows[0].n,
    '1',
  );
  await controls.kill('ledger-r0');
  await restartLedger();
  assert.equal(
    (await sendAction(await endpoint('ledger'), ledgerConfig.identity, post, '42', seq++)).status,
    200,
  );
  assert.equal(
    (await db.query(
      'SELECT count(*)::text AS n FROM ledger_transactions WHERE request_id=$1',
      [id('postcommit')],
    )).rows[0].n,
    '1',
  );
  await proxy.close();
  proxy = undefined;
  check('reply dropped after COMMIT and process restart replayed without duplicate payment');
  await controls.stopBroker();
  await pause(500);
  const ops = await run.command(['port', 'ledger-r0', '9100']);

  assert.equal((await fetch('http://' + ops + '/health/ready')).status, 503);
  const gatewayOps = await run.command(['port', 'api-gateway-r0', '9100']);

  assert.equal((await fetch('http://' + gatewayOps + '/health/ready')).status, 503);
  await controls.restart('nats');
  await pause(4000);
  assert.equal((await fetch('http://' + ops + '/health/ready')).status, 200);
  check('broker outage affects readiness and recovers');
  const base = async (name, port) => 'http://' + await run.command(['port', name, String(port)]);
  const grafana = await base('grafana', 3000);
  const prometheus = await base('prometheus', 9090);
  const tempo = await base('tempo', 3200);

  await pause(6000);
  const dashboard = await (await fetch(grafana + '/api/dashboards/uid/sportsbook-platform')).json();

  assert.equal(dashboard.dashboard.uid, 'sportsbook-platform');
  const prom = await (await fetch(prometheus + '/api/v1/query?query=up')).json();

  assert.equal(prom.status, 'success');
  assert.equal(prom.data.result.filter(r => Number(r.value[1]) === 1).length, 6);
  check('Grafana dashboard provisioned and all six Prometheus targets UP');
  const searches = await (await fetch(tempo + '/api/search?limit=100')).json();

  writeFileSync(run.directory + '/trace-search.json', JSON.stringify(searches));
  let pathFound = false;

  for (const entry of searches.traces ?? []) {
    if (!String(entry.rootTraceName).includes('PlaceBet')) {
      continue;
    }

    const trace = await (await fetch(tempo + '/api/traces/' + entry.traceID)).json();
    const text = JSON.stringify(trace);

    if (['api-gateway', 'betting', 'ledger'].every(x => text.includes(x))) {
      writeFileSync(run.directory + '/request-trace.json', text);
      pathFound = true;
      break;
    }
  }
  assert.ok(pathFound, JSON.stringify(searches));
  check('Tempo trace contains Gateway Betting Ledger path');
  let consumerFound = false;

  for (const entry of searches.traces ?? []) {
    if (!String(entry.rootTraceName).includes('registered publish')) {
      continue;
    }

    const messageTrace = JSON.stringify(await (await fetch(tempo + '/api/traces/' + entry.traceID)).json());

    if (messageTrace.includes('registered consume') && messageTrace.includes('ledger')) {
      consumerFound = true;
      break;
    }
  }
  assert.ok(consumerFound);
  check('Tempo durable publication and Ledger consumer trace');
  await telemetry.close();
  telemetry = undefined;
  await run.command(['stop', '--timeout', '30', ...run.services, 'router']);
  const audit = await reconcile(run);

  assert.equal(audit.status, 'PASS', JSON.stringify(audit));
  writeFileSync(
    '.tmp/process-control/audit.json',
    JSON.stringify(
      {
        runId: manifest.runId,
        ledgerUrl: run.databaseUrls.get('ledger'),
        bettingUrl: run.databaseUrls.get('betting'),
        writersStopped: true,
      },
    ),
    { mode: 0o600 },
  );
  const independent = spawnSync(
    process.execPath,
    ['tools/experiment-runner/dist/cli.js', 'audit', '.tmp/process-control/audit.json'],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );

  assert.equal(independent.status, 0, independent.stderr);
  assert.equal(JSON.parse(independent.stdout).status, 'PASS');
  check('standalone read-only audit CLI passed');
  await db.query(
    "UPDATE ledger_account_balances SET balance_minor=balance_minor+1 WHERE account_id=(SELECT account_id FROM ledger_accounts WHERE account_kind='AVAILABLE' LIMIT 1)",
  );
  const corrupted = await reconcile(run);

  assert.equal(corrupted.status, 'FAIL');
  assert.ok(corrupted.violations.some(v => v.code === 'PROJECTION_MISMATCH'));
  await db.query(
    "UPDATE ledger_account_balances SET balance_minor=balance_minor-1 WHERE account_id=(SELECT account_id FROM ledger_accounts WHERE account_kind='AVAILABLE' LIMIT 1)",
  );
  assert.equal((await reconcile(run)).status, 'PASS');
  check(
    'independent audit PASS then detects deliberate projection corruption then PASS after restore',
  );
  writeFileSync(
    '.tmp/process-control-check-result.json',
    JSON.stringify({ runId: manifest.runId, checks, audit }, null, 2),
  );
  console.log(JSON.stringify({ runId: manifest.runId, checks }));
} catch (error) {
  if (run) {
    writeFileSync(
      '.tmp/process-control-check-failure.log',
      await run.command(['logs', '--no-color', '--tail', '100']).catch(() => ''),
    );
  }
  throw error;
} finally {
  await (async () => {
    const failures = [];

    for (const close of [
      () => proxy?.close(),
      () => telemetry?.close(),
      async () => {
        if (barrierClient) {
          try {
            await barrierClient.query('SELECT pg_advisory_unlock(87654321)');
          } finally {
            barrierClient.release();
          }
        }
      },
      () => db?.end(),
      () => run?.close(),
    ]) {
      try {
        await close();
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length) {
      throw new AggregateError(failures, 'Process regression cleanup failed');
    }
  })();
}
