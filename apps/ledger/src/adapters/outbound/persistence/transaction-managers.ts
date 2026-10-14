import { PrismaPg } from '@prisma/adapter-pg';
import { Client, Pool } from 'pg';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';
import { DataSource } from 'typeorm';

import { PrismaClient } from './generated/prisma/client.js';
import type { IPoolMetrics, ISqlSession, ISqlTransactionManager, ITransactionMetrics, SqlParameter } from './sql-session.js';
import { emptyMetrics, object, rows, SqlIsolation, SqlTransactionFailure } from './sql-session.js';

export interface IConnectionSettings { connectionString: string; poolMax: number; acquisitionTimeoutMs: number; transactionTimeoutMs: number; }

function counted(query: (sql: string, parameters: readonly SqlParameter[]) => Promise<unknown>): { session: ISqlSession; close: () => void } {
  let active = true;

  return { session: { query: async (sql, parameters = []) => {
    if (!active) throw new Error('Transaction-bound store used after completion');

    return rows(await query(sql, parameters));
  } },
close: () => { active = false; } };
}

function observeClients(metrics: ITransactionMetrics): (client: Client) => void {
  const seen = new WeakSet<Client>();

  return client => {
    if (seen.has(client)) return;
    seen.add(client);
    client.query = new Proxy(client.query, { apply(target, receiver, argumentsList): unknown {
      metrics.queryRoundTrips++;

      return Reflect.apply(target, receiver, argumentsList);
    } });
  };
}

export class PgTransactionManager implements ISqlTransactionManager {
  readonly metrics = emptyMetrics();
  readonly pool: Pool;

  constructor(settings: IConnectionSettings) {
    this.pool = new Pool({ connectionString: settings.connectionString, max: settings.poolMax, connectionTimeoutMillis: settings.acquisitionTimeoutMs, options: '-c timezone=UTC' });
    this.pool.on('connect', observeClients(this.metrics));
  }

  async transaction<T>(isolation: SqlIsolation, work: (session: ISqlSession) => Promise<T>): Promise<T> {
    const start = performance.now();
    const client = await this.pool.connect();
    const binding = counted(async (sql, parameters) => (await client.query(sql, [...parameters])).rows);
    let commitStarted = false;
    let released = false;

    this.metrics.acquisitionMs += performance.now() - start;
    this.metrics.transactions++;

    try {
      await client.query('BEGIN ISOLATION LEVEL ' + isolation);
      const result = await work(binding.session);

      commitStarted = true;
      await client.query('COMMIT');
      this.metrics.commits++;

      return result;
    } catch (error) {
      this.metrics.rollbacks++;

      try { await client.query('ROLLBACK'); } catch { client.release(true); released = true; throw new SqlTransactionFailure(error, commitStarted); }
      throw new SqlTransactionFailure(error, commitStarted);
    } finally { binding.close();

 if (!released) client.release(); }
  }

  poolMetrics(): IPoolMetrics { return { active: this.pool.totalCount - this.pool.idleCount, idle: this.pool.idleCount, waiting: this.pool.waitingCount }; }

  close(): Promise<void> { return this.pool.end(); }
}

export class TypeOrmTransactionManager implements ISqlTransactionManager {
  readonly metrics = emptyMetrics();

  private constructor(readonly source: DataSource) {}

  static async create(settings: IConnectionSettings): Promise<TypeOrmTransactionManager> {
    const source = new DataSource({ type: 'postgres', url: settings.connectionString, entities: [], synchronize: false, migrationsRun: false, logging: false, extra: { max: settings.poolMax, connectionTimeoutMillis: settings.acquisitionTimeoutMs, options: '-c timezone=UTC' } });

    await source.initialize();
    const manager = new TypeOrmTransactionManager(source);
    const pool: unknown = object(source.driver).master;

    if (!(pool instanceof Pool)) { await source.destroy(); throw new Error('Unsupported TypeORM PostgreSQL pool'); }

    const observe = observeClients(manager.metrics);

    pool.on('connect', observe);
    const existing = await pool.connect();

    observe(existing);
    existing.release();

    return manager;
  }

  async transaction<T>(isolation: SqlIsolation, work: (session: ISqlSession) => Promise<T>): Promise<T> {
    const start = performance.now();
    let commitStarted = false;

    this.metrics.transactions++;

    try {
      const result = await this.source.transaction(isolation, async manager => {
        this.metrics.acquisitionMs += performance.now() - start;
        const runner = manager.queryRunner;

        if (!runner) throw new Error('Transaction-bound TypeORM query runner required');

        const binding = counted(async (sql, parameters) => {
          const result: unknown = await runner.query(sql, [...parameters], true);

          return object(result).records;
        });

        try { const value = await work(binding.session);

 commitStarted = true;

 return value; } finally { binding.close(); }
      });

      this.metrics.commits++;

      return result;
    } catch (error) { this.metrics.rollbacks++; throw new SqlTransactionFailure(error, commitStarted); }
  }

