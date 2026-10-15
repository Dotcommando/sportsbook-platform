import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { ICatalogSnapshot, IPersistenceRuntime, IRuntimeSettings, ISchemaManifest } from '@sportsbook/persistence';
import { applyMigrations, assertSchema, catalogSnapshot, PersistenceBackend, readMigrations } from '@sportsbook/persistence';
import { Pool } from 'pg';

const root = fileURLToPath(new URL('../../../', import.meta.url));

const containerName = `sportsbook-schema-tests-${process.pid}`;

const image = 'postgres:17.9@sha256:2a0d0fe14825b0939f78a8cad5cd4e6aa68bf94d0e5dd96e24b6d23af4315545';

const allowedServices = ['ledger', 'player', 'betting', 'event-simulator'];

const options = process.argv.slice(2);

const selectedServices = options.find(option => option.startsWith('--services='))?.slice('--services='.length).split(',') ?? allowedServices;

const selectedBackends = options.find(option => option.startsWith('--backends='))?.slice('--backends='.length).split(',') ?? Object.values(PersistenceBackend);

const ledgerFixtures = options.includes('--ledger-fixtures');

const ledgerFinance = options.includes('--ledger-finance');

const ledgerFull = options.includes('--ledger-full');

const playerFeatures = options.includes('--player-features');

const eventsFeatures = options.includes('--events-features');

const bettingFeatures = options.includes('--betting-features');

const allowedStrategies = ['rc_conditional', 'rc_for_update', 'serializable'];

const selectedStrategies = options.find(option => option.startsWith('--strategies='))?.slice('--strategies='.length).split(',') ?? allowedStrategies;

assert.ok(!ledgerFull || ledgerFinance, '--ledger-full requires --ledger-finance');

assert.ok(!ledgerFinance || selectedServices.includes('ledger'), 'Financial checks require the Ledger service');

assert.ok(options.every(option => ['--ledger-fixtures', '--ledger-finance', '--ledger-full', '--player-features', '--events-features', '--betting-features'].includes(option) || option.startsWith('--services=') || option.startsWith('--backends=') || option.startsWith('--strategies=')), 'Unknown integration option');

assert.ok(selectedStrategies.length > 0 && new Set(selectedStrategies).size === selectedStrategies.length && selectedStrategies.every(strategy => allowedStrategies.includes(strategy)), 'Invalid concurrency strategy selection');

assert.ok(selectedServices.length > 0 && new Set(selectedServices).size === selectedServices.length && selectedServices.every(service => allowedServices.includes(service)), 'Invalid service selection');

assert.ok(selectedBackends.length > 0 && new Set(selectedBackends).size === selectedBackends.length && selectedBackends.every(backend => Object.values(PersistenceBackend).some(value => value === backend)), 'Invalid backend selection');

assert.ok(!options.some(option => option.startsWith('--backends=')) || !selectedServices.includes('event-simulator') || selectedBackends.every(backend => backend === PersistenceBackend.Pg), 'Events only supports pg');

function docker(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8' });

  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Docker command failed');

  return result.stdout;
}

interface IServiceModule {
  createServicePersistence(settings: IRuntimeSettings, manifest: ISchemaManifest): Promise<IPersistenceRuntime>;
}

const startedContainer = docker(['run', '--rm', '--detach', '--name', containerName, '-e', 'POSTGRES_USER=migration_owner', '-e', 'POSTGRES_PASSWORD=password', '-p', '127.0.0.1::5432', image, '-c', 'log_statement=all', '-c', 'log_line_prefix=%d %u ']).trim();

assert.match(startedContainer, /^[0-9a-f]{64}$/);

let admin: Pool | undefined;

