import { Pool } from 'pg';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';
import { DataSource } from 'typeorm';

import { PersistenceBackend } from './runtime.factory.js';

export enum TransactionIsolation { READ_COMMITTED = 'READ COMMITTED', REPEATABLE_READ = 'REPEATABLE READ', SERIALIZABLE = 'SERIALIZABLE' }

export type SqlArgument = string | number | boolean | null;

export interface IQuerySession {query(sql:string, parameters?:readonly SqlArgument[]):Promise<Record<string, unknown>[]>;}

export interface ITransactionalSettings {backend:PersistenceBackend;connectionString:string;poolMax:number;replicaCount:number;connectionBudget:number;acquisitionTimeoutMs:number;transactionTimeoutMs:number;statementTimeoutMs:number;lockTimeoutMs:number;}

export interface ITransactionalRuntime {run<T>(isolation:TransactionIsolation, work:(session:IQuerySession)=>Promise<T>):Promise<T>;close():Promise<void>;}

export interface IPrismaQuerySession {$queryRawUnsafe(query:string, ...values:SqlArgument[]):Promise<unknown>;}

export interface ITransactionalPrisma {$transaction<T>(work:(transaction:IPrismaQuerySession)=>Promise<T>, options:{isolationLevel:'Serializable' | 'RepeatableRead' | 'ReadCommitted';maxWait:number;timeout:number}):Promise<T>; $disconnect():Promise<void>;}

export class TransactionFailure extends Error {constructor(readonly original:unknown, readonly commitStarted:boolean) {super('Transaction failed');}}

export function persistenceRecord(value:unknown):Record<string, unknown> {if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid row');

return Object.fromEntries(Object.entries(value));}

function rowSet(value:unknown):Record<string, unknown>[] {if (!Array.isArray(value)) throw new Error('Invalid row set');

return value.map(persistenceRecord);}

export async function createTransactionalRuntime(settings:ITransactionalSettings, prisma?:ITransactionalPrisma):Promise<ITransactionalRuntime> {
  const uri = new URL(settings.connectionString);

  if (!['postgres:', 'postgresql:'].includes(uri.protocol) || !uri.hostname || !uri.pathname.slice(1) || !Object.values(PersistenceBackend).includes(settings.backend)) throw new Error('Unsupported persistence configuration');
  if (![settings.poolMax, settings.replicaCount, settings.connectionBudget, settings.acquisitionTimeoutMs, settings.transactionTimeoutMs, settings.statementTimeoutMs, settings.lockTimeoutMs].every(value=>Number.isSafeInteger(value) && value > 0) || settings.poolMax * settings.replicaCount > settings.connectionBudget || settings.lockTimeoutMs > settings.statementTimeoutMs || settings.statementTimeoutMs > settings.transactionTimeoutMs) throw new Error('Invalid connection/timeout budget');

  let runNative:<T>(isolation:TransactionIsolation, work:(query:(sql:string, args:readonly SqlArgument[])=>Promise<unknown>)=>Promise<T>)=>Promise<T>;
  let close:()=>Promise<void>;

  if (settings.backend === PersistenceBackend.TypeOrm) {const source = new DataSource({type:'postgres', url:settings.connectionString, entities:[], synchronize:false, migrationsRun:false, logging:false, extra:{max:settings.poolMax, connectionTimeoutMillis:settings.acquisitionTimeoutMs, options:'-c timezone=UTC'}});

await source.initialize();close = ()=>source.destroy();runNative = (isolation, work)=>source.transaction(isolation, async manager=>{const runner = manager.queryRunner;

if (!runner) throw new Error('Missing transaction');

return work(async(sql, args)=>persistenceRecord(await runner.query(sql, [...args], true)).records);});}
  else if (settings.backend === PersistenceBackend.Sequelize) {const client = new Sequelize(settings.connectionString, {dialect:'postgres', logging:false, timezone:'+00:00', pool:{min:0, max:settings.poolMax, acquire:settings.acquisitionTimeoutMs}});

close = ()=>client.close();runNative = (isolation, work)=>client.transaction({isolationLevel:isolation === TransactionIsolation.SERIALIZABLE ? Transaction.ISOLATION_LEVELS.SERIALIZABLE : isolation === TransactionIsolation.REPEATABLE_READ ? Transaction.ISOLATION_LEVELS.REPEATABLE_READ : Transaction.ISOLATION_LEVELS.READ_COMMITTED}, transaction=>work((sql, args)=>client.query(sql, {bind:[...args], transaction, type:QueryTypes.SELECT})));}
  else if (settings.backend === PersistenceBackend.Prisma) {if (!prisma) throw new Error('Owning service Prisma client required');

const client = prisma;

close = ()=>client.$disconnect();runNative = (isolation, work)=>client.$transaction(transaction=>work((sql, args)=>transaction.$queryRawUnsafe(sql, ...args)), {isolationLevel:isolation === TransactionIsolation.SERIALIZABLE ? 'Serializable' : isolation === TransactionIsolation.REPEATABLE_READ ? 'RepeatableRead' : 'ReadCommitted', maxWait:settings.acquisitionTimeoutMs, timeout:settings.transactionTimeoutMs});}
  else {const pool = new Pool({connectionString:settings.connectionString, max:settings.poolMax, connectionTimeoutMillis:settings.acquisitionTimeoutMs, options:'-c timezone=UTC'});

close = ()=>pool.end();runNative = async(isolation, work)=>{const client = await pool.connect();let released = false;

try {await client.query('BEGIN ISOLATION LEVEL ' + isolation);const result = await work(async(sql, args)=>(await client.query(sql, [...args])).rows);

await client.query('COMMIT');

return result;} catch(error) {try {await client.query('ROLLBACK');} catch {client.release(true);released = true;throw error;} throw error;} finally {if (!released)client.release();}};}

  return {close,
run:async(isolation, work)=>{let active = true;let commitStarted = false;const started = Date.now();

try {return await runNative(isolation, async query=>{const session:IQuerySession = {query:async(sql, args = [])=>{if (!active) throw new Error('Expired transaction session');

return rowSet(await query(sql, args));}};

try {await session.query("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)", [String(settings.statementTimeoutMs), String(settings.lockTimeoutMs)]);const value = await work(session);

if (Date.now() - started > settings.transactionTimeoutMs) throw new Error('Transaction timeout');commitStarted = true;

return value;} finally {active = false;}});} catch(error) {throw new TransactionFailure(error, commitStarted);} finally {active = false;}}};
}
