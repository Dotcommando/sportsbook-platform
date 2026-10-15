import 'reflect-metadata';

import type { EntityManager, QueryRunner } from 'typeorm';
import { DataSource, EntitySchema, MoreThan } from 'typeorm';

import { OrmLane, OrmOperation } from '../experiment.model.js';
import type { IOrmInvocation, IOrmOperation, IOrmWorkerInput, ISqlConnection, ISqlSession } from './orm.types.js';
import { sqlOperation } from './sql-operation.js';

interface IAccount {
  accountId: string;
  operatorId: string;
  value: string;
  createdAt: Date;
}

interface IEntry {
  entryId: string;
  operatorId: string;
  accountId: string;
  value: string;
}

const accounts = new EntitySchema<IAccount>(
  {
    name: 'BenchAccount',
    tableName: 'bench_accounts',
    columns: {
      accountId: { type: 'uuid', primary: true, name: 'account_id' },
      operatorId: { type: 'uuid', name: 'operator_id' },
      value: { type: 'bigint' },
      createdAt: { type: 'timestamptz', name: 'created_at' },
    },
  },
);

const entries = new EntitySchema<IEntry>(
  {
    name: 'BenchEntry',
    tableName: 'bench_entries',
    columns: {
      entryId: { type: 'uuid', primary: true, name: 'entry_id' },
      operatorId: { type: 'uuid', name: 'operator_id' },
      accountId: { type: 'uuid', name: 'account_id' },
      value: { type: 'bigint' },
    },
  },
);

async function query(runner: QueryRunner, sql: string, parameters: readonly unknown[]): Promise<unknown> {
  const result: unknown = await runner.query(sql, [...parameters], true);

  if (result === null || typeof result !== 'object' || !('records' in result)
    || !Array.isArray(result.records)) {
    throw new Error('TypeORM result unavailable');
  }

  return result.records;
}

function session(runner: QueryRunner): ISqlSession {
  return { query: (sql, args) => query(runner, sql, args) };
}

export async function createOperation(input: IOrmWorkerInput): Promise<IOrmOperation> {
  const settings = input.profile.orm;

  if (!settings) {
    throw new Error('ORM settings missing');
  }

  const source = new DataSource(
    {
      type: 'postgres',
      url: input.connectionString,
      entities: [accounts, entries],
      synchronize: false,
      migrationsRun: false,
      logging: false,
      extra: {
        max: settings.poolMax,
        connectionTimeoutMillis: 5000,
        application_name: 'sportsbook-orm-worker',
        options: '-c timezone=UTC -c statement_timeout=10000 -c lock_timeout=1000',
      },
    },
  );

  await source.initialize();
  const close = (): Promise<void> => source.destroy();

  if (settings.lane === OrmLane.EQUIVALENT_SQL) {
    const client: ISqlConnection = {
      query: async (sql, args) => {
        const runner = source.createQueryRunner();

        try {
          await runner.connect();

          return await query(runner, sql, args);
        } finally {
          await runner.release();
        }
      },
      transaction: work =>
        source.transaction(
          'READ COMMITTED',
          async (manager) => {
            if (!manager.queryRunner) {
              throw new Error('Transaction runner missing');
            }
            await work(session(manager.queryRunner));
          },
        ),
      close,
    };

    return {
      execute: sqlOperation(client, settings.operation, settings.batchSize),
      close,
      prime: async () => {
        await Promise.all(
          Array.from(
            { length: settings.poolMax },
            () => source.query('SELECT 1::int AS value FROM pg_sleep(0.01)'),
          ),
        );
      },
    };
  }

  const repository = source.getRepository(accounts);
  const insert = async (i: IOrmInvocation): Promise<void> => {
    const result = await repository.insert(
      i.insertIds.map(
        accountId => ({ accountId, operatorId: i.operatorId, value: '1000', createdAt: i.createdAt }),
      ),
    );

    if (result.identifiers.length !== i.insertIds.length) {
      throw new Error('TypeORM insertion mismatch');
    }
  };
  const update = async (manager: EntityManager, i: IOrmInvocation, lock: boolean): Promise<void> => {
    const repository = manager.getRepository(accounts);
    const row = lock
      ? await repository.createQueryBuilder('a').where({ operatorId: i.operatorId, accountId: i.accountId }).setLock(
        'pessimistic_write',
      ).getOne()
      : await repository.findOneBy({ operatorId: i.operatorId, accountId: i.accountId });

    if (!row) {
      throw new Error('TypeORM row missing');
    }

    const result = await repository.update(
      { operatorId: i.operatorId, accountId: i.accountId },
      { value: String(BigInt(row.value) + 1n) },
    );

    if (result.affected !== 1) {
      throw new Error('TypeORM scoped update mismatch');
    }
  };
  const operations: Record<OrmOperation, (i: IOrmInvocation) => Promise<void>> = {
    [OrmOperation.INSERT]: insert,
    [OrmOperation.BATCH_INSERT]: insert,
    [OrmOperation.LOOKUP]: async (i) => {
      const row = await repository.findOneBy({ operatorId: i.operatorId, accountId: i.accountId });

      if (row?.accountId !== i.accountId) {
        throw new Error('TypeORM lookup mismatch');
      }
    },
    [OrmOperation.PAGINATION]: async (i) => {
      const rows = await repository.find(
        {
          where: { operatorId: i.operatorId, accountId: MoreThan(i.cursor) },
          order: { accountId: 'ASC' },
          take: i.pageSize,
        },
      );

      if (rows.length !== i.pageSize) {
        throw new Error('TypeORM page mismatch');
      }
    },
    [OrmOperation.UPDATE]: async (i) => {
      const result = await repository.increment({ operatorId: i.operatorId, accountId: i.accountId }, 'value', 1);

      if (result.affected !== 1) {
        throw new Error('TypeORM update mismatch');
      }
    },
    [OrmOperation.JOIN]: async (i) => {
      const rows: unknown[] = await repository.createQueryBuilder('a').innerJoin(
        'BenchEntry',
        'e',
        'e.operatorId = a.operatorId AND e.accountId = a.accountId',
      ).select(
        ['a.accountId', 'a.operatorId', 'a.value', 'a.createdAt', 'e.entryId', 'e.value'],
      ).where(
        'a.operatorId = :operator AND a.accountId > :cursor',
        { operator: i.operatorId, cursor: i.cursor },
      ).orderBy(
        'a.accountId',
        'ASC',
      ).limit(
        i.pageSize,
      ).getRawMany();

      if (rows.length !== i.pageSize) {
        throw new Error('TypeORM join mismatch');
      }
    },
    [OrmOperation.READ_MODIFY_WRITE]: i => source.transaction('READ COMMITTED', manager => update(manager, i, false)),
    [OrmOperation.FOR_UPDATE]: i => source.transaction('READ COMMITTED', manager => update(manager, i, true)),
  };

  return {
    execute: operations[settings.operation],
    close,
    prime: async () => {
      await Promise.all(
        Array.from(
          { length: settings.poolMax },
          () => source.query('SELECT 1::int AS value FROM pg_sleep(0.01)'),
        ),
      );
    },
  };
}
