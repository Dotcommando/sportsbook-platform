import { PersistenceBackend } from '@sportsbook/persistence';

import { deriveChart } from '../../../domain/chart.policy.js';
import { MAX_INT64, validUuid } from '../../../domain/ledger.error.js';
import type { IOperatorFinancialPolicy } from '../../../domain/ledger.model.js';
import { ActorKind, Capability } from '../../../domain/ledger.model.js';
import type { ClockPort, FinancialQueryPort, FinancialUnitOfWorkPort, IdGeneratorPort, OutboxDeliveryPort, ReconciliationStorePort } from '../../../ports/outbound/financial.port.js';
import { SqlFinancialQuery } from './financial-query.js';
import type { IFinancialPersistenceResources, IRetrySettings } from './financial-unit-of-work.js';
import * as Writers from './ledger.writers.js';
import { SqlOutboxDelivery } from './outbox-delivery.js';
import { SqlReconciliationStore } from './reconciliation.js';
import type { IPoolMetrics, ISqlTransactionManager, ITransactionMetrics } from './sql-session.js';
import { LedgerConcurrencyStrategy, SqlIsolation } from './sql-session.js';
import type { IConnectionSettings } from './transaction-managers.js';
import { PgTransactionManager, PrismaTransactionManager, SequelizeTransactionManager, TypeOrmTransactionManager } from './transaction-managers.js';

export interface ILedgerPersistenceSettings extends IConnectionSettings {
  backend: PersistenceBackend;
strategy: LedgerConcurrencyStrategy;
replicaCount: number;
aggregateConnectionBudget: number;
  retry: IRetrySettings;
outboxLeaseMs: number;
jitter: () => number;
}

export interface ILedgerPersistence {
  unitOfWork: FinancialUnitOfWorkPort;
queries: FinancialQueryPort;
reconciliation: ReconciliationStorePort;
outbox: OutboxDeliveryPort;
  close(): Promise<void>;
metrics(): ITransactionMetrics & IPoolMetrics;
  databaseWaits(): Promise<{lockWaitingSessions:bigint}>;
}

const constructors: Record<PersistenceBackend, Record<LedgerConcurrencyStrategy, new (resources: IFinancialPersistenceResources) => FinancialUnitOfWorkPort>> = {
  [PersistenceBackend.Pg]: { [LedgerConcurrencyStrategy.CONDITIONAL]: Writers.PgConditionalWriter, [LedgerConcurrencyStrategy.FOR_UPDATE]: Writers.PgForUpdateWriter, [LedgerConcurrencyStrategy.SERIALIZABLE]: Writers.PgSerializableWriter },
  [PersistenceBackend.TypeOrm]: { [LedgerConcurrencyStrategy.CONDITIONAL]: Writers.TypeOrmConditionalWriter, [LedgerConcurrencyStrategy.FOR_UPDATE]: Writers.TypeOrmForUpdateWriter, [LedgerConcurrencyStrategy.SERIALIZABLE]: Writers.TypeOrmSerializableWriter },
  [PersistenceBackend.Prisma]: { [LedgerConcurrencyStrategy.CONDITIONAL]: Writers.PrismaConditionalWriter, [LedgerConcurrencyStrategy.FOR_UPDATE]: Writers.PrismaForUpdateWriter, [LedgerConcurrencyStrategy.SERIALIZABLE]: Writers.PrismaSerializableWriter },
  [PersistenceBackend.Sequelize]: { [LedgerConcurrencyStrategy.CONDITIONAL]: Writers.SequelizeConditionalWriter, [LedgerConcurrencyStrategy.FOR_UPDATE]: Writers.SequelizeForUpdateWriter, [LedgerConcurrencyStrategy.SERIALIZABLE]: Writers.SequelizeSerializableWriter },
};

