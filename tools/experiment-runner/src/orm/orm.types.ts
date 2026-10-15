import type { IExperimentProfile, ILatencySummary, IOrmBenchMeasurements } from '../experiment.model.js';

export interface IOrmInvocation {
  operatorId: string;
  accountId: string;
  cursor: string;
  insertIds: readonly string[];
  pageSize: number;
  createdAt: Date;
}

export interface IQuerySample {
  sql: string;
  parameters: unknown[];
}

export interface IOrmOperation {
  execute(input: IOrmInvocation): Promise<void>;
  close(): Promise<void>;
  prime(): Promise<void>;
}

export interface ISqlSession {
  query(sql: string, parameters: readonly unknown[]): Promise<unknown>;
}

export interface ISqlConnection extends ISqlSession {
  transaction(work: (session: ISqlSession) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}

export interface IOrmWorkerInput {
  profile: IExperimentProfile;
  connectionString: string;
  operatorId: string;
  accountIds: string[];
  insertIds: string[];
  diagnostic: boolean;
}

export interface IOrmWorkerResult {
  measurements: IOrmBenchMeasurements;
  errors: {
    code: string;
    count: number;
  }[];
  queries: IQuerySample[];
  completed: number;
  latency: ILatencySummary;
}
