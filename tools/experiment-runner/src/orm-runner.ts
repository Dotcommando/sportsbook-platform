import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ISchemaManifest } from '@sportsbook/persistence';
import { applyMigrations, assertSchema, readMigrations } from '@sportsbook/persistence';
import { Pool } from 'pg';

import { runDirectory, sourceHash, writeArtifact } from './artifacts.js';
import { POSTGRES_IMAGE } from './compose.js';
import type { IExperimentProfile, IOrmBenchResult, IOrmDataAudit, IRunManifest, IVersion } from './experiment.model.js';
import { AuditStatus, DeviceKind, ExperimentKind, LoadMode, OrmOperation, RunStatus } from './experiment.model.js';
import { stableId } from './load.js';
import { workerProcess } from './orm/worker-process.js';
import { deepFreeze, digest, validateProfile } from './profile.js';
import { executeTool } from './tool.js';

function schema(): ISchemaManifest {
  const column = (name: string, type: string, primary = false): {
    name: string;
    type: string;
    nullable: false;
    primary: boolean;
  } =>
    ({ name, type, nullable: false, primary });

  return {
    service: 'orm-benchmark',
    tables: [
      {
        name: 'bench_accounts',
        columns: [
          column('account_id', 'uuid', true),
          column('operator_id', 'uuid'),
          column('value', 'bigint'),
          column('created_at', 'timestamp with time zone'),
        ],
        indexes: [
          { name: 'bench_accounts_pkey', columns: ['account_id'], unique: true },
          {
            name: 'bench_accounts_operator_id_account_id_key',
            columns: ['operator_id', 'account_id'],
            unique: true,
          },
        ],
        checks: ['value >= 0'],
      },
      {
        name: 'bench_entries',
        columns: [
          column('entry_id', 'uuid', true),
          column('operator_id', 'uuid'),
          column('account_id', 'uuid'),
          column('value', 'bigint'),
        ],
        indexes: [
          { name: 'bench_entries_pkey', columns: ['entry_id'], unique: true },
          { name: 'bench_entries_account_idx', columns: ['operator_id', 'account_id'] },
        ],
        checks: ['value >= 0'],
      },
    ],
  };
}

export class OrmMicrobenchRunner {
  private readonly project = 'sportsbook-orm-' + randomUUID();
  private readonly password = randomBytes(24).toString('hex');
  private composeFile: string | undefined;
  private admin: Pool | undefined;
  private address: string | undefined;

  constructor(private readonly root: string) { }

  private async compose(args: string[]): Promise<string> {
    if (!this.composeFile) {
      throw new Error('ORM target not prepared');
    }

    return executeTool(
      'docker',
      ['compose', '--project-name', this.project, '--file', this.composeFile, ...args],
      this.root,
      120000,
    );
  }

  private async start(directory: string): Promise<void> {
    if (this.admin) {
      return;
    }
    this.composeFile = path.join(directory, 'orm-compose.json');
    writeFileSync(
      this.composeFile,
      JSON.stringify(
        {
          name: this.project,
          services: {
            postgres: {
              image: POSTGRES_IMAGE,
              labels: { 'sportsbook.orm': this.project },
              environment: { POSTGRES_USER: 'migration_owner', POSTGRES_PASSWORD: this.password },
              ports: ['127.0.0.1::5432'],
              cpus: 1,
              mem_limit: '512m',
              command: [
                'postgres',
                '-c',
                'timezone=UTC',
                '-c',
                'max_connections=100',
                '-c',
                'track_io_timing=on',
                '-c',
                'autovacuum=off',
              ],
              healthcheck: {
                test: ['CMD', 'pg_isready', '-h', '127.0.0.1', '-U', 'migration_owner', '-d', 'postgres'],
                interval: '1s',
                timeout: '2s',
                retries: 60,
              },
            },
          },
        },
      ),
      { mode: 0o600, flag: 'wx' },
    );
    await this.compose(['up', '-d', '--wait']);
    this.address = await this.compose(['port', 'postgres', '5432']);

    if (!/^127\.0\.0\.1:\d+$/.test(this.address)) {
      throw new Error('ORM database must be isolated on loopback');
    }
    this.admin =
      new Pool(
        {
          connectionString: 'postgresql://migration_owner:' + this.password + '@' + this.address + '/postgres',
          max: 1,
        },
      );
    await this.admin.query("CREATE ROLE bench_runtime LOGIN PASSWORD '" + this.password + "'");
  }

