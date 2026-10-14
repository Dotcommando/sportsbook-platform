export type SqlRow = Record<string, unknown>;

export type SqlParameter = string | number | boolean | null;

export enum SqlIsolation { READ_COMMITTED = 'READ COMMITTED', REPEATABLE_READ = 'REPEATABLE READ', SERIALIZABLE = 'SERIALIZABLE' }

export enum LedgerConcurrencyStrategy { CONDITIONAL = 'rc_conditional', FOR_UPDATE = 'rc_for_update', SERIALIZABLE = 'serializable' }

export interface ISqlSession { query(sql: string, parameters?: readonly SqlParameter[]): Promise<SqlRow[]>; }

export interface IPoolMetrics { active?: number; idle?: number; waiting?: number; }

export interface ITransactionMetrics {
  transactions: number;
commits: number;
rollbacks: number;
serializationRetries: number;
  deadlockRetries: number;
versionRetries: number;
queryRoundTrips: number;
  acquisitionMs: number;
lockCoordinationMs: number;
}

export interface ISqlTransactionManager {
  transaction<T>(isolation: SqlIsolation, work: (session: ISqlSession) => Promise<T>): Promise<T>;
  close(): Promise<void>;
poolMetrics(): IPoolMetrics;
  metrics: ITransactionMetrics;
}

export class SqlTransactionFailure extends Error {
  constructor(readonly original: unknown, readonly commitStarted: boolean) { super('Financial transaction failed'); }
}

export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid persistence object');

  return Object.fromEntries(Object.entries(value));
}

export function rows(value: unknown): SqlRow[] {
  if (!Array.isArray(value)) throw new Error('Invalid persistence row set');

  return value.map((row: unknown) => object(row));
}

export function sqlState(error: unknown): string | undefined {
  let current = error;
  const seen = new Set<unknown>();

  for (let depth = 0; depth < 12 && current !== null && typeof current === 'object' && !seen.has(current); depth++) {
    seen.add(current);
    const record = object(current);

    if (typeof record.code === 'string' && /^[0-9A-Z]{5}$/.test(record.code) && !record.code.startsWith('P')) return record.code;
    if (record.code === 'P2034') return '40001';
    if (typeof record.originalCode === 'string') return record.originalCode;
    if (record.meta !== null && typeof record.meta === 'object') {
      const metadata = object(record.meta);

      if (typeof metadata.code === 'string' && /^[0-9A-Z]{5}$/.test(metadata.code)) return metadata.code;
      if (metadata.driverAdapterError) { current = metadata.driverAdapterError; continue; }
    }
    current = record.original ?? record.driverError ?? record.parent ?? record.cause;
  }

  return undefined;
}

export function emptyMetrics(): ITransactionMetrics {
  return { transactions: 0, commits: 0, rollbacks: 0, serializationRetries: 0, deadlockRetries: 0, versionRetries: 0, queryRoundTrips: 0, acquisitionMs: 0, lockCoordinationMs: 0 };
}
