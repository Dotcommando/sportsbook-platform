import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { IExperimentProfile, IRunManifest } from './experiment.model.js';
import { canonicalJson, confinedPath, digest } from './profile.js';
import { executeTool } from './tool.js';

export function runDirectory(root: string, runId: string, create = false): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(runId)) {
    throw new Error('Run UUID required');
  }

  const base = path.join(root, 'experiments/results');

  if (create) {
    mkdirSync(base, { recursive: true });
  }

  const dir = confinedPath(base, runId, !create);

  if (create) {
    mkdirSync(dir, { mode: 0o700 });
  }

  return dir;
}

export function writeArtifact(directory: string, name: string, value: unknown): string {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(name)) {
    throw new Error('Artifact basename required');
  }

  const data = canonicalJson(value) + '\n';

  writeFileSync(confinedPath(directory, name, false), data, { mode: 0o600, flag: 'wx' });
  const hash = createHash('sha256').update(data).digest('hex');

  writeFileSync(confinedPath(directory, name + '.sha256', false), hash + '\n', { mode: 0o600, flag: 'wx' });

  return hash;
}

export function readArtifact(directory: string, name: string): unknown {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(name)) {
    throw new Error('Artifact basename required');
  }

  const data = readFileSync(confinedPath(directory, name));
  const expected = readFileSync(confinedPath(directory, name + '.sha256'), 'utf8').trim();

  if (createHash('sha256').update(data).digest('hex') !== expected) {
    throw new Error('Artifact hash mismatch');
  }

  return JSON.parse(data.toString());
}

export async function sourceHash(root: string): Promise<string> {
  const tracked = await executeTool('git', ['ls-files', '-co', '--exclude-standard', '-z'], root);
  const hash = createHash('sha256');

  for (const file of [...new Set(tracked.split('\0').filter(Boolean))].sort()) {
    if (file === 'AGENTS.md' || file.endsWith('/AGENTS.md')) {
      continue;
    }
    hash.update(file + '\0');
    hash.update(readFileSync(confinedPath(root, file)));
  }

  return hash.digest('hex');
}

export async function collectProvenance(
  root: string,
  profile: IExperimentProfile,
  runId: string,
  directory: string,
  image: string,
): Promise<IRunManifest> {
  const revision = await executeTool('git', ['rev-parse', 'HEAD'], root);
  const hash = await sourceHash(root);

  await executeTool(
    'docker',
    [
      'build',
      '--file',
      'infra/compose/platform.Dockerfile',
      '--build-arg',
      'SOURCE_TREE_SHA256=' + hash,
      '--tag',
      image,
      '.',
    ],
    root,
    600000,
  );

  if (await sourceHash(root) !== hash) {
    throw new Error('Source changed during image build; retry with a stable tree');
  }

  const imageId = await executeTool('docker', ['image', 'inspect', image, '--format', '{{.Id}}'], root);

  return {
    runId,
    profileHash: digest(profile),
    sourceRevision: revision,
    seed: profile.seed,
    startedAt: new Date().toISOString(),
    profile,
    effectiveTopology: profile.services,
    hardware: {
      platform: os.platform(),
      architecture: os.arch(),
      cpus: os.cpus().length,
      memoryBytes: String(os.totalmem()),
    },
    versions: [
      { component: 'node', version: process.version },
      { component: 'source-tree-sha256', version: hash },
      { component: 'platform-image', version: imageId },
      {
        component: 'pnpm-lock-sha256',
        version: createHash('sha256').update(readFileSync(path.join(root, 'pnpm-lock.yaml'))).digest('hex'),
      },
    ],
    resources: {
      namespace: runId,
      project: 'sportsbook-run-' + runId,
      composeFile: path.join(directory, 'compose.json'),
    },
  };
}
