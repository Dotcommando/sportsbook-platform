import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DirectiveNode } from 'graphql';
import { Kind, parse, print, visit } from 'graphql';

import { freePort } from '../../../apps/api-gateway/test/transports.fixture.js';
import { readRegistry } from '../src/composition.js';

export const root = fileURLToPath(new URL('../../../', import.meta.url));

export const privateBindHost = process.platform === 'win32'
  ? '127.0.0.1'
  : Object.values(networkInterfaces()).flat().find(
    address =>
      address?.family === 'IPv4' && !address.internal
      && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address),
  )?.address;

export function docker(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.error?.message || 'Docker failed');
  }

  return result.stdout.trim();
}

export const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export async function startRouter(
  urls: Readonly<
    Record<
      string,
      string
    >
  >,
  label: string,
): Promise<
  {
    endpoint: string;

    close(): void

  }
> {
  const registry = readRegistry(root);
  const directory = path.join(root, '.tmp/federation-' + label + '-' + process.pid);

  mkdirSync(directory, { recursive: true });
  const document = visit(
    parse(readFileSync(path.join(root, 'infra/router/supergraph.graphql'), 'utf8')),
    {
      Directive(node): DirectiveNode | undefined {
        if (node.name.value !== 'join__graph') {
          return;
        }

        const owner = node.arguments?.find(a => a.name.value === 'name')?.value;

        if (owner?.kind !== Kind.STRING) {
          return;
        }

        const url = urls[owner.value];

        assert.ok(url, 'Missing live subgraph URL: ' + owner.value);

        return {
          ...node,
          arguments: (node.arguments ?? []).map(
            a => a.name.value === 'url' ? { ...a, value: { kind: Kind.STRING, value: url } } : a,
          ),
        };
      },
    },
  );

  writeFileSync(path.join(directory, 'supergraph.graphql'), print(document) + '\n');
  const port = await freePort();
  const health = await freePort();
  const name = 'sportsbook-router-' + label + '-' + process.pid;

  docker(
    [
      'run',
      '--detach',
      '--name',
      name,
      '--platform',
      'linux/amd64',
      '-p',
      '127.0.0.1:' + port + ':4000',
      '-p',
      '127.0.0.1:' + health + ':8088',
      '-v',
      path.join(root, 'infra/router/router.yaml') + ':/dist/config/router.yaml:ro',
      '-v',
      directory + ':/artifacts:ro',
      registry.routerImage,
      '--config',
      '/dist/config/router.yaml',
      '--supergraph',
      '/artifacts/supergraph.graphql',
    ],
  );
  const close = (): void => {
    docker(['rm', '--force', name]);
  };

  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:' + health + '/health', { signal: AbortSignal.timeout(300) });

        if (response.ok) {
          return { endpoint: 'http://127.0.0.1:' + port + '/internal/graphql', close };
        }
      } catch {
        await pause(100);
        continue;
      }
      await pause(100);
    }
    throw new Error('Router startup timed out: ' + docker(['logs', name]));
  } catch (error) {
    close();
    throw error;
  }
}

export function dockerUrl(url: string): string {
  const parsed = new URL(url);

  if (process.platform === 'win32') {
    parsed.hostname = 'host.docker.internal';
  }

  return parsed.href;
}
