import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { Pool } from 'pg';

import { writeArtifact } from './artifacts.js';
import type { ComposeRun } from './compose.js';
import { executeTool } from './tool.js';

export async function startTelemetry(run: ComposeRun): Promise<{
  close(): Promise<string[]>;
}> {
  const samples: {
    at: string;
    metrics: string;
    errors: string[];
  }[] = [];
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = Promise.resolve();
  const pools = [...run.databaseUrls].map(
    ([owner, connectionString]) =>
      ({
        owner,
        pool: new Pool(
          {
            connectionString,
            max: 1,
            connectionTimeoutMillis: 2000,
            options: '-c statement_timeout=2000',
          },
        ),
      }),
  );
  const ids = (await run.command(['ps', '-q'])).split(/\s+/).filter(Boolean);

  if (!ids.length) {
    throw new Error('Owned telemetry targets required');
  }

  const tick = async (): Promise<void> => {
    const lines = ['sportsbook_telemetry_ready 1', 'sportsbook_wifi_retransmissions_available 0'];
    const errors: string[] = [];

    await Promise.all(
      pools.map(
        async ({ owner, pool }) => {
          try {
            const result = await pool.query<{
              read: string;
              hit: string;
              read_ms: string;
              write_ms: string;
              deadlocks: string;
              wal: string;
            }>(
              'SELECT blks_read::text AS read,blks_hit::text AS hit,blk_read_time::text AS read_ms,blk_write_time::text AS write_ms,deadlocks::text,(SELECT wal_bytes::text FROM pg_stat_wal) AS wal FROM pg_stat_database WHERE datname=current_database()',
            );
            const row = result.rows[0];

            if (!row) {
              throw new Error('Missing database statistics');
            }

            for (const [metric, value] of Object.entries(row)) {
              if (!/^\d+(\.\d+)?$/.test(value)) {
                throw new Error('Invalid database statistics');
              }
              lines.push(`sportsbook_database_${metric}{owner="${owner}"} ${value}`);
            }
          } catch {
            errors.push('DATABASE_STATS:' + owner);
          }
        },
      ),
    );

    try {
      const raw = await executeTool(
        'docker',
        ['stats', '--no-stream', '--format', '{{json .}}', ...ids],
        run.root,
        10000,
      );

      for (const text of raw.split('\n').filter(Boolean)) {
        const item: unknown = JSON.parse(text);

        if (item === null || typeof item !== 'object' || !('Name' in item) || typeof item.Name !== 'string'
          || !('CPUPerc' in item)
          || typeof item.CPUPerc !== 'string') {
          throw new Error('Invalid Docker statistics');
        }

        const cpu = Number(item.CPUPerc.replace('%', ''));

        if (!Number.isFinite(cpu) || !/^[-a-zA-Z0-9_]+$/.test(item.Name)) {
          throw new Error('Invalid CPU statistics');
        }
        lines.push(`sportsbook_container_cpu_percent{container="${item.Name}"} ${cpu}`);
      }
    } catch {
      errors.push('CONTAINER_STATS');
    }
    const metrics = lines.join('\n') + '\n';

    writeFileSync(path.join(run.directory, 'infrastructure.prom'), metrics, { mode: 0o600 });
    samples.push({ at: new Date().toISOString(), metrics, errors });
  };
  const schedule = (): void => {
    if (!stopped) {
      timer =
        setTimeout(
          () => {
            active = tick().finally(schedule);
            void active.catch(() => { });
          },
          run.manifest.profile.telemetry.intervalMs,
        );
    }
  };

  try {
    await tick();
    schedule();
  } catch (error) {
    await Promise.allSettled(pools.map(({ pool }) => pool.end()));
    throw error;
  }

  return {
    close: async () => {
      stopped = true;

      if (timer) {
        clearTimeout(timer);
      }

      try {
        await active;
        await tick();
        writeArtifact(
          run.directory,
          'telemetry.json',
          {
            samples,
            wifi: { available: false, reason: 'LOCAL generator has no instrumented radio interface' },
          },
        );

        return ['telemetry.json'];
      } finally {
        await Promise.allSettled(pools.map(({ pool }) => pool.end()));
      }
    },
  };
}
