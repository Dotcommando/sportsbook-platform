import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { Pool } from 'pg';
import { parse } from 'pgsql-ast-parser';

import type { IMigration } from './schema.types.js';

export function validateMigrationSql(sql: string): void {
  const statements = parse(sql);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);

      return;
    }
    if (value === null || typeof value !== 'object') return;

    for (const [key, item] of Object.entries(value)) {
      if (key === 'type' && (item === 'foreign key' || item === 'reference')) throw new Error('Foreign-key constraints are forbidden');

      visit(item);
    }
  };

  visit(statements);

  for (const statement of statements) {
    if (statement.type !== 'create table' && statement.type !== 'create index' && statement.type !== 'alter table') throw new Error(`Unsupported migration statement: ${statement.type}`);
    if (statement.type === 'create table') {
      if (!/^[a-z][a-z0-9_]*s$/.test(statement.name.name)) throw new Error(`Invalid table name: ${statement.name.name}`);

      const operator = statement.columns.find(column => column.kind === 'column' && column.name.name === 'operator_id');

      if (operator?.kind !== 'column' || !('name' in operator.dataType) || operator.dataType.name !== 'uuid' || !operator.constraints?.some(constraint => constraint.type === 'not null')) throw new Error('Business tables require operator_id UUID NOT NULL');

      for (const column of statement.columns) {
        if (column.kind !== 'column') continue;

        const typeName = 'name' in column.dataType ? column.dataType.name : undefined;

        if (!/^[a-z][a-z0-9_]*$/.test(column.name.name) || column.name.name === 'id') throw new Error(`Invalid column name: ${column.name.name}`);
        if (column.name.name.endsWith('_minor') && typeName !== 'bigint') throw new Error('Money columns must be BIGINT');
        if ((column.name.name.endsWith('_at') || column.name.name.endsWith('_until')) && !['timestamp with time zone', 'timestamptz'].includes(typeName ?? '')) throw new Error('Instants must use TIMESTAMPTZ');
        if (/odds$/.test(column.name.name) && typeName !== 'numeric') throw new Error('Odds must use exact NUMERIC');
      }
    }
  }
}

export function readMigrations(directory: string): IMigration[] {
  const names = readdirSync(directory).filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();

  return names.map((name, index) => {
    if (Number(name.slice(0, 4)) !== index + 1) throw new Error('Migrations must have contiguous ordered versions');

    const sql = readFileSync(path.join(directory, name), 'utf8');

    validateMigrationSql(sql);

    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
}

export async function applyMigrations(pool: Pool, migrations: readonly IMigration[]): Promise<void> {
  for (const migration of migrations) {
    validateMigrationSql(migration.sql);

    if (createHash('sha256').update(migration.sql).digest('hex') !== migration.checksum) throw new Error('Migration checksum does not match SQL');
  }

  const client = await pool.connect();

  try {
    await client.query("SET TIME ZONE 'UTC'");
    await client.query("SELECT pg_advisory_lock(hashtextextended(current_database() || ':sportsbook:migrations', 0))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (migration_name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL)');

    const applied = await client.query<{ migration_name: string; checksum: string }>('SELECT migration_name, checksum FROM schema_migrations ORDER BY migration_name');

    for (const [index, record] of applied.rows.entries()) {
      const expected = migrations[index];

      if (expected?.name !== record.migration_name || expected.checksum !== record.checksum) throw new Error(`Applied migration history differs: ${record.migration_name}`);
    }

    for (const migration of migrations.slice(applied.rows.length)) {
      await client.query('BEGIN');

      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (migration_name, checksum, applied_at) VALUES ($1, $2, CURRENT_TIMESTAMP)', [migration.name, migration.checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');

        throw error;
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtextextended(current_database() || ':sportsbook:migrations', 0))");
    } finally {
      client.release();
    }
  }
}
