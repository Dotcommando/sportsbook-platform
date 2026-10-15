import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { loadModule, parseSync } from 'libpg-query';
import type { Pool } from 'pg';
import { parse } from 'pgsql-ast-parser';

import type { IMigration } from './schema.types.js';

await loadModule();

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid PostgreSQL syntax tree');
  }

  return Object.fromEntries(Object.entries(value));
}

export function validateMigrationSql(sql: string): void {
  const tree = record(parseSync(sql));

  if (!Array.isArray(tree.stmts)) {
    throw new Error('Invalid PostgreSQL statement inventory');
  }

  const statements =
    tree.stmts.flatMap(
      (item: unknown) => {
        const raw = record(item);
        const statement = record(raw.stmt);
        const start = typeof raw.stmt_location === 'number' ? raw.stmt_location : 0;
        const length = typeof raw.stmt_len === 'number' && raw.stmt_len > 0 ? raw.stmt_len : sql.length - start;
        const text = Buffer.from(sql).subarray(start, start + length).toString('utf8');

        if (statement.CreateFunctionStmt) {
          const definition = record(statement.CreateFunctionStmt);
          const functionName = Array.isArray(definition.funcname)
            ? definition.funcname.map((part: unknown) => record(record(part).String).sval).join('.')
            : '';

          if (!['public.ledger_append_posting', 'public.reject_event_history_mutation'].includes(functionName)) {
            throw new Error('Unregistered migration function');
          }
          if (!Array.isArray(definition.options)) {
            throw new Error('Missing function options');
          }

          for (const option of definition.options) {
            const element = record(record(option).DefElem);

            if (element.defname !== 'as') {
              continue;
            }

            const body = record(record(element.arg).List);

            if (!Array.isArray(body.items)) {
              throw new Error('Invalid function body');
            }

            for (const part of body.items) {
              const source = record(record(part).String).sval;

              if (functionName === 'public.reject_event_history_mutation'
                && (typeof source !== 'string'
                  || !/^\s*BEGIN\s+RAISE EXCEPTION 'Event history is immutable';\s*END;?\s*$/.test(source))) {
                throw new Error('Invalid immutable-history function body');
              }
              if (typeof source !== 'string'
                || /\b(CREATE|ALTER|DROP|TRUNCATE|REFERENCES|FOREIGN|EXECUTE)\b/i.test(source)) {
                throw new Error('DDL and dynamic SQL are forbidden inside posting functions');
              }
            }
          }

          return [];
        }
        if (statement.CreateTrigStmt) {
          const trigger = record(statement.CreateTrigStmt);
          const relation = record(trigger.relation);
          const registered =
            {
              event_results_immutable:
              'event_results',
              event_quotes_immutable:
              'event_quote_snapshots',
            };
          const table = typeof trigger.trigname === 'string'
            ? Object.entries(registered).find(([name]) => name === trigger.trigname)?.[1]
            : undefined;
          const functionName = Array.isArray(trigger.funcname)
            ? trigger.funcname.map((part: unknown) => record(record(part).String).sval).join('.')
            : '';

          if (!table || relation.relname !== table
            || (relation.schemaname !== undefined && relation.schemaname !== 'public')
            || functionName !== 'public.reject_event_history_mutation'
            || trigger.row !== true
            || trigger.timing !== 2
            || trigger.events !== 24
            || trigger.whenClause
            || trigger.args
            || trigger.replace) {
            throw new Error('Unregistered immutable-history trigger');
          }

          return [];
        }
        if (statement.GrantStmt) {
          const grant = record(statement.GrantStmt);

          if (grant.is_grant === true || grant.objtype !== 'OBJECT_FUNCTION') {
            throw new Error('Only function privilege revocation is allowed in migrations');
          }

          return [];
        }

        return parse(text);
      },
    );
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);

      return;
    }
    if (value === null || typeof value !== 'object') {
      return;
    }

    for (const [key, item] of Object.entries(value)) {
      if ((key === 'type' && (item === 'foreign key' || item === 'reference'))
        || (key === 'contype' && item === 'CONSTR_FOREIGN')) {
        throw new Error('Foreign-key constraints are forbidden');
      }
      visit(item);
    }
  };

  visit(tree);
  visit(statements);

  for (const statement of statements) {
    if (statement.type !== 'create table' && statement.type !== 'create index'
      && statement.type !== 'alter table') {
      throw new Error(`Unsupported migration statement: ${statement.type}`);
    }
    if (statement.type === 'create table') {
      if (!/^[a-z][a-z0-9_]*s$/.test(statement.name.name)) {
        throw new Error(`Invalid table name: ${statement.name.name}`);
      }

      const operator = statement.columns.find(
        column => column.kind === 'column' && column.name.name === 'operator_id',
      );

      if (operator?.kind !== 'column' || !('name' in operator.dataType)
        || operator.dataType.name !== 'uuid'
        || !operator.constraints?.some(constraint => constraint.type === 'not null')) {
        throw new Error('Business tables require operator_id UUID NOT NULL');
      }

      for (const column of statement.columns) {
        if (column.kind !== 'column') {
          continue;
        }

        const typeName = 'name' in column.dataType ? column.dataType.name : undefined;

        if (!/^[a-z][a-z0-9_]*$/.test(column.name.name) || column.name.name === 'id') {
          throw new Error(`Invalid column name: ${column.name.name}`);
        }
        if (column.name.name.endsWith('_minor') && typeName !== 'bigint') {
          throw new Error('Money columns must be BIGINT');
        }
        if ((column.name.name.endsWith('_at') || column.name.name.endsWith('_until'))
          && !['timestamp with time zone', 'timestamptz'].includes(typeName ?? '')) {
          throw new Error('Instants must use TIMESTAMPTZ');
        }
        if (/odds$/.test(column.name.name) && typeName !== 'numeric') {
          throw new Error('Odds must use exact NUMERIC');
        }
      }
    }
  }
}

export function readMigrations(directory: string): IMigration[] {
  const names = readdirSync(directory).filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();

  return names.map(
    (name, index) => {
      if (Number(name.slice(0, 4)) !== index + 1) {
        throw new Error('Migrations must have contiguous ordered versions');
      }

      const sql = readFileSync(path.join(directory, name), 'utf8');

      validateMigrationSql(sql);

      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    },
  );
}

export async function applyMigrations(pool: Pool, migrations: readonly IMigration[]): Promise<void> {
  for (const migration of migrations) {
    validateMigrationSql(migration.sql);

    if (createHash('sha256').update(migration.sql).digest('hex') !== migration.checksum) {
      throw new Error('Migration checksum does not match SQL');
    }
  }
  const client = await pool.connect();

  try {
    await client.query("SET TIME ZONE 'UTC'");
    await client.query(
      "SELECT pg_advisory_lock(hashtextextended(current_database() || ':sportsbook:migrations', 0))",
    );
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (migration_name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL)',
    );
    const applied = await client.query<{ migration_name: string; checksum: string }>(
      'SELECT migration_name, checksum FROM schema_migrations ORDER BY migration_name',
    );

    for (const [index, record] of applied.rows.entries()) {
      const expected = migrations[index];

      if (expected?.name !== record.migration_name || expected.checksum !== record.checksum) {
        throw new Error(`Applied migration history differs: ${record.migration_name}`);
      }
    }

    for (const migration of migrations.slice(applied.rows.length)) {
      await client.query('BEGIN');

      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name, checksum, applied_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
          [migration.name, migration.checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try {
      await client.query(
        "SELECT pg_advisory_unlock(hashtextextended(current_database() || ':sportsbook:migrations', 0))",
      );
    } finally {
      client.release();
    }
  }
}
