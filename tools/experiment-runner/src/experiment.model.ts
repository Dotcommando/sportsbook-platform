import type { PersistenceBackend } from '@sportsbook/persistence';
import type { ServiceProtocol } from '@sportsbook/service-transport';

export enum ExperimentKind {
  PLATFORM = 'PLATFORM',
  ORM = 'ORM',
}

export enum ServiceName {
  GATEWAY = 'api-gateway',
  LEDGER = 'ledger',
  PLAYER = 'player',
  BETTING = 'betting',
  EVENTS = 'event-simulator',
}

export enum ConcurrencyStrategy {
  CONDITIONAL = 'rc_conditional',
  FOR_UPDATE = 'rc_for_update',
  SERIALIZABLE = 'serializable',
}

export enum Scenario {
  CONTROL = 'CONTROL',
  LIVE_FOOTBALL = 'LIVE_FOOTBALL',
  ORM = 'ORM',
}

export enum LoadMode {
  OPEN_LOOP = 'OPEN_LOOP',
  CLOSED_LOOP = 'CLOSED_LOOP',
}

export enum DeviceKind {
  LOCAL = 'LOCAL',
  REMOTE = 'REMOTE',
}

export enum RunStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
}

export enum AuditStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
}

export enum OrmLane {
  IDIOMATIC = 'IDIOMATIC',
  EQUIVALENT_SQL = 'EQUIVALENT_SQL',
}

export enum OrmOperation {
  INSERT = 'INSERT',
  BATCH_INSERT = 'BATCH_INSERT',
  LOOKUP = 'LOOKUP',
  PAGINATION = 'PAGINATION',
  UPDATE = 'UPDATE',
  JOIN = 'JOIN',
  READ_MODIFY_WRITE = 'READ_MODIFY_WRITE',
  FOR_UPDATE = 'FOR_UPDATE',
}

export enum DimensionKind {
  BACKEND = 'BACKEND',
  CONCURRENCY = 'CONCURRENCY',
  POOL = 'POOL',
  REPLICAS = 'REPLICAS',
  TRANSPORT = 'TRANSPORT',
  LANE = 'LANE',
  OPERATION = 'OPERATION',
}

export interface IServiceResourceConfig {
  service: ServiceName;
  replicas: number;
  cpu: number;
  memoryMb: number;
  configuration: string;
  database?: {
    backend: PersistenceBackend;
    poolMax: number;
    connectionBudget: number;
    concurrency?: ConcurrencyStrategy;
  };
}

export interface ICallEdge {
  from: ServiceName;
  to: ServiceName;
  protocol: ServiceProtocol;
}

export interface ILoadDevice {
  name: string;
  kind: DeviceKind;
  endpoint?: string;
}

export interface ILoadScenario {
  scenario: Scenario;
  mode: LoadMode;
  offeredRps?: number;
  concurrency?: number;
  warmupSeconds: number;
  durationSeconds: number;
  maxInFlight: number;
  devices: ILoadDevice[];
}

export interface IExperimentDimension {
  kind: DimensionKind;
  service?: ServiceName;
  edge?: {
    from: ServiceName;
    to: ServiceName;
  };
  values: string[];
}

export interface IOrmSettings {
  backend: PersistenceBackend;
  lane: OrmLane;
  operation: OrmOperation;
  poolMax: number;
  rows: number;
  batchSize: number;
  pageSize: number;
  maxOperations: number;
}

export interface IExperimentProfile {
  version: 1;
  name: string;
  kind: ExperimentKind;
  seed: string;
  repetitions: number;
  services: IServiceResourceConfig[];
  edges: ICallEdge[];
  workload: ILoadScenario;
  dimensions: IExperimentDimension[];
  fixture?: string;
  telemetry: {
    enabled: boolean;
    traceSampleRatio: number;
    intervalMs: number;
  };
  orm?: IOrmSettings;
}

export interface IVersion {
  component: string;
  version: string;
}

export interface IRunManifest {
  runId: string;
  profileHash: string;
  sourceRevision: string;
  versions: IVersion[];
  seed: string;
  effectiveTopology: IServiceResourceConfig[];
  startedAt: string;
  profile: IExperimentProfile;
  hardware: {
    platform: string;
    architecture: string;
    cpus: number;
    memoryBytes: string;
  };
  resources: {
    namespace: string;
    composeFile: string;
    project: string;
  };
}

export interface ILatencySummary {
  unit: 'milliseconds';
  count: number;
  p50: number;
  p95: number;
  p99: number;
  maximum: number;
}

export interface ILoadResult {
  offered: string;
  completed: string;
  businessRejected: string;
  technicalFailed: string;
  unknown: string;
  replayed: string;
  latencyHistogram: {
    boundsMs: number[];
    counts: number[];
  };
  latency: ILatencySummary;
  interval: {
    start: string;
    end: string;
  };
}

export interface IFinancialAudit {
  runId: string;
  snapshotAt: string;
  status: AuditStatus;
  counts: {
    transactions: string;
    entries: string;
    violations: string;
  };
  violations: {
    code: string;
    businessRef?: string;
  }[];
}

export interface IRunResult {
  runId: string;
  manifestHash: string;
  workload: ILoadResult;
  reconciliation: IFinancialAudit;
  telemetryRefs: string[];
  status: RunStatus;
}

export interface IOrmDataAudit {
  status: AuditStatus;
  expectedRows: string;
  actualRows: string;
  logicalOrphans: string;
  expectedValueTotal: string;
  actualValueTotal: string;
  violations: string[];
}

export interface IOrmBenchMeasurements {
  throughputPerSecond: number;
  latency: ILatencySummary;
  operations: string;
  cpuUserMicros: number;
  cpuSystemMicros: number;
  heapAllocatedBytes: number;
  heapUsedBytes: number;
  heapDeltaBytes: number;
  rssBytes: number;
  connections: number;
  sqlRoundtrips: string;
  elapsedSeconds: number;
}

export interface IOrmBenchResult {
  runId: string;
  manifestHash: string;
  backend: PersistenceBackend;
  lane: OrmLane;
  operation: OrmOperation;
  measurements: IOrmBenchMeasurements;
  dataAudit: IOrmDataAudit;
  telemetryRefs: string[];
  status: RunStatus;
}

export interface IReportArtifacts {
  runId: string;
  paths: string[];
  summaryStatus: RunStatus;
  sourceHashes: string[];
}
