import type { ISyntheticCheck, ISyntheticProof } from '../adapters/outbound/clients/synthetic-provider.js';
import { SyntheticKycClient, SyntheticVerification } from '../adapters/outbound/clients/synthetic-provider.js';
import { CommandFingerprint } from '../adapters/outbound/ids/command-fingerprint.js';
import { UuidGenerator } from '../adapters/outbound/ids/uuid-generator.js';
import type { IPlayerPersistenceSettings } from '../adapters/outbound/persistence/player-persistence.factory.js';
import { createPlayerPersistence } from '../adapters/outbound/persistence/player-persistence.factory.js';
import type { IProtectionSettings } from '../adapters/outbound/persistence/protected-values.js';
import { AddContactUseCase } from '../app/use-cases/add-contact.use-case.js';
import { ApplyRestrictionUseCase } from '../app/use-cases/apply-restriction.use-case.js';
import { ChangePlayerStatusUseCase } from '../app/use-cases/change-player-status.use-case.js';
import { CheckEligibilityUseCase } from '../app/use-cases/check-eligibility.use-case.js';
import { ClearRestrictionUseCase } from '../app/use-cases/clear-restriction.use-case.js';
import { DecideKycCaseUseCase } from '../app/use-cases/decide-kyc-case.use-case.js';
import { GetKycStatusUseCase } from '../app/use-cases/get-kyc-status.use-case.js';
import { GetPlayerUseCase } from '../app/use-cases/get-player.use-case.js';
import { GetPlayerReferenceUseCase } from '../app/use-cases/get-player-reference.use-case.js';
import { GetRestrictionsUseCase } from '../app/use-cases/get-restrictions.use-case.js';
import { OpenKycCaseUseCase } from '../app/use-cases/open-kyc-case.use-case.js';
import { PublishOutboxBatchUseCase } from '../app/use-cases/publish-outbox-batch.use-case.js';
import { RecordKycCheckUseCase } from '../app/use-cases/record-kyc-check.use-case.js';
import { RegisterPlayerUseCase } from '../app/use-cases/register-player.use-case.js';
import { RunSyntheticKycBatchUseCase } from '../app/use-cases/run-synthetic-kyc-batch.use-case.js';
import { RunSyntheticKycCheckUseCase } from '../app/use-cases/run-synthetic-kyc-check.use-case.js';
import { UpdatePlayerProfileUseCase } from '../app/use-cases/update-player-profile.use-case.js';
import { VerifyContactUseCase } from '../app/use-cases/verify-contact.use-case.js';
import * as M from '../domain/player.model.js';
import { PlayerError } from '../domain/player.policy.js';
import type { IPlayerOperationPorts } from '../ports/inbound/player-application.port.js';
import type { RecordKycCheckPort as RecordPort } from '../ports/inbound/player-operations.port.js';
import type { RunSyntheticKycBatchPort } from '../ports/inbound/synthetic-kyc-batch.port.js';
import type {
  ClockPort,
  MessagePublicationPort,
  OperatorEligibilityPolicyPort,
} from '../ports/outbound/player.port.js';

export interface IPlayerApplicationSettings {
  persistence: IPlayerPersistenceSettings;
  namespace: string;
  operators: readonly M.IPlayerOperatorSettings[];
  protection: IProtectionSettings;
  proofs: readonly ISyntheticProof[];
  checks: readonly ISyntheticCheck[];
  recordActors: readonly {
    operatorId: string;
    actorId: string;
  }[];
  outboxRetryMs: number;
}