try {
  const address = docker(['port', startedContainer, '5432/tcp']).trim();

  assert.match(address, /^127\.0\.0\.1:\d+$/);

  for (let attempt = 0; attempt < 60; attempt++) {
    const ready = spawnSync('docker', ['exec', startedContainer, 'pg_isready', '-h', '127.0.0.1', '-U', 'migration_owner'], { encoding: 'utf8' });

    if (ready.status === 0) break;
    if (attempt === 59) throw new Error('Isolated PostgreSQL startup timed out');

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  admin = new Pool({ connectionString: `postgresql://migration_owner:password@${address}/postgres`, max: 1 });

  await admin.query("CREATE ROLE runtime_user LOGIN PASSWORD 'password'");
  await admin.query("CREATE ROLE runtime_probe_user LOGIN PASSWORD 'password' IN ROLE runtime_user");

  let sequence = 0;

  for (const service of selectedServices) {
    const directory = path.join(root, 'apps', service, 'migrations');
    const migrations = readMigrations(directory);
    const manifest: ISchemaManifest = JSON.parse(readFileSync(path.join(directory, 'schema.json'), 'utf8'));
    const module: IServiceModule = await import(pathToFileURL(path.join(root, 'apps', service, 'src/adapters/outbound/persistence/persistence.factory.ts')).href);
    const backends = Object.values(PersistenceBackend).filter(backend => (service !== 'event-simulator' || backend === PersistenceBackend.Pg) && selectedBackends.some(selected => selected === backend));
    let baseline: ICatalogSnapshot | undefined;

    for (const backend of backends) {
      const database = `sportsbook_schema_${process.pid}_${++sequence}`;

      assert.match(database, /^sportsbook_schema_\d+_\d+$/);
      await admin.query(`CREATE DATABASE ${database}`);

      const owner = new Pool({ connectionString: `postgresql://migration_owner:password@${address}/${database}`, max: 2 });

      try {
        await Promise.all([applyMigrations(owner, migrations), applyMigrations(owner, migrations)]);

        const before = await assertSchema(owner, manifest);

        if (baseline) assert.deepEqual(before, baseline, `${service}: schema differs across backends`);
        else baseline = before;

        await owner.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
        await owner.query('GRANT USAGE ON SCHEMA public TO runtime_user');
        await owner.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO runtime_user');

        if (service === 'ledger') {
          await owner.query('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ledger_transactions,ledger_entries FROM runtime_user');
          await owner.query('GRANT EXECUTE ON FUNCTION public.ledger_append_posting(jsonb,jsonb) TO runtime_user');
        }

        const ddlDenied = new Pool({ connectionString: `postgresql://runtime_probe_user:password@${address}/${database}`, max: 1 });

        try {
          await assert.rejects(ddlDenied.query('CREATE TABLE prohibited_runtime_table (entity_id uuid)'), /permission denied/);

          if (service === 'ledger' && ledgerFixtures) {
            const fixture: { verifyAccountingFixture(owner: Pool, runtime: Pool): Promise<void> } = await import(pathToFileURL(path.join(root, 'apps/ledger/test/accounting.fixture.ts')).href);

            await fixture.verifyAccountingFixture(owner, ddlDenied);
          }
        } finally {
          await ddlDenied.end();
        }

        const serverClock = await owner.query<{instant:Date}>('SELECT clock_timestamp() AS instant');
        const logInstant = serverClock.rows[0]?.instant;

        assert.ok(logInstant instanceof Date, 'PostgreSQL log clock unavailable');
        const logStart = new Date(logInstant.getTime() - 100).toISOString();
        const runtime = await module.createServicePersistence(Object.freeze({ connectionString: `postgresql://runtime_user:password@${address}/${database}`, backend, poolMax: 1 }), manifest);

        try {
          await runtime.query('SELECT 1');
        } finally {
          await runtime.close();
        }

        let delta = '';

        for (let attempt = 0; attempt < 20; attempt++) {
          const logAfter = spawnSync('docker', ['logs', '--since', logStart, '--tail', '3000', startedContainer], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });

          assert.equal(logAfter.status, 0, 'Runtime SQL log capture failed');
          delta = logAfter.stdout + logAfter.stderr;

          if (delta.includes(database + ' runtime_user')) break;
          await new Promise(resolve => setTimeout(resolve, 25));
        }

        assert.ok(delta.includes(`${database} runtime_user`), 'Runtime query logging missing');
        assert.doesNotMatch(delta, /runtime_user LOG:\s+statement:\s+(?:CREATE|ALTER|DROP|COMMENT|TRUNCATE)\b/i, 'Runtime startup emitted DDL');
        assert.deepEqual(await assertSchema(owner, manifest), before, 'Runtime changed catalog');

        const modified = migrations.map(migration => ({ ...migration, checksum: '0'.repeat(64) }));

        await assert.rejects(applyMigrations(owner, modified), /checksum/);
        await assert.rejects(applyMigrations(owner, []), /history differs/);

        const broken = { name: '0002_atomic_failure.sql', sql: 'CREATE TABLE failed_records (failed_record_id uuid PRIMARY KEY, operator_id uuid NOT NULL); CREATE TABLE failed_records (failed_record_id uuid PRIMARY KEY, operator_id uuid NOT NULL);', checksum: '' };
        const { createHash } = await import('node:crypto');

        broken.checksum = createHash('sha256').update(broken.sql).digest('hex');
        await assert.rejects(applyMigrations(owner, [...migrations, broken]), /already exists/);
        assert.deepEqual(await catalogSnapshot(owner), before, 'Failed migration left partial DDL/receipt');

        const firstTable = manifest.tables[0];

        assert.ok(firstTable);

        const partial = firstTable.indexes.find(index => index.where && !index.unique);

        assert.ok(partial);
        await owner.query(`DROP INDEX ${partial.name}`);
        await owner.query(`CREATE INDEX ${partial.name} ON ${firstTable.name} (${partial.columns.join(', ')}) WHERE published_at IS NOT NULL`);
        await assert.rejects(assertSchema(owner, manifest), /Wrong index predicate/);
        await owner.query(`DROP INDEX ${partial.name}`);
        await owner.query(`CREATE INDEX ${partial.name} ON ${firstTable.name} (${partial.columns.join(', ')}) WHERE ${partial.where}`);

        await owner.query(`ALTER TABLE ${firstTable.name} ADD CONSTRAINT prohibited_foreign_key FOREIGN KEY (operator_id) REFERENCES ${firstTable.name} (${firstTable.columns[0]?.name}) NOT VALID`);
        await assert.rejects(assertSchema(owner, manifest), /Foreign-key catalog/);
        await owner.query(`ALTER TABLE ${firstTable.name} DROP CONSTRAINT prohibited_foreign_key`);

        await owner.query(`ALTER TABLE ${firstTable.name} ALTER COLUMN attempt_count SET DEFAULT 0`);
        await assert.rejects(assertSchema(owner, manifest), /Unexpected column default/);
        await owner.query(`ALTER TABLE ${firstTable.name} ALTER COLUMN attempt_count DROP DEFAULT`);

        await owner.query(`ALTER TABLE ${firstTable.name} ADD COLUMN unexpected_column text`);
        await assert.rejects(assertSchema(owner, manifest), /Column mismatch/);
        await owner.query(`ALTER TABLE ${firstTable.name} DROP COLUMN unexpected_column`);
        assert.deepEqual(await assertSchema(owner, manifest), before, 'Drift fixture teardown changed catalog');

        if (service === 'ledger' && ledgerFinance) {
          const fixture: { verifyFinancialPersistence(owner: Pool, connectionString: string, backend: PersistenceBackend, strategies: string[], full: boolean): Promise<void> } = await import(pathToFileURL(path.join(root, 'apps/ledger/test/financial-postgres.fixture.ts')).href);

          await fixture.verifyFinancialPersistence(owner, `postgresql://runtime_user:password@${address}/${database}`, backend, selectedStrategies, ledgerFull);
          assert.deepEqual(await assertSchema(owner, manifest), before, 'Financial runtime changed catalog');
        }
        if (service === 'player' && playerFeatures) {const fixture:{verifyPlayerPersistence(owner:Pool, connectionString:string, backend:PersistenceBackend):Promise<void>} = await import(pathToFileURL(path.join(root, 'apps/player/test/player-postgres.fixture.ts')).href);

          await fixture.verifyPlayerPersistence(owner, `postgresql://runtime_user:password@${address}/${database}`, backend);assert.deepEqual(await assertSchema(owner, manifest), before, 'Player runtime changed catalog');}
        if (service === 'betting' && bettingFeatures) {
          const fixture:{verifyBettingPersistence(owner:Pool, connectionString:string, backend:PersistenceBackend):Promise<void>} = await import(pathToFileURL(path.join(root, 'apps/betting/test/betting-postgres.fixture.ts')).href);

          await fixture.verifyBettingPersistence(owner, `postgresql://runtime_user:password@${address}/${database}`, backend);
          assert.deepEqual(await assertSchema(owner, manifest), before, 'Betting runtime changed catalog');
        }
        if (service === 'event-simulator' && eventsFeatures) {
          const fixture:{verifyEventsPersistence(owner:Pool, connectionString:string):Promise<void>} = await import(pathToFileURL(path.join(root, 'apps/event-simulator/test/events-postgres.fixture.ts')).href);

          await fixture.verifyEventsPersistence(owner, `postgresql://runtime_user:password@${address}/${database}`);
          assert.deepEqual(await assertSchema(owner, manifest), before, 'Events runtime changed catalog');
        }
console.log(`${service}/${backend}: rebuilt schema, zero FKs, no runtime DDL, migration replay/rollback and drift checks passed.`);
      } finally {
        await owner.end();
      }
    }
  }
} finally {
  await admin?.end();
  docker(['stop', startedContainer]);
}
