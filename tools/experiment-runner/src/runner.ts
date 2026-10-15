import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { parseSettingsJson } from '@sportsbook/runtime-settings';
import type { IIdentitySettings, IJetStreamTopology } from '@sportsbook/service-transport';
import { configureJetStream, objectValue, SignedIdentity } from '@sportsbook/service-transport';
import { connect } from 'nats';

import { collectProvenance, readArtifact, runDirectory, writeArtifact } from './artifacts.js';
import { ComposeRun, PLATFORM_IMAGE } from './compose.js';
import type { IExperimentProfile, IReportArtifacts, IRunManifest, IRunResult } from './experiment.model.js';
import { AuditStatus, DeviceKind, ExperimentKind, RunStatus, ServiceName } from './experiment.model.js';
import type { IHttpAction, IPlatformFixture } from './load.js';
import { runLoad, sendAction } from './load.js';
import { confinedPath, deepFreeze, digest, readProfile, resolveMatrix, validateProfile } from './profile.js';
import { reconcile } from './reconcile.js';
import { startTelemetry } from './telemetry.js';

function identity(settings: Record<string, unknown>): IIdentitySettings {
  const value = objectValue(settings.identity);

  if (typeof value.issuer !== 'string' || typeof value.audience !== 'string'
    || typeof value.key !== 'string'
    || typeof value.maximumDeadlineMs !== 'number') {
    throw new Error('Owner identity settings missing');
  }

  const result = {
    issuer: value.issuer,
    audience: value.audience,
    key: value.key,
    maximumDeadlineMs: value.maximumDeadlineMs,
  };

  new SignedIdentity(result);

  return result;
}

export class ExperimentRunner {
  private readonly prepared = new Map<string, ComposeRun>();

  constructor(private readonly root: string) { }

  preparedRun(manifest: IRunManifest): ComposeRun {
    const run = this.prepared.get(manifest.runId);

    if (!run || digest(run.manifest) !== digest(manifest)) {
      throw new Error('Prepared manifest required');
    }

    return run;
  }

  loadProfile(file: string): IExperimentProfile {
    return readProfile(this.root, file);
  }

