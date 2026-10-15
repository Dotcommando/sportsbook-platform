import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));

export const clientPackages =
  JSON.parse(
    readFileSync(
      path.join(
        workspaceRoot,
        'packages/contracts/clients.json',
      ),
      'utf8',
    ),
  );

export function buf(args, cwd = workspaceRoot) {
  const result = spawnSync(
    process.execPath,
    [path.join(workspaceRoot, 'node_modules/@bufbuild/buf/bin/buf'), ...args],
    { cwd, encoding: 'utf8' },
  );

  if (result.error) {
    throw result.error;
  }

  return result;
}

export function generate(output) {
  const result = buf(
    [
      'generate',
      'packages/contracts',
      '--template',
      'packages/contracts/buf.gen.yaml',
      ...(output ? ['--output', output] : []),
    ],
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Generation failed');
  }

  for (const [owner, clientPackage] of Object.entries(clientPackages)) {
    if (owner === 'tooling') {
      continue;
    }

    const template = {
      version: 'v2',
      plugins: [
        {
          local: [process.execPath, path.join(workspaceRoot, 'node_modules/ts-proto/protoc-gen-ts_proto')],
          out: `packages/${clientPackage}/src/generated`,
          opt: [
            'forceLong=bigint',
            'outputServices=grpc-js',
            'esModuleInterop=true',
            'importSuffix=.js',
            'useExactTypes=true',
            'unrecognizedEnum=true',
            'useOptionals=messages',
            'oneof=unions',
          ],
        },
      ],
    };
    const generated = buf(
      [
        'generate',
        'packages/contracts',
        '--path',
        `packages/contracts/proto/sportsbook/${owner}`,
        '--template',
        JSON.stringify(template),
        ...(output ? ['--output', output] : []),
      ],
    );

    if (generated.status !== 0) {
      throw new Error(generated.stderr || generated.stdout || `Generation failed: ${owner}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(path.join(workspaceRoot, '.tmp'), { recursive: true });
  generate();
}
