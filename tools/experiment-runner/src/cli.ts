import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseSettingsJson } from '@sportsbook/runtime-settings';
import { objectValue } from '@sportsbook/service-transport';

import type { IOrmBenchResult } from './experiment.model.js';
import { ServiceName } from './experiment.model.js';
import { ExperimentKind, RunStatus } from './experiment.model.js';
import { writeOrmReport } from './orm-report.js';
import { OrmMicrobenchRunner } from './orm-runner.js';
import { confinedPath } from './profile.js';
import { resolveMatrix } from './profile.js';
import { reconcile } from './reconcile.js';
import { ExperimentRunner } from './runner.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

async function main(): Promise<void> {
  const [command, value, ...extra] = process.argv.slice(2);

  if (extra.length || !value || !['run', 'matrix', 'report', 'audit'].includes(command ?? '')) {
    throw new Error('Usage: bench run <profile> | matrix <profile> | report <run_uuid> | audit <settings.json>');
  }
  if (command === 'audit') {
    const settings = objectValue(parseSettingsJson(readFileSync(confinedPath(root, value), 'utf8')));

    if (Object.keys(settings).some(key => !['runId', 'ledgerUrl', 'bettingUrl', 'writersStopped'].includes(key))
      || typeof settings.runId !== 'string'
      || !/^[a-f0-9-]{36}$/.test(settings.runId)
      || typeof settings.ledgerUrl !== 'string'
      || typeof settings.bettingUrl !== 'string'
      || settings.writersStopped !== true) {
      throw new Error('Explicit audit databases and stopped-writer attestation required');
    }

    const audit = await reconcile({
      manifest: { runId: settings.runId },
      databaseUrls: new Map([[ServiceName.LEDGER, settings.ledgerUrl], [ServiceName.BETTING, settings.bettingUrl]]),
    });

    console.log(JSON.stringify(audit));

    if (audit.status !== 'PASS') {
      process.exitCode = 1;
    }

    return;
  }

  const runner = new ExperimentRunner(root);

  if (command === 'report') {
    console.log(JSON.stringify(runner.report(value)));

    return;
  }

  const profile = runner.loadProfile(value);

  if (profile.kind === ExperimentKind.ORM) {
    const orm = new OrmMicrobenchRunner(root);

    try {
      if (command !== 'matrix' && profile.dimensions.length) {
        throw new Error('Use matrix for a declared series');
      }

      const ids: {
        runId: string;
        status: RunStatus;
      }[] = [];
      const measured: IOrmBenchResult[] = [];

      for (const point of command === 'matrix' ? resolveMatrix(profile) : [profile]) {
        for (let sample = 0; sample < (command === 'matrix' ? point.repetitions : 1); sample++) {
          const result = await orm.run(point);

          ids.push({ runId: result.runId, status: result.status });
          measured.push(result);
        }
      }

      if (command === 'matrix') {
        const report = writeOrmReport(root, measured);

        if (report.summaryStatus === RunStatus.INVALID) {
          process.exitCode = 1;
        }
      }
      console.log(JSON.stringify(ids));

      if (ids.some(result => result.status === RunStatus.INVALID)) {
        process.exitCode = 1;
      }
    } finally {
      await orm.close();
    }

    return;
  }
  if (command === 'matrix') {
    const results = await runner.runMatrix(profile);

    console.log(JSON.stringify(results.map(r => ({ runId: r.runId, status: r.status }))));

    if (results.some(r => r.status === RunStatus.INVALID)) {
      process.exitCode = 1;
    }
  } else {
    if (profile.dimensions.length) {
      throw new Error('Use matrix for a declared series');
    }

    const manifest = await runner.prepare(profile, randomUUID());
    const result = await runner.run(manifest);

    console.log(JSON.stringify({ runId: result.runId, status: result.status }));

    if (result.status === RunStatus.INVALID) {
      process.exitCode = 1;
    }
  }
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Experiment failed');
  process.exitCode = 1;
});