  async prepare(profile: IExperimentProfile, runId: string): Promise<IRunManifest> {
    profile = validateProfile(profile);

    if (profile.kind !== ExperimentKind.PLATFORM || profile.workload.devices.length !== 1
      || profile.workload.devices[0]?.kind !== DeviceKind.LOCAL) {
      throw new Error('This runner requires one explicit local platform generator');
    }

    const directory = runDirectory(this.root, runId, true);
    const manifest = await collectProvenance(this.root, profile, runId, directory, PLATFORM_IMAGE);

    deepFreeze(manifest);
    writeArtifact(directory, 'manifest.json', manifest);
    const run = new ComposeRun(this.root, directory, manifest);

    try {
      await run.prepare();
      await run.provision();
      const broker = await run.broker();
      let connection: Awaited<ReturnType<typeof connect>> | undefined;

      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          connection =
            await connect({ servers: [broker.server], user: 'topology', pass: broker.password, timeout: 2000 });
          break;
        } catch {
          if (attempt === 49) {
            throw new Error('Isolated broker startup failed');
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (!connection) {
        throw new Error('Broker connection missing');
      }

      try {
        const topology: IJetStreamTopology =
          JSON.parse(
            readFileSync(
              path.join(
                this.root,
                'infra/nats/topology.json',
              ),
              'utf8',
            ),
          );

        await configureJetStream(await connection.jetstreamManager(), topology);
      } finally {
        await connection.close();
      }
      await run.start();
      this.prepared.set(runId, run);

      return manifest;
    } catch (error) {
      let logs = '';

      try {
        logs = await run.command(['logs', '--no-color', '--tail', '50']);
      } catch {
        logs = 'Compose logs unavailable';
      }
      writeArtifact(
        directory,
        'prepare-failure.json',
        {
          stage: 'prepare',
          message: error instanceof Error ? error.message : 'Unknown failure',
          logs,
        },
      );

      try {
        await run.close();
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Prepare and cleanup failed');
      }
      throw error;
    }
  }

  async run(manifest: IRunManifest): Promise<IRunResult> {
    const run = this.prepared.get(manifest.runId);

    if (!run || digest(run.manifest) !== digest(manifest)) {
      throw new Error('Prepared manifest required');
    }

    const profile = manifest.profile;
    let failure: unknown;
    let completed: IRunResult | undefined;
    let telemetry: Awaited<ReturnType<typeof startTelemetry>> | undefined;

    try {
      if (profile.telemetry.enabled) {
        telemetry = await startTelemetry(run);
      }
      if (!profile.fixture) {
        throw new Error('Explicit synthetic fixture required');
      }

      const raw = parseSettingsJson(readFileSync(confinedPath(this.root, profile.fixture), 'utf8'));
      const fixture = validateFixture(raw);

      writeArtifact(run.directory, 'fixture-provenance.json', { hash: digest(raw) });
      let sequence = 0;

      for (const setup of fixture.setup) {
        const owner = run.settings.get(setup.service + '-r0');

        if (!owner) {
          throw new Error('Fixture owner missing');
        }

        const setupSequence = sequence++;
        const endpoint = await run.endpoint(setup.service);
        let result = await sendAction(endpoint, identity(owner), setup.action, profile.seed, setupSequence);

        for (let attempt = 0; result.status === 404 && attempt < 30; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          result = await sendAction(endpoint, identity(owner), setup.action, profile.seed, setupSequence);
        }

        if (result.status !== setup.expectedStatus) {
          throw new Error(
            'Fixture command failed: ' + setup.service + ' ' + setup.action.path + ' ' + result.status
            + ' '
            + String(result.body.code),
          );
        }
      }
      const gateway = run.settings.get(ServiceName.GATEWAY + '-r0');

      if (!gateway) {
        throw new Error('Gateway missing');
      }

      const base = await run.gateway();
      const publicIdentity = identity(gateway);
      const invoke = (index: number): ReturnType<typeof sendAction> => {
        const action = fixture.actions[index % fixture.actions.length];

        if (!action) {
          throw new Error('Empty workload');
        }

        return sendAction(base, publicIdentity, action, profile.seed, index);
      };

      if (profile.workload.warmupSeconds) {
        const warmup = await runLoad(
          { ...profile.workload, durationSeconds: profile.workload.warmupSeconds },
          invoke,
          sequence,
        );

        writeArtifact(run.directory, 'warmup.json', warmup);
        sequence += Number(warmup.offered);
      }

      const workload = await runLoad(profile.workload, invoke, sequence);

      writeArtifact(run.directory, 'workload.json', workload);
      const telemetryRefs = await telemetry?.close() ?? [];

      telemetry = undefined;

      if (profile.telemetry.enabled) {
        for (const service of run.services) {
          writeFileSync(
            path.join(run.directory, service + '.prom'),
            await run.scrape(service),
            { mode: 0o600 },
          );
        }
        telemetryRefs.push(...run.services.map(service => service + '.prom'));
      }
      await run.command(['stop', '--timeout', '30', ...run.services, 'router']);
      const reconciliation = await reconcile(run);

      writeArtifact(run.directory, 'reconciliation.json', reconciliation);
      const status = reconciliation.status === AuditStatus.PASS && BigInt(workload.completed) > 0n
        && workload.technicalFailed === '0'
        && workload.unknown === '0'
        ? RunStatus.VALID
        : RunStatus.INVALID;
      const result: IRunResult = {
        runId: manifest.runId,
        manifestHash: digest(manifest),
        workload,
        reconciliation,
        telemetryRefs,
        status,
      };

      writeArtifact(run.directory, 'result.json', result);
      completed = result;
    } catch (error) {
      failure = error;
      writeArtifact(
        run.directory,
        'run-failure.json',
        { stage: 'run', message: error instanceof Error ? error.message : 'Unknown failure' },
      );
    } finally {
      try {
        await telemetry?.close();
      } catch (error) {
        failure = failure ? new AggregateError([failure, error], 'Run and telemetry failed') : error;
      }
      this.prepared.delete(manifest.runId);

      try {
        await run.close();
      } catch (cleanup) {
        failure = failure ? new AggregateError([failure, cleanup], 'Run and cleanup failed') : cleanup;
      }
    }

    if (failure) {
      throw failure;
    }
    if (!completed) {
      throw new Error('Run result missing');
    }

    return completed;
  }

  async runMatrix(profile: IExperimentProfile): Promise<IRunResult[]> {
    const results: IRunResult[] = [];
    let source: string | undefined;

    for (const point of resolveMatrix(profile)) {
      for (let sample = 0; sample < point.repetitions; sample++) {
        const manifest = await this.prepare(point, randomUUID());
        const current = manifest.versions.find(version => version.component === 'source-tree-sha256')?.version;

        if (!current || source && source !== current) {
          await this.prepared.get(manifest.runId)?.close();
          this.prepared.delete(manifest.runId);
          throw new Error('Source changed within the matrix');
        }
        source = current;
        results.push(await this.run(manifest));
      }
    }

    return results;
  }

  report(runId: string): IReportArtifacts {
    const directory = runDirectory(this.root, runId);
    const manifest = objectValue(readArtifact(directory, 'manifest.json'));
    const result = objectValue(readArtifact(directory, 'result.json'));

    if (result.runId !== runId || result.manifestHash !== digest(manifest)
      || result.status !== RunStatus.VALID && result.status !== RunStatus.INVALID) {
      throw new Error('Result provenance mismatch');
    }

    const report = [
      '# Experiment ' + runId,
      '',
      'Status: ' + String(result.status),
      '',
      'Profile SHA256: ' + String(manifest.profileHash),
      'Source: ' + String(manifest.sourceRevision),
      '',
      '```json',
      JSON.stringify(result, null, 2),
      '```',
      '',
    ].join(
      '\n',
    );
    const file = confinedPath(directory, 'report.md', false);

    writeFileSync(file, report, { mode: 0o600 });

    return {
      runId,
      paths: [file],
      summaryStatus: result.status,
      sourceHashes: [String(result.manifestHash)],
    };
  }
}

export function validateFixture(raw: unknown): IPlatformFixture {
  const f = objectValue(raw);

  if (f.version !== 1 || !Array.isArray(f.setup) || f.setup.length > 10000
    || !Array.isArray(f.actions)
    || f.actions.length < 1
    || f.actions.length > 10000
    || Object.keys(f).some(k => !['version', 'setup', 'actions', 'auditActor'].includes(k))) {
    throw new Error('Invalid synthetic fixture');
  }

  const action = (rawAction: unknown, publicOnly: boolean): IHttpAction => {
    const a = objectValue(rawAction);

    if (a.method !== 'GET' && a.method !== 'POST' && a.method !== 'PATCH' || typeof a.path !== 'string'
      || !(publicOnly ? /^\/v1\// : /^\/(?:internal\/)?v1\//).test(a.path)
      || Object.keys(a).some(k => !['method', 'path', 'body', 'actor'].includes(k))) {
      throw new Error('Invalid fixture action');
    }

    const actor = objectValue(a.actor);

    if (typeof actor.operatorId !== 'string' || typeof actor.actorId !== 'string'
      || typeof actor.actorKind !== 'string'
      || !Array.isArray(actor.capabilities)
      || !actor.capabilities.every((c: unknown): c is string => typeof c === 'string')
      || actor.playerId !== undefined && typeof actor.playerId !== 'string'
      || Object.keys(actor).some(
        k => !['operatorId', 'actorId', 'actorKind', 'capabilities', 'playerId'].includes(k),
      )) {
      throw new Error('Invalid fixture actor');
    }

    return {
      method: a.method,
      path: a.path,
      ...(a.body === undefined ? {} : { body: a.body }),
      actor: {
        operatorId: actor.operatorId,
        actorId: actor.actorId,
        actorKind: actor.actorKind,
        capabilities: actor.capabilities,
        ...(actor.playerId === undefined ? {} : { playerId: actor.playerId }),
      },
    };
  };
  const setup = f.setup.map(
    item => {
      const s = objectValue(item);

      if (!Object.values(ServiceName).some(service => service === s.service)
        || typeof s.service !== 'string'
        || typeof s.expectedStatus !== 'number'
        || !Number.isInteger(s.expectedStatus)
        || s.expectedStatus < 200
        || s.expectedStatus > 299
        || Object.keys(s).some(k => !['service', 'action', 'expectedStatus'].includes(k))) {
        throw new Error('Invalid setup command');
      }

      return { service: s.service, expectedStatus: s.expectedStatus, action: action(s.action, false) };
    },
  );
  const auditActor = action({ method: 'GET', path: '/v1/wallet', actor: f.auditActor }, true).actor;

  return { version: 1, setup, actions: f.actions.map(a => action(a, true)), auditActor };
}
