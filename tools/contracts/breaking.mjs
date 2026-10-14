import { spawnSync } from 'node:child_process';

import { buf, workspaceRoot } from './generate.mjs';

const revision = process.argv[2];

if (!revision || !/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(revision)) throw new Error('Explicit safe baseline revision required');

const baselineExists = spawnSync('git', ['cat-file', '-e', `${revision}:packages/contracts/buf.yaml`], { cwd: workspaceRoot, encoding: 'utf8' });

if (baselineExists.status !== 0) {
  const resolved = spawnSync('git', ['rev-parse', '--verify', `${revision}^{commit}`], { cwd: workspaceRoot, encoding: 'utf8' });

  if (resolved.status !== 0) throw new Error('Baseline revision does not exist');

  console.log('Base revision has no contracts; initial introduction has no prior API to compare.');
} else {
  const result = buf(['breaking', 'packages/contracts', '--against', `.git#ref=${revision},subdir=packages/contracts`]);

  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Breaking contract change');

  console.log('Contract compatibility against base revision passed.');
}
