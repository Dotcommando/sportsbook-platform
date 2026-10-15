import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { readArtifact, runDirectory } from './artifacts.js';
import type { IOrmBenchResult, IReportArtifacts } from './experiment.model.js';
import { RunStatus } from './experiment.model.js';
import { confinedPath, digest } from './profile.js';

export interface IStatistics {
  count: number;
  mean: number;
  minimum: number;
  maximum: number;
  sampleStandardDeviation: number | null;
  coefficientOfVariationPercent: number | null;
}

export function statistics(values: readonly number[]): IStatistics {
  if (!values.length || values.some(value => !Number.isFinite(value))) {
    throw new Error('Finite nonempty samples required');
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation = values.length > 1
    ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1))
    : null;

  return {
    count: values.length,
    mean,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    sampleStandardDeviation: deviation,
    coefficientOfVariationPercent: deviation === null || mean === 0 ? null : deviation / Math.abs(mean) * 100,
  };
}

export function writeOrmReport(root: string, results: readonly IOrmBenchResult[]): IReportArtifacts {
  if (!results.length || new Set(results.map(result => result.runId)).size !== results.length) {
    throw new Error('Unique measured runs required');
  }

  const sourceHashes = new Set<string>();
  const buildHashes = new Set<string>();
  const controls = new Set<string>();
  const grouped = new Map<string, IOrmBenchResult[]>();
  const diagnostics = new Map<string, string[]>();

  for (const result of results) {
    const directory = runDirectory(root, result.runId);
    const saved = readArtifact(directory, 'result.json');
    const rawManifest = readArtifact(directory, 'manifest.json');

    if (digest(saved) !== digest(result) || rawManifest === null || typeof rawManifest !== 'object') {
      throw new Error('Raw result mismatch');
    }

    const manifest = Object.fromEntries(Object.entries(rawManifest));

    if (digest(manifest) !== result.manifestHash || !Array.isArray(manifest.versions)) {
      throw new Error('Manifest mismatch');
    }

    for (const version of manifest.versions) {
      if (version === null || typeof version !== 'object') {
        throw new Error('Version metadata invalid');
      }

      const data = Object.fromEntries(Object.entries(version));

      if (typeof data.version !== 'string') {
        throw new Error('Version identity invalid');
      }
      if (data.component === 'source-tree-sha256') {
        sourceHashes.add(data.version);
      }
      if (data.component === 'compiled-worker-sha256') {
        buildHashes.add(data.version);
      }
    }
    const profile = manifest.profile;

    if (profile === null || typeof profile !== 'object') {
      throw new Error('Profile missing');
    }

    const configuration = Object.fromEntries(Object.entries(profile));
    const orm = configuration.orm;

    if (orm === null || typeof orm !== 'object') {
      throw new Error('ORM controls missing');
    }

    const settings = Object.fromEntries(
      Object.entries(orm).filter(([key]) => !['backend', 'lane', 'operation'].includes(key)),
    );

    controls.add(digest({ ...configuration, name: 'comparison', orm: settings, dimensions: [] }));
    const key = [result.backend, result.lane, result.operation].join(' / ');
    const group = grouped.get(key) ?? [];

    group.push(result);
    grouped.set(key, group);
    const diagnostic = readArtifact(directory, 'sql-diagnostic.json');

    if (diagnostic !== null && typeof diagnostic === 'object' && 'queries' in diagnostic
      && Array.isArray(diagnostic.queries)) {
      diagnostics.set(
        key,
        diagnostic.queries.map(
          query =>
            query !== null && typeof query === 'object' && 'sql' in query
              ? String(query.sql)
              : 'Malformed query',
        ),
      );
    }
  }
  const summaries = [...grouped].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(
    ([configuration, runs]) => {
      const valid = runs.filter(run => run.status === RunStatus.VALID && run.dataAudit.status === 'PASS');

      return {
        configuration,
        valid: valid.length,
        invalid: runs.length - valid.length,
        throughput: valid.length ? statistics(valid.map(run => run.measurements.throughputPerSecond)) : null,
        p99: valid.length ? statistics(valid.map(run => run.measurements.latency.p99)) : null,
        runIds: runs.map(run => run.runId),
      };
    },
  );
  const status = sourceHashes.size === 1 && buildHashes.size === 1 && controls.size === 1
    && summaries.every(group => group.valid >= 3 && group.invalid === 0)
    ? RunStatus.VALID
    : RunStatus.INVALID;
  const reports = path.join(root, 'reports');

  mkdirSync(reports, { recursive: true });
  const paths = ['orm-microbenchmark.md', 'orm-microbenchmark.json', 'orm-microbenchmark.csv'].map(
    name => confinedPath(reports, name, false),
  );
  const csv = [
    [
      'run_id',
      'backend',
      'lane',
      'operation',
      'status',
      'operations',
      'elapsed_s',
      'operations_s',
      'p50_ms',
      'p95_ms',
      'p99_ms',
      'cpu_user_us',
      'cpu_system_us',
      'heap_capacity_bytes',
      'heap_used_bytes',
      'heap_delta_bytes',
      'rss_bytes',
      'connections_at_start',
      'driver_query_calls',
      'audit_status',
      'violations',
    ].join(
      ',',
    ),
    ...results.map(
      run =>
        [
          run.runId,
          run.backend,
          run.lane,
          run.operation,
          run.status,
          run.measurements.operations,
          run.measurements.elapsedSeconds,
          run.measurements.throughputPerSecond,
          run.measurements.latency.p50,
          run.measurements.latency.p95,
          run.measurements.latency.p99,
          run.measurements.cpuUserMicros,
          run.measurements.cpuSystemMicros,
          run.measurements.heapAllocatedBytes,
          run.measurements.heapUsedBytes,
          run.measurements.heapDeltaBytes,
          run.measurements.rssBytes,
          run.measurements.connections,
          run.measurements.sqlRoundtrips,
          run.dataAudit.status,
          run.dataAudit.violations.join(';'),
        ].map(
          value => '"' + String(value).replaceAll('"', '""') + '"',
        ).join(
          ',',
        ),
    ),
  ].join(
    '\n',
  )
    + '\n';
  const number = (value: number | null | undefined): string => value == null ? 'unavailable' : value.toFixed(2);
  const text = [
    '# ORM microbenchmark',
    '',
    `Report status: ${status}. Samples: ${results.length}.`,
    '',
    'This report describes the local controls recorded in each manifest. Short samples are exploratory and do not establish a production capacity ranking. Platform financial TPS is a separate measurement.',
    '',
    `Source SHA256: ${[...sourceHashes].join(', ')}. Compiled worker SHA256: ${[...buildHashes].join(', ')}.`,
    '',
    '## Method',
    '',
    'Direct Node child workers use one selected adapter and the same SQL-first PostgreSQL schema and seeded data. Each run uses a new isolated database. Pool priming, diagnostics, fixture restore, schema checks and data audits are outside timing. Warmup is followed by fixture restore while the selected pool remains open. Node runtime, library/driver versions, hardware, database settings and effective controls are retained in per-run manifests. Correctness gates compare exact row/value totals, tenant ownership and logical references; foreign-key constraints remain absent.',
    '',
    'Throughput counts completed client operations per elapsed second, including the final drain. A batched insert is one operation and writes the configured batchSize rows. Latencies use approximately one-percent logarithmic histogram buckets. CPU is the measured worker process delta. Heap capacity is V8 total_heap_size; heap used/delta and RSS are separate values. Heap capacity is not cumulative allocation volume. Connections are actual open benchmark-role connections at measurement start after pool priming.',
    '',
    'SQL roundtrips are counted at the common pg.Client.query boundary, including transaction/session statements. This is a driver query-call count, not a measurement of individual TCP packet RTTs. Timed workers increment a counter without serializing SQL. Separate diagnostic workers record SQL/parameters and EXPLAIN (ANALYZE, BUFFERS); diagnostic writes are rolled back before fixture restore.',
    '',
    'The idiomatic lane uses each ORM normal APIs. pg is a native SQL baseline in both lanes. Prisma 7.10 uses adapter-pg; its FOR_UPDATE operation requires documented raw locking SQL within a Prisma transaction. The equivalent-SQL lane shares business SQL, while framework transaction setup can add statements. Generated SQL, returned columns, relation loading and query-call counts must be considered before attributing differences to driver overhead.',
    '',
    'Quantiles in the table are means of per-sample quantiles, not pooled quantiles. Standard deviation uses n-1 degrees of freedom. Every reported configuration requires at least three VALID samples; failed samples and incompatible source/build/control identities invalidate the report.',
    '',
    '## Samples',
    '',
    '| Backend / lane / operation | Valid / invalid | Mean operations/s | Sample SD | CV % | Mean p99 ms |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...summaries.map(
      group =>
        '| '
        + [
          group.configuration,
          group.valid + ' / ' + group.invalid,
          number(group.throughput?.mean),
          number(group.throughput?.sampleStandardDeviation),
          number(group.throughput?.coefficientOfVariationPercent),
          number(group.p99?.mean),
        ].join(
          ' | ',
        )
        + ' |',
    ),
    '',
    'CPU, memory, connection counts, p50/p95/p99 and exact per-run outcomes are in the accompanying CSV and JSON. Source manifests and query plans remain under experiments/results/<run_id>. Failed or incomplete controls are retained and never averaged into valid throughput.',
    '',
    '## Generated SQL',
    '',
    ...[...diagnostics].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).flatMap(
      ([configuration, queries]) => ['### ' + configuration, '', '```sql', ...queries, '```', ''],
    ),
  ].join(
    '\n',
  );
  const markdown = paths[0];
  const json = paths[1];
  const csvPath = paths[2];

  if (!markdown || !json || !csvPath) {
    throw new Error('Report paths missing');
  }
  writeFileSync(markdown, text, { mode: 0o600 });
  writeFileSync(
    json,
    JSON.stringify(
      {
        status,
        sourceHashes: [...sourceHashes],
        compiledWorkerHashes: [...buildHashes],
        controls: [...controls],
        summaries,
        results,
      },
      null,
      2,
    )
    + '\n',
    { mode: 0o600 },
  );
  writeFileSync(csvPath, csv, { mode: 0o600 });

  return {
    runId: results[0]?.runId ?? '',
    paths,
    summaryStatus: status,
    sourceHashes: [...sourceHashes],
  };
}
