import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { buf, workspaceRoot } from '../../../tools/contracts/generate.mjs';

function changedFixture(transform) {
  mkdirSync(path.resolve('../../.tmp'), { recursive: true });
  const directory = mkdtempSync(path.resolve('../../.tmp/buf-compatibility-'));

  cpSync('proto', path.join(directory, 'proto'), { recursive: true });
  cpSync('buf.yaml', path.join(directory, 'buf.yaml'));
  const proto = path.join(directory, 'proto/sportsbook/tooling/v1/probe.proto');

  writeFileSync(proto, transform(readFileSync(proto, 'utf8')));

  return directory;
}

test(
  'additive optional field remains compatible',
  () => {
    const directory = changedFixture(
      proto =>
        proto.replace(
          'int64 amount_minor = 1;',
          'int64 amount_minor = 1;\n  optional string description = 6;',
        ),
    );
    const result = buf(['breaking', directory, '--against', '.'], process.cwd());

    assert.equal(result.status, 0, result.stderr || result.stdout);
    mkdirSync(path.join(workspaceRoot, 'packages/contract-spike-client/.tmp'), { recursive: true });
    const generated = mkdtempSync(path.join(workspaceRoot, 'packages/contract-spike-client/.tmp/compatible-'));
    const template = {
      version: 'v2',
      plugins: [
        {
          local: [process.execPath, path.join(workspaceRoot, 'node_modules/ts-proto/protoc-gen-ts_proto')],
          out: generated,
          opt: [
            'forceLong=bigint',
            'outputServices=grpc-js',
            'esModuleInterop=true',
            'importSuffix=.js',
            'oneof=unions',
          ],
        },
      ],
    };
    const generation = buf(['generate', directory, '--template', JSON.stringify(template)]);

    assert.equal(generation.status, 0, generation.stderr || generation.stdout);
    writeFileSync(
      path.join(generated, 'tsconfig.json'),
      JSON.stringify(
        {
          extends: '../../tsconfig.json',
          compilerOptions: { rootDir: '.', outDir: 'dist' },
          include: ['**/*.ts'],
        },
      ),
    );
    const compiled = spawnSync(
      process.execPath,
      [
        path.join(workspaceRoot, 'node_modules/typescript/bin/tsc'),
        '-p',
        path.join(generated, 'tsconfig.json'),
      ],
      { encoding: 'utf8' },
    );

    assert.equal(compiled.status, 0, compiled.stderr || compiled.stdout);
  },
);

test(
  'field type changes and deleted fields are rejected',
  () => {
    for (const transform of [
      proto => proto.replace('int64 amount_minor = 1;', 'string amount_minor = 1;'),
      proto => proto.replace('int64 amount_minor = 1;', ''),
    ]) {
      const directory = changedFixture(transform);
      const result = buf(['breaking', directory, '--against', '.'], process.cwd());

      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /amount_minor/);
    }
  },
);

test(
  'generated artifacts match pinned generator output',
  () => {
    const result = spawnSync(process.execPath, ['check-generated.mjs'], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
  },
);
