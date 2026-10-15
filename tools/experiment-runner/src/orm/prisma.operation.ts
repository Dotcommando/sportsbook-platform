import { PrismaPg } from '@prisma/adapter-pg';

import { OrmLane, OrmOperation } from '../experiment.model.js';
import { PrismaClient } from './generated/prisma/client.js';
import type { IOrmInvocation, IOrmOperation, IOrmWorkerInput, ISqlConnection } from './orm.types.js';
import { sqlOperation } from './sql-operation.js';

export async function createOperation(input: IOrmWorkerInput): Promise<IOrmOperation> {
  const settings = input.profile.orm;

  if (!settings) {
    throw new Error('ORM settings missing');
  }

  const client = new PrismaClient(
    {
      adapter: new PrismaPg(
        {
          connectionString: input.connectionString,
          max: settings.poolMax,
          connectionTimeoutMillis: 5000,
          application_name: 'sportsbook-orm-worker',
          options: '-c timezone=UTC -c statement_timeout=10000 -c lock_timeout=1000',
        },
      ),
      log: [],
    },
  );

  await client.$connect();
  const close = (): Promise<void> => client.$disconnect();

  if (settings.lane === OrmLane.EQUIVALENT_SQL) {
    const connection: ISqlConnection = {
      query: (sql, args) => client.$queryRawUnsafe(sql, ...args),
      transaction: work =>
        client.$transaction(
          tx => work({ query: (sql, args) => tx.$queryRawUnsafe(sql, ...args) }),
          { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 },
        ),
      close,
    };

    return {
      execute: sqlOperation(connection, settings.operation, settings.batchSize),
      close,
      prime: async () => {
        await Promise.all(
          Array.from(
            { length: settings.poolMax },
            () => client.$queryRawUnsafe('SELECT 1::int AS value FROM pg_sleep(0.01)'),
          ),
        );
      },
    };
  }

  const where = (i: IOrmInvocation): {
    operatorId: string;
    accountId: string;
  } =>
    ({ operatorId: i.operatorId, accountId: i.accountId });
  const insert = async (i: IOrmInvocation): Promise<void> => {
    const result = await client.benchAccount.createMany(
      {
        data: i.insertIds.map(
          accountId => ({ accountId, operatorId: i.operatorId, value: 1000n, createdAt: i.createdAt }),
        ),
      },
    );

    if (result.count !== i.insertIds.length) {
      throw new Error('Prisma insertion mismatch');
    }
  };
  const update = async (i: IOrmInvocation, lock: boolean): Promise<void> => {
    await client.$transaction(
      async (tx) => {
        let value: bigint;

        if (lock) {
          const rows = await tx.$queryRawUnsafe<{
            value: bigint;
          }[]>(
            'SELECT value FROM bench_accounts WHERE operator_id=$1::uuid AND account_id=$2::uuid FOR UPDATE',
            i.operatorId,
            i.accountId,
          );
          const row = rows[0];

          if (!row) {
            throw new Error('Prisma locked row missing');
          }
          value = row.value;
        } else {
          const row = await tx.benchAccount.findUnique({ where: where(i) });

          if (!row) {
            throw new Error('Prisma row missing');
          }
          value = row.value;
        }
        await tx.benchAccount.update({ where: where(i), data: { value: value + 1n } });
      },
      { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 },
    );
  };
  const operations: Record<OrmOperation, (i: IOrmInvocation) => Promise<void>> = {
    [OrmOperation.INSERT]: async (i) => {
      await client.benchAccount.create(
        {
          data: {
            accountId: i.insertIds[0] ?? '',
            operatorId: i.operatorId,
            value: 1000n,
            createdAt: i.createdAt,
          },
        },
      );
    },
    [OrmOperation.BATCH_INSERT]: insert,
    [OrmOperation.LOOKUP]: async (i) => {
      const row = await client.benchAccount.findUnique({ where: where(i) });

      if (row?.accountId !== i.accountId) {
        throw new Error('Prisma lookup mismatch');
      }
    },
    [OrmOperation.PAGINATION]: async (i) => {
      const rows = await client.benchAccount.findMany(
        {
          where: { operatorId: i.operatorId, accountId: { gt: i.cursor } },
          orderBy: { accountId: 'asc' },
          take: i.pageSize,
        },
      );

      if (rows.length !== i.pageSize) {
        throw new Error('Prisma page mismatch');
      }
    },
    [OrmOperation.UPDATE]: async (i) => {
      await client.benchAccount.update({ where: where(i), data: { value: { increment: 1n } } });
    },
    [OrmOperation.JOIN]: async (i) => {
      const rows = await client.benchAccount.findMany(
        {
          where: { operatorId: i.operatorId, accountId: { gt: i.cursor } },
          orderBy: { accountId: 'asc' },
          take: i.pageSize,
          include: { entries: true },
        },
      );

      if (rows.length !== i.pageSize
        || rows.some(row => row.entries.length !== 1 || row.entries[0]?.operatorId !== i.operatorId)) {
        throw new Error('Prisma join mismatch');
      }
    },
    [OrmOperation.READ_MODIFY_WRITE]: i => update(i, false),
    [OrmOperation.FOR_UPDATE]: i => update(i, true),
  };

  return {
    execute: operations[settings.operation],
    close,
    prime: async () => {
      await Promise.all(
        Array.from(
          { length: settings.poolMax },
          () => client.$queryRawUnsafe('SELECT 1::int AS value FROM pg_sleep(0.01)'),
        ),
      );
    },
  };
}
