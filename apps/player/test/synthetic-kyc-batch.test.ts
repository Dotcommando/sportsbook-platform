import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CommandFingerprint } from '../src/adapters/outbound/ids/command-fingerprint.js';
import { UuidGenerator } from '../src/adapters/outbound/ids/uuid-generator.js';
import type { IPlayerDependencies } from '../src/app/services/player-command.service.js';
import { RunSyntheticKycBatchUseCase } from '../src/app/use-cases/run-synthetic-kyc-batch.use-case.js';
import * as M from '../src/domain/player.model.js';
import type { RunSyntheticKycCheckPort } from '../src/ports/inbound/player-operations.port.js';
import type { IKycWorkItem, KycWorkQueryPort } from '../src/ports/outbound/kyc-work.port.js';

function fixture(): {
  dependencies: IPlayerDependencies;
  context: M.ICallContext;
  item: IKycWorkItem;
  now: string;
} {
  const ids = new UuidGenerator('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  const root = '00000000-0000-4000-8000-000000000001';
  const actorId = ids.derive(root, root, 'actor');
  const now = '2026-10-15T12:00:00.000Z';
  const context: M.ICallContext = {
    operatorId: root,
    actorId,
    actorKind: M.ActorKind.SYSTEM,
    capabilities: [M.Capability.SYNTHETIC_KYC],
    correlationId: ids.derive(root, root, 'correlation'),
    deadlineAt: '2026-10-15T13:00:00.000Z',
  };
  const settings: M.IPlayerOperatorSettings[] = [
    {
      operatorId: root,
      businessTimeZone: 'UTC',
      countries: ['US'],
      reasonCodes: ['PASSED'],
      policies: Object.values(M.PlayerCapability).map(capability => ({
        capability,
        policyVersion: 'FIXTURE_V1',
        allowedStatuses: [M.PlayerStatus.ACTIVE],
        requiredLevel: M.KycLevel.BASIC,
        requiredChecks: Object.values(M.KycCheckType),
        maxValidityDays: 30,
        blockingRestrictions: [],
      })),
      casePolicyCapabilities: [{ level: M.KycLevel.BASIC, capability: M.PlayerCapability.PLACE_BET }],
      trustedActors: [{ actorId, actorKind: M.ActorKind.SYSTEM, capabilities: [M.Capability.SYNTHETIC_KYC] }],
    },
  ];

  return {
    context,
    now,
    dependencies: {
      settings,
      ids,
      clock: { now: () => now },
      fingerprint: new CommandFingerprint(),
      unitOfWork: {
        run: async () => {
          throw new Error('Batch selection must use the due-work port');
        },
      },
    },
    item: {
      playerId: ids.derive(root, root, 'player'),
      caseId: ids.derive(root, root, 'case'),
      checkType: M.KycCheckType.IDENTITY,
      attemptNo: 1,
    },
  };
}

test(
  'KYC retries keep the original check key; recorded work disappears after restart',
  async () => {
    const { dependencies, context, item, now } = fixture();
    let recorded = false;
    let fail = true;
    const requests: string[] = [];
    const work: KycWorkQueryPort = {
      listDue: async (_context, _cutoff, limit, policies) => {
        assert.equal(limit, 20);
        assert.equal(policies[0]?.version, 'FIXTURE_V1');

        return recorded ? [] : [item];
      },
    };
    const check: RunSyntheticKycCheckPort = {
      execute: async (input) => {
        requests.push(input.requestId);

        if (fail) {
          fail = false;

          return {
            ok: false,
            error: {
              code: M.ErrorCode.DEPENDENCY_UNAVAILABLE,
              message: 'DEPENDENCY_UNAVAILABLE',
              correlationId: context.correlationId,
              retryable: true,
              outcomeUnknown: false,
            },
          };
        }
        recorded = true;

        return {
          ok: true,
          value: {
            check: {
              checkId: input.requestId,
              caseId: item.caseId,
              checkType: item.checkType,
              attemptNo: 1,
              provider: M.KycProvider.SYNTHETIC,
              providerCheckRef: 'synthetic:' + input.requestId,
              status: M.KycCheckStatus.PASSED,
              resultCode: 'PASSED',
              completedAt: now,
            },
            kycCase: {
              caseId: item.caseId,
              playerId: item.playerId,
              requiredLevel: M.KycLevel.BASIC,
              status: M.KycCaseStatus.IN_REVIEW,
              policyVersion: 'FIXTURE_V1',
              version: 2n,
            },
          },
        };
      },
    };
    const input = {
      context,
      batchId: dependencies.ids.derive(context.operatorId, item.caseId, 'batch'),
      limit: 20,
      cutoff: now,
    };
    const worker = new RunSyntheticKycBatchUseCase(dependencies, work, check);
    const first = await worker.execute(input);

    assert.ok(first.ok);
    assert.equal(first.value.pending, 1);
    const restarted = new RunSyntheticKycBatchUseCase(dependencies, work, check);
    const second = await restarted.execute(input);

    assert.ok(second.ok);
    assert.equal(second.value.applied, 1);
    assert.equal(requests[0], requests[1]);
    const third = await restarted.execute(input);

    assert.ok(third.ok);
    assert.equal(third.value.selected, 0);
  },
);

test(
  'KYC batch rejects duplicate work and untrusted actors without provider calls',
  async () => {
    const { dependencies, context, item, now } = fixture();
    let calls = 0;
    const worker = new RunSyntheticKycBatchUseCase(dependencies, { listDue: async () => [item, item] }, {
      execute: async () => {
        calls++;
        throw new Error('Unexpected check');
      },
    });
    const input = {
      context,
      batchId: dependencies.ids.derive(context.operatorId, item.caseId, 'batch'),
      limit: 20,
      cutoff: now,
    };
    const duplicate = await worker.execute(input);

    assert.equal(duplicate.ok, false);

    if (!duplicate.ok) {
      assert.equal(duplicate.error.code, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
    }
    assert.equal(
      (await worker.execute({
        ...input,
        context: { ...context, actorKind: M.ActorKind.PLAYER, actorId: item.playerId, playerId: item.playerId },
      })).ok,
      false,
    );
    assert.equal(
      (await worker.execute({ ...input, context: { ...context, operatorId: item.playerId } })).ok,
      false,
    );
    assert.equal(calls, 0);
  },
);
