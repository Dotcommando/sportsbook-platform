import {PrismaPg} from '@prisma/adapter-pg';
import type {ITransactionalRuntime, ITransactionalSettings} from '@sportsbook/persistence';
import {createTransactionalRuntime, PersistenceBackend, TransactionFailure, TransactionIsolation} from '@sportsbook/persistence';

import * as M from '../../../domain/betting.model.js';
import {BettingError, requireRule, validInstant, validUuid} from '../../../domain/betting.policy.js';
import type {BetAuditStorePort, BetQueryPort, BetUnitOfWorkPort, ClockPort, IdGeneratorPort, OutboxDeliveryPort} from '../../../ports/outbound/betting.port.js';
import {BetOutboxDelivery} from './betting-outbox.js';
import {BetSqlStores} from './betting-stores.js';
import {BetSqlUnitOfWork} from './betting-unit-of-work.js';
import {PrismaClient} from './generated/prisma/client.js';

export interface IBettingPersistenceSettings extends ITransactionalSettings {retryAttempts:number;outboxLeaseMs:number;}

export interface IBettingPersistence {unitOfWork:BetUnitOfWorkPort;queries:BetQueryPort;audit:BetAuditStorePort;outbox:OutboxDeliveryPort;close():Promise<void>;}

export async function createBettingPersistence(settings:IBettingPersistenceSettings, operators:readonly M.IBettingOperatorSettings[], ids:IdGeneratorPort, clock:ClockPort):Promise<IBettingPersistence> {
  requireRule([PersistenceBackend.TypeOrm, PersistenceBackend.Prisma, PersistenceBackend.Sequelize].includes(settings.backend) && Number.isInteger(settings.retryAttempts) && settings.retryAttempts >= 1 && settings.retryAttempts <= 100 && Number.isInteger(settings.outboxLeaseMs) && settings.outboxLeaseMs >= 1 && settings.outboxLeaseMs <= 60000);
  requireRule(operators.length > 0 && new Set(operators.map(operator=>operator.operatorId)).size === operators.length);

  for (const operator of operators) {requireRule(validUuid(operator.operatorId) && operator.marketPeriod === M.MarketPeriod.NORMAL_TIME && operator.currencies.length > 0 && operator.currencies.every(currency=>/^[A-Z]{3}$/.test(currency)) && operator.trustedActors.length > 0);

for (const actor of operator.trustedActors)requireRule(validUuid(actor.actorId) && [M.ActorKind.SERVICE, M.ActorKind.SYSTEM].includes(actor.actorKind) && actor.capabilities.length > 0 && actor.capabilities.every(capability=>Object.values(M.Capability).includes(capability)));}
  const prisma = settings.backend === PersistenceBackend.Prisma ? new PrismaClient({adapter:new PrismaPg({connectionString:settings.connectionString, max:settings.poolMax, options:'-c timezone=UTC'})}) : undefined;let runtime:ITransactionalRuntime | undefined;

  try {
    runtime = await createTransactionalRuntime(settings, prisma);const active = runtime;

    await active.run(TransactionIsolation.READ_COMMITTED, async session=>{
      const rows = await session.query("SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,has_schema_privilege(current_user,'public','CREATE') AS ddl FROM pg_roles r WHERE rolname=current_user");const role = rows[0];

requireRule(role !== undefined && !role.rolsuper && !role.rolcreatedb && !role.rolcreaterole && !role.ddl);

      for (const operator of operators) {const commands = await session.query('SELECT request_id,stable_child_ids FROM bet_commands WHERE operator_id=$1 ORDER BY created_at DESC LIMIT 1', [operator.operatorId]);const row = commands[0];

if (row && typeof row.request_id === 'string' && Array.isArray(row.stable_child_ids)) for (const child of row.stable_child_ids) {if (child !== null && typeof child === 'object') {const fields = Object.fromEntries(Object.entries(child));

if (typeof fields.purpose === 'string' && typeof fields.id === 'string')requireRule(ids.derive(operator.operatorId, row.request_id, fields.purpose) === fields.id, M.ErrorCode.IDEMPOTENCY_CONFLICT);}}}
    });
    const read = async<T>(context:M.ICallContext, work:(stores:BetSqlStores)=>Promise<T>):Promise<T>=>{try {return await active.run(TransactionIsolation.READ_COMMITTED, async session=>{requireRule(validInstant(context.deadlineAt) && Date.parse(context.deadlineAt) > Date.parse(clock.now()), M.ErrorCode.DEADLINE_EXCEEDED);await session.query("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)", [String(Math.min(settings.statementTimeoutMs, Date.parse(context.deadlineAt) - Date.parse(clock.now()))), String(settings.lockTimeoutMs)]);

return work(new BetSqlStores(session, context, ids, clock));});} catch(error) {if (error instanceof TransactionFailure && error.original instanceof BettingError) throw error.original;throw error;}};

    return {unitOfWork:new BetSqlUnitOfWork(active, ids, clock, settings.retryAttempts, settings.statementTimeoutMs, settings.lockTimeoutMs), queries:{get:(context, ...args)=>read(context, stores=>stores.get(context, ...args)), list:(context, ...args)=>read(context, stores=>stores.list(context, ...args)), status:(context, ...args)=>read(context, stores=>stores.status(context, ...args)), listAuditCandidates:(context, ...args)=>read(context, stores=>stores.auditCandidates(context, ...args))}, audit:{record:(context, report)=>read(context, stores=>stores.audit(context, report))}, outbox:new BetOutboxDelivery(active, ids, clock, settings.outboxLeaseMs), close:()=>active.close()};
  } catch(error) {if (runtime) await runtime.close();else if (prisma) await prisma.$disconnect();throw error;}
}