  poolMetrics(): IPoolMetrics {
    const driver = object(this.source.driver);

    if (driver.master === null || typeof driver.master !== 'object') return {};

    const total: unknown = Reflect.get(driver.master, 'totalCount');
    const idle: unknown = Reflect.get(driver.master, 'idleCount');
    const waiting: unknown = Reflect.get(driver.master, 'waitingCount');

    return typeof total === 'number' && typeof idle === 'number' && typeof waiting === 'number' ? { active: total - idle, idle, waiting } : {};
  }

  close(): Promise<void> { return this.source.destroy(); }
}

export class SequelizeTransactionManager implements ISqlTransactionManager {
  readonly metrics = emptyMetrics();
  readonly client: Sequelize;

  constructor(settings: IConnectionSettings) {
    this.client = new Sequelize(settings.connectionString, { dialect: 'postgres', logging: false, timezone: '+00:00', pool: { min: 0, max: settings.poolMax, acquire: settings.acquisitionTimeoutMs } });
    const observe = observeClients(this.metrics);

    this.client.addHook('afterConnect', (connection: unknown): void => {
      if (!(connection instanceof Client)) throw new Error('Unsupported Sequelize PostgreSQL connection');
      observe(connection);
    });
  }

  async transaction<T>(isolation: SqlIsolation, work: (session: ISqlSession) => Promise<T>): Promise<T> {
    const start = performance.now();
    let commitStarted = false;
    const level = isolation === SqlIsolation.SERIALIZABLE ? Transaction.ISOLATION_LEVELS.SERIALIZABLE : isolation === SqlIsolation.REPEATABLE_READ ? Transaction.ISOLATION_LEVELS.REPEATABLE_READ : Transaction.ISOLATION_LEVELS.READ_COMMITTED;

    this.metrics.transactions++;

    try {
      const result = await this.client.transaction({ isolationLevel: level }, async transaction => {
        this.metrics.acquisitionMs += performance.now() - start;
        const binding = counted((sql, parameters) => this.client.query(sql, { bind: [...parameters], transaction, type: QueryTypes.SELECT }));

        try { const value = await work(binding.session);

 commitStarted = true;

 return value; } finally { binding.close(); }
      });

      this.metrics.commits++;

      return result;
    } catch (error) { this.metrics.rollbacks++; throw new SqlTransactionFailure(error, commitStarted); }
  }

  poolMetrics(): IPoolMetrics {
    const manager = object(this.client.connectionManager);

    if (manager.pool === null || typeof manager.pool !== 'object') return {};

    const active: unknown = Reflect.get(manager.pool, 'using');
    const idle: unknown = Reflect.get(manager.pool, 'available');
    const waiting: unknown = Reflect.get(manager.pool, 'waiting');

    return typeof active === 'number' && typeof idle === 'number' && typeof waiting === 'number' ? { active, idle, waiting } : {};
  }

  async close(): Promise<void> { await this.client.close(); }
}

export class PrismaTransactionManager implements ISqlTransactionManager {
  readonly metrics = emptyMetrics();
  readonly pool: Pool;
  readonly client: PrismaClient;

  constructor(private readonly settings: IConnectionSettings) {
    this.pool = new Pool({ connectionString: settings.connectionString, max: settings.poolMax, connectionTimeoutMillis: settings.acquisitionTimeoutMs, options: '-c timezone=UTC' });
    this.pool.on('connect', observeClients(this.metrics));
    this.client = new PrismaClient({ adapter: new PrismaPg(this.pool) });
  }

  async transaction<T>(isolation: SqlIsolation, work: (session: ISqlSession) => Promise<T>): Promise<T> {
    const start = performance.now();
    let commitStarted = false;
    const level = isolation === SqlIsolation.SERIALIZABLE ? 'Serializable' : isolation === SqlIsolation.REPEATABLE_READ ? 'RepeatableRead' : 'ReadCommitted';

    this.metrics.transactions++;

    try {
      const result = await this.client.$transaction(async transaction => {
        this.metrics.acquisitionMs += performance.now() - start;
        const binding = counted((sql, parameters) => transaction.$queryRawUnsafe(sql, ...parameters));

        try { const value = await work(binding.session);

 commitStarted = true;

 return value; } finally { binding.close(); }
      }, { isolationLevel: level, maxWait: this.settings.acquisitionTimeoutMs, timeout: this.settings.transactionTimeoutMs });

      this.metrics.commits++;

      return result;
    } catch (error) { this.metrics.rollbacks++; throw new SqlTransactionFailure(error, commitStarted); }
  }

  poolMetrics(): IPoolMetrics { return { active: this.pool.totalCount - this.pool.idleCount, idle: this.pool.idleCount, waiting: this.pool.waitingCount }; }

  async close(): Promise<void> { try { await this.client.$disconnect(); } finally { await this.pool.end(); } }
}
