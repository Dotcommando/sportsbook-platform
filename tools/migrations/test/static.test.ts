import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { readMigrations } from '@sportsbook/persistence';

const root = fileURLToPath(new URL('../../../', import.meta.url));

for (const service of ['ledger', 'player', 'betting', 'event-simulator']) {
  test(`${service} has checksum-verified SQL and a catalog manifest`, () => {
    const directory = path.join(root, 'apps', service, 'migrations');
    const migrations = readMigrations(directory);
    const manifest = JSON.parse(readFileSync(path.join(directory, 'schema.json'), 'utf8'));

    assert.ok(migrations.length >= 1);
    assert.match(migrations[0]?.checksum ?? '', /^[0-9a-f]{64}$/);
    assert.ok(manifest.tables.length > 0);
  });
}
