import { Pool } from 'pg';

import type { IOrmOperation, IOrmWorkerInput, ISqlConnection } from './orm.types.js';
import { sqlOperation } from './sql-operation.js';

export async function createOperation(input: IOrmWorkerInput): Promise<IOrmOperation> {
  const settings = input.profile.orm;

  if (!settings) {
    throw new Error('ORM settings missing');
  }

  const pool = new Pool(
    {
      connectionString: input.connectionString,
      max: settings.poolMax,
      connectionTimeoutMillis: 5000,
      application_name: 'sportsbook-orm-worker',
      options: '-c timezone=UTC -c statement_timeout=10000 -c lock_timeout=1000',
    },
  );
  const client: ISqlConnection = {
    query: async (sql, parameters) => (await pool.query(sql, [...parameters])).rows,
    transaction: async (work) => {
      const connection = await pool.connect();

      try {
        await connection.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        await work({ query: async (sql, parameters) => (await connection.query(sql, [...parameters])).rows });
        await connection.query('COMMIT');
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally {
        connection.release();
      }
    },
    close: () => pool.end(),
  };

  await pool.query('SELECT 1');

  return {
    execute: sqlOperation(client, settings.operation, settings.batchSize),
    close: client.close,
    prime: async () => {
      await Promise.all(
        Array.from(
          { length: settings.poolMax },
          () => pool.query('SELECT 1::int AS value FROM pg_sleep(0.01)'),
        ),
      );
    },
  };
}
