import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { clientPackages, generate, workspaceRoot } from '../../tools/contracts/generate.mjs';

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(
    entry => {
      const entryPath = path.join(directory, entry.name);

      return entry.isDirectory() ? files(entryPath) : [entryPath];
    },
  );
}

mkdirSync(path.join(workspaceRoot, '.tmp'), { recursive: true });

const temporary = mkdtempSync(path.join(workspaceRoot, '.tmp/protobuf-generation-'));

generate(temporary);

for (const relative of [
  ...Object.values(clientPackages).map(clientPackage => `packages/${clientPackage}/src/generated`),
  'tools/contract-spike/generated',
]) {
  const actual = path.join(temporary, relative);
  const expected = path.join(workspaceRoot, relative);
  const actualFiles = files(actual).map(filePath => path.relative(actual, filePath)).sort();
  const expectedFiles = files(expected).map(filePath => path.relative(expected, filePath)).sort();

  assert.deepEqual(actualFiles, expectedFiles, 'Generated file inventory differs');

  for (const file of actualFiles) {
    if (!readFileSync(path.join(actual, file)).equals(readFileSync(path.join(expected, file)))) {
      throw new Error(`Generated artifact differs: ${file}`);
    }
  }
}

console.log('Generated artifacts are consistent.');
