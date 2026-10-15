import 'reflect-metadata';

import { Pool } from 'pg';
import { DataTypes, Sequelize } from 'sequelize';
import type { EntitySchemaColumnOptions } from 'typeorm';
import { DataSource, EntitySchema } from 'typeorm';

import type { ISchemaManifest } from './schema.types.js';

export enum PersistenceBackend {
  Pg = 'PG'
  ,
  TypeOrm = 'TYPEORM'
  ,
  Prisma = 'PRISMA'
  ,
  Sequelize = 'SEQUELIZE'
  ,
}

export interface IRuntimeSettings {
  connectionString: string;
  backend: PersistenceBackend;
  poolMax: number;
}

export interface IPrismaRuntime {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRawUnsafe(query: string): Promise<unknown>;
}

export interface IPersistenceRuntime {
  query(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

function validateSettings(settings: IRuntimeSettings): void {
  const url = new URL(settings.connectionString);

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('Explicit PostgreSQL endpoint/database required');
  }
  if (!Number.isSafeInteger(settings.poolMax) || settings.poolMax < 1) {
    throw new Error('Invalid pool size');
  }
  if (!Object.values(PersistenceBackend).includes(settings.backend)) {
    throw new Error('Unsupported persistence backend');
  }
}

export async function createPersistenceRuntime(
  settings: IRuntimeSettings,
  manifest: ISchemaManifest,
  prisma?: IPrismaRuntime,
): Promise<IPersistenceRuntime> {
  validateSettings(settings);
  const supportedTypes = new Set(
    [
      'uuid',
      'text',
      'bigint',
      'integer',
      'smallint',
      'boolean',
      'jsonb',
      'bytea',
      'timestamp with time zone',
      'character(3)',
      'character(2)',
      'numeric(18,8)',
    ],
  );

  for (const table of manifest.tables) {
    for (const column of table.columns) {
      if (!supportedTypes.has(column.type)) {
        throw new Error(`Unsupported column mapping: ${column.type}`);
      }
    }
  }

  if (manifest.service === 'events' && settings.backend !== PersistenceBackend.Pg) {
    throw new Error('Events persistence is fixed to pg');
  }

  switch (settings.backend) {
    case PersistenceBackend.Pg: {
      const pool = new Pool(
        {
          connectionString: settings.connectionString,
          max: settings.poolMax,
          options: '-c timezone=UTC',
        },
      );

      try {
        await pool.query('SELECT 1');
      } catch (error) {
        await pool.end();
        throw error;
      }

      return { query: async sql => (await pool.query(sql)).rows, close: () => pool.end() };
    }
    case PersistenceBackend.TypeOrm: {
      const entities = manifest.tables.map(
        table =>
          new EntitySchema(
            {
              name: table.name,
              tableName: table.name,
              columns: Object.fromEntries(
                table.columns.map(
                  column => {
                    const native = column.type === 'character(3)' || column.type === 'character(2)'
                      ? 'char'
                      : column.type === 'numeric(18,8)' ? 'numeric' : column.type;
                    const definition: EntitySchemaColumnOptions = {
                      type: native === 'timestamp with time zone'
                        ? 'timestamptz'
                        : native === 'bigint'
                          ? 'bigint'
                          : native === 'uuid'
                            ? 'uuid'
                            : native === 'integer'
                              ? 'integer'
                              : native === 'smallint'
                                ? 'smallint'
                                : native === 'boolean'
                                  ? 'boolean'
                                  : native === 'jsonb'
                                    ? 'jsonb'
                                    : native === 'bytea'
                                      ? 'bytea'
                                      : native === 'numeric' ? 'numeric' : native === 'char' ? 'char' : 'text',
                      name: column.name,
                      primary: column.primary,
                      nullable: column.nullable,
                      ...(native === 'char' ? { length: column.type === 'character(3)' ? 3 : 2 } : {}),
                      ...(native === 'numeric' ? { precision: 18, scale: 8 } : {}),
                    };

                    return [column.name, definition];
                  },
                ),
              ),
            },
          ),
      );
      const source = new DataSource(
        {
          type: 'postgres',
          url: settings.connectionString,
          entities,
          synchronize: false,
          migrationsRun: false,
          logging: false,
          extra: { max: settings.poolMax, options: '-c timezone=UTC' },
        },
      );

      await source.initialize();

      return { query: sql => source.query(sql), close: () => source.destroy() };
    }
    case PersistenceBackend.Sequelize: {
      const sequelize = new Sequelize(
        settings.connectionString,
        {
          dialect: 'postgres',
          logging: false,
          pool: { max: settings.poolMax, min: 0 },
          timezone: '+00:00',
        },
      );

      for (const table of manifest.tables) {
        sequelize.define(
          table.name,
          Object.fromEntries(
            table.columns.map(
              column =>
                [
                  column.name,
                  {
                    type: column.type === 'uuid'
                      ? DataTypes.UUID
                      : column.type === 'bigint'
                        ? DataTypes.BIGINT
                        : column.type === 'integer'
                          ? DataTypes.INTEGER
                          : column.type === 'smallint'
                            ? DataTypes.SMALLINT
                            : column.type === 'boolean'
                              ? DataTypes.BOOLEAN
                              : column.type === 'jsonb'
                                ? DataTypes.JSONB
                                : column.type === 'bytea'
                                  ? DataTypes.BLOB
                                  : column.type === 'timestamp with time zone'
                                    ? DataTypes.DATE
                                    : column.type === 'numeric(18,8)'
                                      ? DataTypes.DECIMAL(18, 8)
                                      : column.type.startsWith('character')
                                        ? DataTypes.CHAR(column.type === 'character(3)' ? 3 : 2)
                                        : DataTypes.TEXT,
                    field: column.name,
                    primaryKey: column.primary,
                    allowNull: column.nullable,
                  },
                ],
            ),
          ),
          { tableName: table.name, timestamps: false, freezeTableName: true },
        );
      }

      try {
        await sequelize.authenticate();
      } catch (error) {
        await sequelize.close();
        throw error;
      }

      return { query: sql => sequelize.query(sql), close: () => sequelize.close() };
    }
    case PersistenceBackend.Prisma: {
      if (!prisma) {
        throw new Error('Configured service-owned Prisma client required');
      }

      try {
        await prisma.$connect();
      } catch (error) {
        await prisma.$disconnect();
        throw error;
      }

      return { query: sql => prisma.$queryRawUnsafe(sql), close: () => prisma.$disconnect() };
    }
  }
}