export async function createPlayerApplication(
  config: IPlayerApplicationSettings,
  clock: ClockPort,
  publication: MessagePublicationPort,
): Promise<{
  ready(): Promise<void>;
  operations: IPlayerOperationPorts;
  workers: {
    syntheticKyc: RunSyntheticKycBatchPort;
  };
  close(): Promise<void>;
}> {
  const snapshot = structuredClone(config);
  const freeze = (value: unknown): void => {
    if (value !== null && typeof value === 'object') {
      Object.freeze(value);

      for (const item of Object.values(value)) {
        freeze(item);
      }
    }
  };

  freeze(snapshot);

  if (!Number.isInteger(config.outboxRetryMs) || config.outboxRetryMs < 1
    || config.outboxRetryMs > 60000) {
    throw new Error('Invalid outbox retry');
  }

  for (const operator of snapshot.operators) {
    const record = snapshot.recordActors.find(actor => actor.operatorId === operator.operatorId);

    if (!record
      || !operator.trustedActors.some(
        actor =>
          actor.actorId === record.actorId && actor.actorKind === M.ActorKind.SERVICE
          && actor.capabilities.includes(M.Capability.SYNTHETIC_KYC),
      )) {
      throw new Error('Explicit synthetic record actor required');
    }
  }
  const ids = new UuidGenerator(snapshot.namespace);
  const persistence = await createPlayerPersistence(
    snapshot.persistence,
    ids,
    clock,
    snapshot.protection,
    snapshot.operators,
  );
  const dependencies = {
    unitOfWork: persistence.unitOfWork,
    ids,
    clock,
    fingerprint: new CommandFingerprint(),
    settings: snapshot.operators,
  };
  const policies: OperatorEligibilityPolicyPort = {
    get: async (context, capability) => {
      const policy = snapshot.operators.find(value => value.operatorId === context.operatorId)?.policies.find(
        value => value.capability === capability,
      );

      if (!policy) {
        throw new PlayerError(M.ErrorCode.PERMISSION_DENIED);
      }

      return policy;
    },
  };
  const verification = new SyntheticVerification(snapshot.proofs);
  const provider = new SyntheticKycClient(snapshot.checks);
  const record = new RecordKycCheckUseCase(dependencies, policies);
  const workerRecord: RecordPort = {
    execute: input => {
      const actor = snapshot.recordActors.find(value => value.operatorId === input.context.operatorId);

      if (!actor) {
        throw new PlayerError(M.ErrorCode.PERMISSION_DENIED);
      }

      return record.execute(
        {
          ...input,
          context: {
            ...input.context,
            actorId: actor.actorId,
            actorKind: M.ActorKind.SERVICE,
            playerId: input.playerId,
            capabilities: [M.Capability.SYNTHETIC_KYC],
          },
        },
      );
    },
  };
  const operations: IPlayerOperationPorts = {
    registerPlayer: new RegisterPlayerUseCase(dependencies),
    getPlayer: new GetPlayerUseCase(dependencies),
    updatePlayerProfile: new UpdatePlayerProfileUseCase(dependencies),
    addContact: new AddContactUseCase(dependencies),
    verifyContact: new VerifyContactUseCase(dependencies, verification),
    changePlayerStatus: new ChangePlayerStatusUseCase(dependencies),
    openKycCase: new OpenKycCaseUseCase(dependencies, policies),
    recordKycCheck: new RecordKycCheckUseCase(dependencies, policies),
    decideKycCase: new DecideKycCaseUseCase(dependencies, policies),
    getKycStatus: new GetKycStatusUseCase(dependencies),
    applyRestriction: new ApplyRestrictionUseCase(dependencies),
    clearRestriction: new ClearRestrictionUseCase(dependencies),
    getRestrictions: new GetRestrictionsUseCase(dependencies),
    checkEligibility: new CheckEligibilityUseCase(dependencies, policies),
    publishOutboxBatch: new PublishOutboxBatchUseCase(
      persistence.outbox,
      publication,
      clock,
      snapshot.outboxRetryMs,
      snapshot.operators,
    ),
    runSyntheticKycCheck: new RunSyntheticKycCheckUseCase(dependencies, provider, workerRecord),
    getPlayerReference: new GetPlayerReferenceUseCase(dependencies),
  };

  return {
    ready: () => persistence.ready(),
    operations,
    workers: {
      syntheticKyc: new RunSyntheticKycBatchUseCase(
        dependencies,
        persistence.kycWork,
        operations.runSyntheticKycCheck,
      ),
    },
    close: () => persistence.close(),
  };
}
