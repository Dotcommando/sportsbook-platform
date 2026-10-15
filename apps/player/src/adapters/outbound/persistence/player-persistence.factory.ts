import { PrismaPg } from '@prisma/adapter-pg';
import type { ITransactionalRuntime, ITransactionalSettings } from '@sportsbook/persistence';
import { createTransactionalRuntime, PersistenceBackend, TransactionIsolation } from '@sportsbook/persistence';

import * as M from '../../../domain/player.model.js';
import { requireRule, validUuid, zone } from '../../../domain/player.policy.js';
import type { KycWorkQueryPort } from '../../../ports/outbound/kyc-work.port.js';
import type {
  ClockPort,
  IdGeneratorPort,
  OutboxDeliveryPort,
  PlayerUnitOfWorkPort,
} from '../../../ports/outbound/player.port.js';
import { PrismaClient } from './generated/prisma/client.js';
import { KycWorkQuery } from './kyc-work.query.js';
import { PlayerOutboxDelivery } from './player-outbox.js';
import { PlayerSqlUnitOfWork } from './player-unit-of-work.js';
import type { IProtectionSettings } from './protected-values.js';
import { ProtectedValues } from './protected-values.js';

export interface IPlayerPersistenceSettings extends ITransactionalSettings {
  retryAttempts: number;
  outboxLeaseMs: number;
}

export interface IPlayerPersistence {
  unitOfWork: PlayerUnitOfWorkPort;
  outbox: OutboxDeliveryPort;
  kycWork: KycWorkQueryPort;
  ready(): Promise<void>;
  close(): Promise<void>;
}

export function validateOperatorSettings(settings: readonly M.IPlayerOperatorSettings[]): void {
  requireRule(
    settings.length > 0
    && new Set(settings.map(value => value.operatorId)).size === settings.length,
  );

  for (const value of settings) {
    requireRule(
      validUuid(value.operatorId) && value.countries.length > 0
      && value.countries.every(code => /^[A-Z]{2}$/.test(code))
      && value.reasonCodes.length > 0
      && value.reasonCodes.every(code => /^[A-Z][A-Z0-9_]{0,63}$/.test(code)),
    );
    zone(value.businessTimeZone);
    requireRule(
      value.policies.length === 3
      && new Set(value.policies.map(policy => policy.capability)).size === 3,
    );

    for (const policy of value.policies) {
      requireRule(
        Object.values(M.PlayerCapability).includes(policy.capability)
        && Array.isArray(policy.allowedStatuses)
        && policy.allowedStatuses.length > 0
        && new Set(policy.allowedStatuses).size === policy.allowedStatuses.length
        && policy.allowedStatuses.every(status => Object.values(M.PlayerStatus).includes(status))
        && Object.values(M.KycLevel).includes(policy.requiredLevel)
        && policy.requiredChecks.length > 0
        && new Set(policy.requiredChecks).size === policy.requiredChecks.length
        && policy.requiredChecks.every(check => Object.values(M.KycCheckType).includes(check))
        && /^[A-Z][A-Z0-9_]{0,63}$/.test(policy.policyVersion)
        && Number.isSafeInteger(policy.maxValidityDays)
        && policy.maxValidityDays > 0
        && (policy.minimumAge === undefined
          || Number.isInteger(policy.minimumAge) && policy.minimumAge >= 0 && policy.minimumAge <= 120)
        && policy.blockingRestrictions.every(type => Object.values(M.RestrictionType).includes(type)),
      );
    }
    requireRule(
      value.casePolicyCapabilities.length > 0
      && new Set(value.casePolicyCapabilities.map(binding => binding.level)).size
      === value.casePolicyCapabilities.length
      && value.policies.every(
        policy => value.casePolicyCapabilities.some(binding => binding.level === policy.requiredLevel),
      )
      && value.casePolicyCapabilities.every(
        binding =>
          value.policies.some(
            policy => policy.capability === binding.capability && policy.requiredLevel === binding.level,
          ),
      ),
    );

    for (const actor of value.trustedActors) {
      requireRule(
        validUuid(actor.actorId) && [M.ActorKind.SYSTEM, M.ActorKind.SERVICE].includes(actor.actorKind)
        && actor.capabilities.length > 0
        && actor.capabilities.every(capability => Object.values(M.Capability).includes(capability)),
      );
    }
  }
}

