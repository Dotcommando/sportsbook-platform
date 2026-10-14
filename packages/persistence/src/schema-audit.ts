import assert from 'node:assert/strict';

import type { Pool } from 'pg';
import { parse } from 'pgsql-ast-parser';

import type { ISchemaManifest } from './schema.types.js';

export interface ICatalogSnapshot {
  columns: Record<string, unknown>[];
  constraints: Record<string, unknown>[];
  indexes: Record<string, unknown>[];
}

export async function catalogSnapshot(pool: Pool): Promise<ICatalogSnapshot> {
  const columns = await pool.query('SELECT c.relname AS table_name, a.attname AS column_name, format_type(a.atttypid,a.atttypmod) AS column_type, a.attnotnull AS required, pg_get_expr(d.adbin,d.adrelid) AS default_expression, a.attidentity AS identity_kind, a.attgenerated AS generated_kind FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname=$1 AND c.relkind=$2 AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum', ['public', 'r']);
  const constraints = await pool.query('SELECT c.relname AS table_name, p.conname, p.contype, pg_get_constraintdef(p.oid) AS definition FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 ORDER BY c.relname,p.conname', ['public']);
  const indexes = await pool.query('SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=$1 ORDER BY tablename,indexname', ['public']);

  return { columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows };
}

export async function assertSchema(pool: Pool, manifest: ISchemaManifest): Promise<ICatalogSnapshot> {
  const snapshot = await catalogSnapshot(pool);
  const foreignKeys = await pool.query("SELECT conrelid::regclass AS table_name, conname AS constraint_name FROM pg_constraint WHERE contype = 'f'");

  assert.equal(foreignKeys.rowCount, 0, 'Foreign-key catalog must be empty');

  const tableNames = [...new Set(snapshot.columns.map(column => column.table_name))].filter(name => name !== 'schema_migrations').sort();

  assert.deepEqual(tableNames, manifest.tables.map(table => table.name).sort(), 'Business table inventory differs');

  for (const table of manifest.tables) {
    const columns = snapshot.columns.filter(column => column.table_name === table.name).map(column => ({ name: column.column_name, type: column.column_type, required: column.required }));

    assert.deepEqual(columns, table.columns.map(column => ({ name: column.name, type: column.type, required: !column.nullable })), `Column mismatch: ${table.name}`);

    const primary = snapshot.constraints.find(constraint => constraint.table_name === table.name && constraint.contype === 'p');

    assert.equal(primary?.definition, `PRIMARY KEY (${table.columns.filter(column => column.primary).map(column => column.name).join(', ')})`, `Wrong primary key: ${table.name}`);

    for (const column of snapshot.columns.filter(column => column.table_name === table.name)) {
      assert.equal(column.default_expression, null, `Unexpected column default: ${table.name}.${column.column_name}`);
      assert.equal(column.identity_kind, '', `Unexpected identity column: ${table.name}.${column.column_name}`);
      assert.equal(column.generated_kind, '', `Unexpected generated column: ${table.name}.${column.column_name}`);
    }

    for (const index of table.indexes) {
      const actual = snapshot.indexes.find(candidate => candidate.tablename === table.name && candidate.indexname === index.name);

      assert.ok(actual, `Missing index: ${index.name}`);
      assert.equal(String(actual.indexdef).includes('CREATE UNIQUE INDEX'), index.unique === true, `Wrong uniqueness: ${index.name}`);
      assert.ok(String(actual.indexdef).includes(`(${index.columns.join(', ')})`), `Wrong index columns: ${index.name}`);
      assert.equal(String(actual.indexdef).includes(' WHERE '), index.where !== undefined, `Wrong partial index: ${index.name}`);

      if (index.where) {
        const actualStatement = parse(String(actual.indexdef))[0];
        const expectedStatement = parse(`CREATE INDEX expected_index ON ${table.name} (${index.columns.join(', ')}) WHERE ${index.where}`)[0];

        assert.ok(actualStatement?.type === 'create index' && expectedStatement?.type === 'create index');
        assert.deepEqual(actualStatement.where, expectedStatement.where, `Wrong index predicate: ${index.name}`);
      }
    }

    for (const [index] of table.checks.entries()) assert.ok(snapshot.constraints.some(constraint => constraint.table_name === table.name && constraint.conname === `${table.name}_check_${index + 1}` && constraint.contype === 'c'), `Missing check: ${table.name} #${index + 1}`);
  }

  return snapshot;
}