  async run(raw: IExperimentProfile): Promise<IOrmBenchResult> {
    const profile = validateProfile(raw);
    const settings = profile.orm;

    if (profile.kind !== ExperimentKind.ORM || profile.dimensions.length !== 0 || !settings
      || profile.workload.mode !== LoadMode.CLOSED_LOOP
      || profile.workload.devices.length !== 1
      || profile.workload.devices[0]?.kind !== DeviceKind.LOCAL
      || (profile.workload.concurrency ?? 1) > settings.rows) {
      throw new Error('Pure ORM requires bounded local closed-loop workers');
    }

    const runId = randomUUID();
    const directory = runDirectory(this.root, runId, true);

    await this.start(directory);

    if (!this.admin || !this.address || !this.composeFile) {
      throw new Error('ORM target unavailable');
    }

    const database = 'orm_' + runId.replaceAll('-', '');

    await this.admin.query('CREATE DATABASE ' + database);
    const connectionString = 'postgresql://bench_runtime:' + this.password + '@' + this.address + '/' + database;
    const owner = new Pool(
      {
        connectionString: 'postgresql://migration_owner:' + this.password + '@' + this.address + '/' + database,
        max: 1,
        options: '-c statement_timeout=30000',
      },
    );

    try {
      await applyMigrations(
        owner,
        readMigrations(path.join(this.root, 'tools/experiment-runner/migrations')),
      );
      await assertSchema(owner, schema());
      await owner.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
      await owner.query('GRANT USAGE ON SCHEMA public TO bench_runtime');
      await owner.query('GRANT SELECT,INSERT,UPDATE ON bench_accounts,bench_entries TO bench_runtime');
      const versions: IVersion[] = [
        { component: 'node', version: process.version },
        { component: 'postgres-image', version: POSTGRES_IMAGE },
        { component: 'source-tree-sha256', version: await sourceHash(this.root) },
        {
          component: 'pnpm-lock-sha256',
          version: createHash('sha256').update(readFileSync(path.join(this.root, 'pnpm-lock.yaml'))).digest('hex'),
        },
        { component: 'worker-node-options', version: '--expose-gc --max-old-space-size=512' },
        {
          component: 'pool-model',
          version: 'pg.Client.query counter; Prisma 7 adapter-pg; independent lazy pools; max=' + settings.poolMax,
        },
      ];
      const compiled = createHash('sha256');

      for (const file of [
        'orm/orm-worker.js',
        'orm/driver-counter.js',
        'orm/pg.operation.js',
        'orm/typeorm.operation.js',
        'orm/prisma.operation.js',
        'orm/sequelize.operation.js',
        'orm/sql-operation.js',
        'latency.js',
        'experiment.model.js',
      ]) {
        compiled.update(readFileSync(path.join(this.root, 'tools/experiment-runner/dist', file)));
      }
      versions.push(
        { component: 'compiled-worker-sha256', version: compiled.digest('hex') },
        { component: 'cpu-model', version: os.cpus()[0]?.model ?? 'unavailable' },
        { component: 'os-release', version: os.release() },
      );

      for (const name of ['pg', 'typeorm', 'sequelize', '@prisma/client', '@prisma/adapter-pg']) {
        const data: unknown = JSON.parse(
          readFileSync(
            path.join(this.root, 'tools/experiment-runner/node_modules', name, 'package.json'),
            'utf8',
          ),
        );

        if (data === null || typeof data !== 'object' || !('version' in data)
          || typeof data.version !== 'string') {
          throw new Error('Package version missing');
        }
        versions.push({ component: name, version: data.version });
      }
      const manifest: IRunManifest = {
        runId,
        profileHash: digest(profile),
        sourceRevision: await executeTool('git', ['rev-parse', 'HEAD'], this.root),
        versions,
        seed: profile.seed,
        effectiveTopology: [],
        startedAt: new Date().toISOString(),
        profile,
        hardware: {
          platform: os.platform(),
          architecture: os.arch(),
          cpus: os.cpus().length,
          memoryBytes: String(os.totalmem()),
        },
        resources: { namespace: runId, composeFile: this.composeFile, project: this.project },
      };

      deepFreeze(manifest);
      writeArtifact(directory, 'manifest.json', manifest);
      writeArtifact(
        directory,
        'database-settings.json',
        (await owner.query(
          "SELECT name,setting,unit FROM pg_settings WHERE name IN ('server_version','max_connections','shared_buffers','work_mem','synchronous_commit','fsync','timezone','track_io_timing','autovacuum') ORDER BY name",
        )).rows,
      );
      const operatorId = stableId(profile.seed, 0, 'orm:operator');
      const accounts = Array.from({ length: settings.rows }, (_, i) => stableId(profile.seed, i, 'orm:account')).sort();
      const batch = settings.operation === OrmOperation.BATCH_INSERT
        ? settings.batchSize
        : settings.operation === OrmOperation.INSERT ? 1 : 0;
      const insertIds = Array.from(
        { length: settings.maxOperations * batch },
        (_, i) => stableId(profile.seed, i, 'orm:insert'),
      );
      const seed = async (): Promise<void> => {
        await owner.query('TRUNCATE bench_entries,bench_accounts');
        await owner.query(
          'INSERT INTO bench_accounts(account_id,operator_id,value,created_at) SELECT id::uuid,$2::uuid,1000,$3::timestamptz FROM jsonb_array_elements_text($1::jsonb) ids(id)',
          [JSON.stringify(accounts), operatorId, '2026-01-01T00:00:00.000Z'],
        );
        await owner.query(
          'INSERT INTO bench_entries(entry_id,operator_id,account_id,value) SELECT account_id,operator_id,account_id,1000 FROM bench_accounts',
        );
        await owner.query('ANALYZE bench_accounts,bench_entries');
      };

      await seed();
      const input = { profile, connectionString, operatorId, accountIds: accounts, insertIds, diagnostic: true };
      const diagnostic = await workerProcess(input, async () => { });

      if (!diagnostic.diagnostic) {
        throw new Error('SQL diagnostic missing');
      }
      await seed();
      const plans: unknown[] = [];

      for (const query of diagnostic.diagnostic.queries) {
        if (/^\s*(SELECT|INSERT|UPDATE)\b/i.test(query.sql)) {
          await owner.query('BEGIN');

          try {
            plans.push(
              {
                sql: query.sql,
                plan: (await owner.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + query.sql, query.parameters)).rows,
              },
            );
          } catch (error) {
            plans.push(
              { sql: query.sql, error: error instanceof Error ? error.message : 'Plan unavailable' },
            );
          } finally {
            await owner.query('ROLLBACK');
          }
        }
      }
      writeArtifact(directory, 'sql-diagnostic.json', { ...diagnostic.diagnostic, plans });
      await seed();
      let connections = 0;
      const measured = await workerProcess(
        { ...input, diagnostic: false },
        async () => {
          await seed();
          const row = (await owner.query<{
            count: string;
          }>(
            "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname=current_database() AND usename='bench_runtime'",
          )).rows[0];

          connections = Number(row?.count ?? '0');

          if (!Number.isInteger(connections) || connections < 1 || connections > settings.poolMax) {
            throw new Error('Observed pool connections violate configured budget');
          }
        },
      );

      if (!measured.value) {
        throw new Error('Measurements missing');
      }

      const worker = measured.value;

      worker.measurements.connections = connections;
      const expectedRows = BigInt(settings.rows) + BigInt(worker.completed) * BigInt(batch);
      const expectedTotal = expectedRows * 1000n
        + ([OrmOperation.UPDATE, OrmOperation.READ_MODIFY_WRITE, OrmOperation.FOR_UPDATE].includes(
          settings.operation,
        )
          ? BigInt(worker.completed)
          : 0n);
      const auditRows = await owner.query<{
        rows: string;
        total: string;
        children: string;
        orphans: string;
      }>(
        'SELECT (SELECT count(*)::text FROM bench_accounts) AS rows,(SELECT coalesce(sum(value),0)::text FROM bench_accounts) AS total,(SELECT count(*)::text FROM bench_entries) AS children,(SELECT count(*)::text FROM bench_entries e LEFT JOIN bench_accounts a USING(operator_id,account_id) WHERE a.account_id IS NULL) AS orphans',
      );
      const actual = auditRows.rows[0];

      if (!actual) {
        throw new Error('Data audit unavailable');
      }

      const violations: string[] = [];
      const foreign = await owner.query<{
        count: string;
      }>(
        'SELECT ((SELECT count(*) FROM bench_accounts WHERE operator_id<>$1::uuid)+(SELECT count(*) FROM bench_entries WHERE operator_id<>$1::uuid))::text AS count',
        [operatorId],
      );

      if (foreign.rows[0]?.count !== '0') {
        violations.push('FOREIGN_OPERATOR');
      }
      if (plans.some(value => value !== null && typeof value === 'object' && 'error' in value)) {
        violations.push('DIAGNOSTIC_PLAN_FAILURE');
      }
      if (actual.rows !== String(expectedRows)) {
        violations.push('ROW_COUNT');
      }
      if (actual.total !== String(expectedTotal)) {
        violations.push('VALUE_TOTAL');
      }
      if (actual.children !== String(settings.rows)) {
        violations.push('CHILD_COUNT');
      }
      if (actual.orphans !== '0') {
        violations.push('LOGICAL_REFERENCE');
      }
      if (worker.errors.length) {
        violations.push('OPERATION_FAILURE');
      }
      if (worker.measurements.latency.count >= settings.maxOperations
        && worker.measurements.elapsedSeconds < profile.workload.durationSeconds) {
        violations.push('OPERATION_BUDGET_REACHED');
      }

      const dataAudit: IOrmDataAudit = {
        status: violations.length ? AuditStatus.FAIL : AuditStatus.PASS,
        expectedRows: String(expectedRows),
        actualRows: actual.rows,
        logicalOrphans: actual.orphans,
        expectedValueTotal: String(expectedTotal),
        actualValueTotal: actual.total,
        violations,
      };
      const result: IOrmBenchResult = {
        runId,
        manifestHash: digest(manifest),
        backend: settings.backend,
        lane: settings.lane,
        operation: settings.operation,
        measurements: worker.measurements,
        dataAudit,
        telemetryRefs: ['sql-diagnostic.json', 'database-settings.json', 'worker-errors.json'],
        status: violations.length ? RunStatus.INVALID : RunStatus.VALID,
      };

      await assertSchema(owner, schema());
      writeArtifact(directory, 'worker-errors.json', worker.errors);
      writeArtifact(directory, 'result.json', result);

      return result;
    } catch (error) {
      writeArtifact(
        directory,
        'run-failure.json',
        { stage: 'orm', message: error instanceof Error ? error.message : 'ORM failed' },
      );
      throw error;
    } finally {
      await this.dropDatabase(owner, database);
    }
  }

  private async dropDatabase(owner: Pool, database: string): Promise<void> {
    await owner.end();

    if (!this.admin) {
      throw new Error('ORM admin unavailable');
    }

    for (let attempt = 0; attempt < 100; attempt++) {
      const active = await this.admin.query<{
        count: string;
      }>(
        'SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname=$1',
        [database],
      );

      if (active.rows[0]?.count === '0') {
        await this.admin.query('DROP DATABASE ' + database);

        return;
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('ORM connections did not drain');
  }

  async close(): Promise<void> {
    await this.admin?.end();
    this.admin = undefined;

    if (this.composeFile) {
      await this.compose(['down', '--volumes', '--remove-orphans', '--timeout', '10']);
    }
  }
}