export async function createPlayerPersistence(
  settings: IPlayerPersistenceSettings,
  ids: IdGeneratorPort,
  clock: ClockPort,
  protectionSettings: IProtectionSettings,
  operators: readonly M.IPlayerOperatorSettings[],
): Promise<IPlayerPersistence> {
  validateOperatorSettings(operators);

  if (![PersistenceBackend.TypeOrm, PersistenceBackend.Prisma, PersistenceBackend.Sequelize].includes(
    settings.backend,
  )
    || !Number.isInteger(settings.retryAttempts)
    || settings.retryAttempts < 1
    || settings.retryAttempts > 100
    || !Number.isInteger(settings.outboxLeaseMs)
    || settings.outboxLeaseMs < 1
    || settings.outboxLeaseMs > 60000) {
    throw new Error('Unsupported Player persistence settings');
  }

  const protection = new ProtectedValues(protectionSettings);
  const prisma = settings.backend === PersistenceBackend.Prisma
    ? new PrismaClient(
      {
        adapter: new PrismaPg(
          {
            connectionString: settings.connectionString,
            max: settings.poolMax,
            options: '-c timezone=UTC',
          },
        ),
      },
    )
    : undefined;
  let runtime: ITransactionalRuntime | undefined;

  try {
    runtime = await createTransactionalRuntime(settings, prisma);
    await runtime.run(
      TransactionIsolation.READ_COMMITTED,
      async (session) => {
        const rows = await session.query(
          "SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,has_schema_privilege(current_user,'public','CREATE') AS ddl,has_table_privilege(current_user,'player_kyc_checks','UPDATE') AS mutable_checks,has_table_privilege(current_user,'player_kyc_checks','DELETE') AS deletable_checks FROM pg_roles r WHERE rolname=current_user",
        );
        const row = rows[0];

        if (!row || row.rolsuper || row.rolcreatedb || row.rolcreaterole || row.ddl || row.mutable_checks
          || row.deletable_checks) {
          throw new Error('Restricted Player runtime role required');
        }

        for (const operator of operators) {
          const commands = await session.query(
            'SELECT request_id,stable_child_ids FROM player_commands WHERE operator_id=$1 AND jsonb_array_length(stable_child_ids)>0 ORDER BY created_at DESC LIMIT 1',
            [operator.operatorId],
          );
          const existing = commands[0];

          if (existing && Array.isArray(existing.stable_child_ids)) {
            for (const child of existing.stable_child_ids) {
              if (child !== null && typeof child === 'object') {
                const fields = Object.fromEntries(Object.entries(child));

                if (typeof fields.purpose === 'string' && typeof fields.id === 'string'
                  && typeof existing.request_id === 'string'
                  && [
                    'player:player',
                    'player:contact',
                    'player:kyc-case',
                    'player:restriction',
                    'player:event',
                  ].includes(
                    fields.purpose,
                  )
                  && ids.derive(operator.operatorId, existing.request_id, fields.purpose) !== fields.id) {
                  throw new Error('Player namespace disagrees with stored intent');
                }
              }
            }
          }
        }
      },
    );

    return {
      unitOfWork: new PlayerSqlUnitOfWork(
        runtime,
        ids,
        clock,
        protection,
        settings.retryAttempts,
        settings.statementTimeoutMs,
        settings.lockTimeoutMs,
      ),
      outbox: new PlayerOutboxDelivery(runtime, ids, clock, settings.outboxLeaseMs),
      kycWork: new KycWorkQuery(runtime),
      ready: async () => {
        if (!runtime) {
          throw new Error('Persistence closed');
        }
        await runtime.run(
          TransactionIsolation.READ_COMMITTED,
          async (session) => {
            await session.query('SELECT 1');
          },
        );
      },
      close: () => runtime?.close() ?? Promise.resolve(),
    };
  } catch (error) {
    if (runtime) {
      await runtime.close();
    } else if (prisma) {
      await prisma.$disconnect();
    }
    throw error;
  }
}