export function validateLedgerPersistenceSettings(settings: ILedgerPersistenceSettings, policies: readonly IOperatorFinancialPolicy[]): void {
  const url = new URL(settings.connectionString);

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1) || !Object.values(PersistenceBackend).includes(settings.backend) || !Object.values(LedgerConcurrencyStrategy).includes(settings.strategy)) throw new Error('Unsupported Ledger persistence configuration');

  for (const value of [settings.poolMax, settings.replicaCount, settings.aggregateConnectionBudget, settings.acquisitionTimeoutMs, settings.transactionTimeoutMs, settings.retry.serializationAttempts, settings.retry.deadlockAttempts, settings.retry.versionAttempts, settings.retry.retryBaseMs, settings.retry.retryMaxMs, settings.retry.statementTimeoutMs, settings.retry.lockTimeoutMs, settings.outboxLeaseMs]) if (!Number.isSafeInteger(value) || value < 1) throw new Error('Positive finite Ledger resource setting required');

  if (settings.poolMax * settings.replicaCount > settings.aggregateConnectionBudget || settings.retry.retryBaseMs > settings.retry.retryMaxMs || settings.retry.retryMaxMs > 60000 || settings.retry.lockTimeoutMs > settings.retry.statementTimeoutMs || settings.retry.statementTimeoutMs > settings.transactionTimeoutMs || settings.outboxLeaseMs > 60000 || Math.max(settings.retry.serializationAttempts, settings.retry.deadlockAttempts, settings.retry.versionAttempts) > 1000 || typeof settings.jitter !== 'function') throw new Error('Invalid Ledger connection/retry budget');
  if (!policies.length || new Set(policies.map(policy => policy.operatorId)).size !== policies.length) throw new Error('Explicit unique operator financial policies required');

  for (const policy of policies) {
    if (!validUuid(policy.operatorId) || !policy.currencies.length || new Set(policy.currencies.map(currency => currency.currency)).size !== policy.currencies.length || !policy.providerNames.length || !policy.trustedActors.length) throw new Error('Incomplete operator financial policy');

    for (const currency of policy.currencies) if (!/^[A-Z]{3}$/.test(currency.currency) || currency.minimumMinor < 1n || currency.maximumMinor < currency.minimumMinor || currency.maximumMinor > MAX_INT64) throw new Error('Invalid currency amount policy');

    for (const provider of policy.providerNames) if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(provider)) throw new Error('Invalid trusted provider name');

    for (const reason of policy.rejectionReasons) if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(reason)) throw new Error('Invalid withdrawal reason policy');

    for (const actor of policy.trustedActors) {
      if (!validUuid(actor.actorId) || ![ActorKind.SYSTEM, ActorKind.SERVICE].includes(actor.actorKind) || !actor.capabilities.length || actor.capabilities.some(capability => !Object.values(Capability).includes(capability))) throw new Error('Invalid trusted actor policy');
      if (actor.capabilities.some(capability => capability === Capability.FUND_SYNTHETIC || capability === Capability.PAYMENT_SIMULATOR) && (!actor.providerName || !policy.providerNames.includes(actor.providerName))) throw new Error('Payment actor requires a configured provider binding');
    }
  }
}

export async function createFinancialPersistence(settings: ILedgerPersistenceSettings, ids: IdGeneratorPort, clock: ClockPort, policies: readonly IOperatorFinancialPolicy[]): Promise<ILedgerPersistence> {
  validateLedgerPersistenceSettings(settings, policies);
  let manager: ISqlTransactionManager;

  switch (settings.backend) {
    case PersistenceBackend.Pg: manager = new PgTransactionManager(settings); break;
    case PersistenceBackend.TypeOrm: manager = await TypeOrmTransactionManager.create(settings); break;
    case PersistenceBackend.Prisma: manager = new PrismaTransactionManager(settings); break;
    case PersistenceBackend.Sequelize: manager = new SequelizeTransactionManager(settings); break;
  }

  try {
    await manager.transaction(SqlIsolation.READ_COMMITTED, async session => {
      const permission = (await session.query(`SELECT has_schema_privilege(current_user,'public','CREATE') AS ddl,
        has_table_privilege(current_user,'public.ledger_entries','INSERT,UPDATE,DELETE,TRUNCATE') AS entries_write,
        has_table_privilege(current_user,'public.ledger_transactions','INSERT,UPDATE,DELETE,TRUNCATE') AS header_write,
        has_function_privilege(current_user,'public.ledger_append_posting(jsonb,jsonb)','EXECUTE') AS can_post,
        (SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname=current_user) AS privileged`))[0];

      if (permission?.ddl !== false || permission.entries_write !== false || permission.header_write !== false || permission.can_post !== true || permission.privileged !== false) throw new Error('Ledger runtime role must use the protected journal posting path without DDL/admin privileges');

      for (const policy of policies) for (const currency of policy.currencies) {
        const chart = deriveChart(policy.operatorId, policy.operatorId, currency.currency, (op, identity, purpose) => ids.derive(op, identity, purpose));
        const expected = new Map([['CLEARING', chart.clearing], ['REVENUE', chart.revenue], ['EXPENSE', chart.expense]]);
        const existing = await session.query('SELECT account_id,account_kind FROM ledger_accounts WHERE operator_id=$1::uuid AND currency=$2 AND wallet_id IS NULL', [policy.operatorId, currency.currency]);

        for (const row of existing) if (typeof row.account_kind !== 'string' || expected.get(row.account_kind) !== row.account_id) throw new Error('Configured stable ID namespace differs from existing Ledger chart');
      }
    });
    const resources: IFinancialPersistenceResources = { manager, ids, clock, retry: settings.retry, jitter: settings.jitter };
    const Writer = constructors[settings.backend][settings.strategy];

    return {
      unitOfWork: new Writer(resources),
queries: new SqlFinancialQuery(manager, clock, settings.retry.statementTimeoutMs),
reconciliation: new SqlReconciliationStore(manager, ids, clock, settings.retry.statementTimeoutMs),
outbox: new SqlOutboxDelivery(manager, ids, clock, settings.outboxLeaseMs),
      close: () => manager.close(),
metrics: () => ({ ...manager.metrics, ...manager.poolMetrics() }),
      databaseWaits: async () => manager.transaction(SqlIsolation.READ_COMMITTED, async session => {
        const row = (await session.query("SELECT count(*)::text AS waiting FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND wait_event_type='Lock'"))[0];

        if (!row || typeof row.waiting !== 'string' || !/^\d+$/.test(row.waiting)) throw new Error('Invalid database wait metrics');

        return { lockWaitingSessions: BigInt(row.waiting) };
      }),
    };
  } catch (error) { await manager.close(); throw error; }
}
