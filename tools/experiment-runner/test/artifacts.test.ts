import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { readArtifact, writeArtifact } from '../src/artifacts.js';
import { confinedPath } from '../src/profile.js';

test(
  'artifact read rejects corruption, overwrite and path escape',
  () => {
    const parent = realpathSync(os.tmpdir());
    const directory = mkdtempSync(path.join(parent, 'sportsbook-artifacts-'));

    try {
      writeArtifact(directory, 'result.json', { status: 'INVALID', amount: '9007199254740993' });
      assert.deepEqual(readArtifact(directory, 'result.json'), { status: 'INVALID', amount: '9007199254740993' });
      assert.throws(() => writeArtifact(directory, 'result.json', {}));
      assert.throws(() => confinedPath(directory, '../outside.json', false));
      const file = path.join(directory, 'result.json');

      writeFileSync(file, readFileSync(file, 'utf8').replace('INVALID', 'VALID'));
      assert.throws(() => readArtifact(directory, 'result.json'), /hash mismatch/);
    } finally {
      const relative = path.relative(parent, realpathSync(directory));

      assert.ok(relative.startsWith('sportsbook-artifacts-') && !relative.includes(path.sep));
      rmSync(directory, { recursive: true });
    }
  },
);
