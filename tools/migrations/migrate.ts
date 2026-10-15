import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ISchemaManifest } from '@sportsbook/persistence';
import { applyMigrations, assertSchema, readMigrations } from '@sportsbook/persistence';
import { Pool } from 'pg';

const root = fileURLToPath(new URL('../../', import.meta.url));

const service = process.argv[2];

if (!service || !['ledger', 'player', 'betting', 'event-simulator'].includes(service)) {
  throw new Error('Explicit stateful service required');
}

const connectionString = process.env.MIGRATION_DATABASE_URL;

if (!connectionString) {
  throw new Error('MIGRATION_DATABASE_URL required; runtime credentials must be separate');
}

const directory = path.join(root, 'apps', service, 'migrations');

const manifest: ISchemaManifest = JSON.parse(readFileSync(path.join(directory, 'schema.json'), 'utf8'));

const pool = new Pool({ connectionString, max: 1 });

try {
  await applyMigrations(pool, readMigrations(directory));
  await assertSchema(pool, manifest);
  console.log(`${service}: migration history, schema and zero-FK audit passed.`);
} finally {
  await pool.end();
}
