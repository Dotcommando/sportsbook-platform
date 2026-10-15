import { DataTypes, literal, Model, Op, QueryTypes, Sequelize, Transaction } from 'sequelize';

import { OrmLane, OrmOperation } from '../experiment.model.js';
import type { IOrmInvocation, IOrmOperation, IOrmWorkerInput, ISqlConnection } from './orm.types.js';
import { sqlOperation } from './sql-operation.js';

interface IAccountAttributes {
  accountId: string;
  operatorId: string;
  value: string;
  createdAt: Date;
}

class Account extends Model<IAccountAttributes> {
  declare accountId: string;
  declare operatorId: string;
  declare value: string;
  declare createdAt: Date;
}

interface IEntryAttributes {
  entryId: string;
  operatorId: string;
  accountId: string;
  value: string;
}

class Entry extends Model<IEntryAttributes> {
  declare entryId: string;
  declare operatorId: string;
  declare accountId: string;
  declare value: string;
}

export async function createOperation(input: IOrmWorkerInput): Promise<IOrmOperation> {
  const settings = input.profile.orm;

  if (!settings) {
    throw new Error('ORM settings missing');
  }

  const client = new Sequelize(
    input.connectionString,
    {
      dialect: 'postgres',
      logging: false,
      timezone: '+00:00',
      pool: { min: 0, max: settings.poolMax, acquire: 5000 },
      dialectOptions: {
        application_name: 'sportsbook-orm-worker',
        options: '-c timezone=UTC -c statement_timeout=10000 -c lock_timeout=1000',
      },
    },
  );

  Account.init(
    {
      accountId: { type: DataTypes.UUID, primaryKey: true, field: 'account_id' },
      operatorId: { type: DataTypes.UUID, allowNull: false, field: 'operator_id' },
      value: { type: DataTypes.BIGINT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    },
    { sequelize: client, tableName: 'bench_accounts', timestamps: false },
  );
  Entry.init(
    {
      entryId: { type: DataTypes.UUID, primaryKey: true, field: 'entry_id' },
      operatorId: { type: DataTypes.UUID, allowNull: false, field: 'operator_id' },
      accountId: { type: DataTypes.UUID, allowNull: false, field: 'account_id' },
      value: { type: DataTypes.BIGINT, allowNull: false },
    },
    { sequelize: client, tableName: 'bench_entries', timestamps: false },
  );
  Account.hasMany(
    Entry,
    { foreignKey: 'accountId', sourceKey: 'accountId', as: 'entries', constraints: false },
  );
  await client.authenticate();
  const close = (): Promise<void> => client.close();

  if (settings.lane === OrmLane.EQUIVALENT_SQL) {
    const connection: ISqlConnection = {
      query: (sql, args) => client.query(sql, { bind: [...args], type: QueryTypes.SELECT }),
      transaction: work =>
        client.transaction(
          { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
          transaction =>
            work(
              {
                query: (sql, args) => client.query(sql, { bind: [...args], type: QueryTypes.SELECT, transaction }),
              },
            ),
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
            () => client.query('SELECT 1::int AS value FROM pg_sleep(0.01)'),
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
    const rows = await Account.bulkCreate(
      i.insertIds.map(
        accountId => ({ accountId, operatorId: i.operatorId, value: '1000', createdAt: i.createdAt }),
      ),
      { returning: true },
    );

    if (rows.length !== i.insertIds.length) {
      throw new Error('Sequelize insertion mismatch');
    }
  };
  const update = async (i: IOrmInvocation, lock: boolean): Promise<void> => {
    await client.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction) => {
        const row = await Account.findOne(
          { where: where(i), transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) },
        );

        if (!row) {
          throw new Error('Sequelize row missing');
        }

        const result = await Account.update(
          { value: String(BigInt(row.value) + 1n) },
          { where: where(i), transaction, returning: true },
        );

        if (result[0] !== 1) {
          throw new Error('Sequelize scoped update mismatch');
        }
      },
    );
  };
  const operations: Record<OrmOperation, (i: IOrmInvocation) => Promise<void>> = {
    [OrmOperation.INSERT]: async (i) => {
      await Account.create(
        {
          accountId: i.insertIds[0] ?? '',
          operatorId: i.operatorId,
          value: '1000',
          createdAt: i.createdAt,
        },
      );
    },
    [OrmOperation.BATCH_INSERT]: insert,
    [OrmOperation.LOOKUP]: async (i) => {
      const row = await Account.findOne({ where: where(i) });

      if (row?.accountId !== i.accountId) {
        throw new Error('Sequelize lookup mismatch');
      }
    },
    [OrmOperation.PAGINATION]: async (i) => {
      const rows = await Account.findAll(
        {
          where: { operatorId: i.operatorId, accountId: { [Op.gt]: i.cursor } },
          order: [['accountId', 'ASC']],
          limit: i.pageSize,
        },
      );

      if (rows.length !== i.pageSize) {
        throw new Error('Sequelize page mismatch');
      }
    },
    [OrmOperation.UPDATE]: async (i) => {
      const result = await Account.update({ value: literal('"value"+1') }, { where: where(i), returning: true });

      if (result[0] !== 1) {
        throw new Error('Sequelize update mismatch');
      }
    },
    [OrmOperation.JOIN]: async (i) => {
      const rows = await Account.findAll(
        {
          where: { operatorId: i.operatorId, accountId: { [Op.gt]: i.cursor } },
          include: [{ model: Entry, as: 'entries', required: true, where: { operatorId: i.operatorId } }],
          order: [['accountId', 'ASC']],
          limit: i.pageSize,
        },
      );

      if (rows.length !== i.pageSize) {
        throw new Error('Sequelize join mismatch');
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
          () => client.query('SELECT 1::int AS value FROM pg_sleep(0.01)'),
        ),
      );
    },
  };
}
