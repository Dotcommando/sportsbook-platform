import assert from 'node:assert/strict';

import type { PersistenceBackend } from '@sportsbook/persistence';
import type { Pool } from 'pg';

import { losslessJson } from '../src/adapters/outbound/ids/command-fingerprint.js';
import { CommandFingerprint } from '../src/adapters/outbound/ids/command-fingerprint.js';
import { UuidGenerator } from '../src/adapters/outbound/ids/uuid-generator.js';
import { createPlayerPersistence } from '../src/adapters/outbound/persistence/player-persistence.factory.js';
import { RegisterPlayerUseCase } from '../src/app/use-cases/register-player.use-case.js';
import * as M from '../src/domain/player.model.js';
import { failure } from '../src/domain/player.policy.js';
import type { IPlayerApplicationSettings } from '../src/infra/player-application.factory.js';
import { createPlayerApplication } from '../src/infra/player-application.factory.js';
import type { PlayerUnitOfWorkPort } from '../src/ports/outbound/player.port.js';

export async function verifyPlayerPersistence(
  owner: Pool,
  connectionString: string,
  backend: PersistenceBackend,
): Promise<void> {
  const ids = new UuidGenerator('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  const root = '00000000-0000-4000-8000-000000000001';
  const seed = '00000000-0000-4000-8000-000000000002';
  let sequence = 0;
  const next = (): string => ids.derive(root, seed, 'fixture:' + backend + ':' + (++sequence));
  let time = Date.parse('2026-10-14T12:00:00Z');
  const clock = { now: (): string => new Date(time).toISOString() };
  const operatorId = next();
  const actorId = next();
  const recordActorId = next();
  const system: M.ICallContext = {
    operatorId,
    actorId,
    actorKind: M.ActorKind.SYSTEM,
    capabilities: Object.values(M.Capability),
    correlationId: next(),
    deadlineAt: '2026-10-14T13:00:00Z',
  };
  const registration = {
    context: system,
    requestId: next(),
    externalRef: 'synthetic:' + backend,
    locale: 'en-US',
    timeZone: 'Asia/Tokyo',
  };
  const playerId = ids.derive(operatorId, registration.requestId, 'player:player');
  const openRequestId = next();
  const caseId = ids.derive(operatorId, openRequestId, 'player:kyc-case');
  const fixtures: M.IKycCheck[] = Object.values(M.KycCheckType).map(
    checkType => {
      const checkId = ids.derive(operatorId, caseId, 'player:kyc-check:' + checkType + ':1');

      return {
        checkId,
        caseId,
        checkType,
        attemptNo: 1,
        provider: M.KycProvider.SYNTHETIC,
        providerCheckRef: 'synthetic:' + checkId,
        status: M.KycCheckStatus.PASSED,
        resultCode: 'KYC_PASSED',
        completedAt: clock.now(),
      };
    },
  );
  const contactRequestId = next();
  const contactId = ids.derive(operatorId, contactRequestId, 'player:contact');
  const configuration: IPlayerApplicationSettings = {
    namespace: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    persistence: {
      backend,
      connectionString,
      poolMax: 4,
      replicaCount: 1,
      connectionBudget: 4,
      acquisitionTimeoutMs: 10000,
      transactionTimeoutMs: 30000,
      statementTimeoutMs: 10000,
      lockTimeoutMs: 2000,
      retryAttempts: 20,
      outboxLeaseMs: 10000,
    },
    protection: {
      activeKeyId: 'synthetic',
      encryptionKeys: { synthetic: '1'.repeat(64) },
      contactHmacKey: '2'.repeat(64),
    },
    operators: [
      {
        operatorId,
        businessTimeZone: 'Pacific/Kiritimati',
        countries: ['US', 'JP'],
        reasonCodes: ['ACTIVATE', 'APPROVED', 'TEST', 'CLEAR', 'KYC_PASSED'],
        casePolicyCapabilities: [{ level: M.KycLevel.BASIC, capability: M.PlayerCapability.PLACE_BET }],
        policies: Object.values(M.PlayerCapability).map(
          capability =>
            ({
              capability,
              allowedStatuses: [M.PlayerStatus.ACTIVE],
              policyVersion: 'SYNTHETIC_V1',
              requiredLevel: M.KycLevel.BASIC,
              requiredChecks: Object.values(M.KycCheckType),
              minimumAge: capability === M.PlayerCapability.WITHDRAW ? 0 : 18,
              maxValidityDays: 30,
              blockingRestrictions: capability === M.PlayerCapability.PLACE_BET
                ? [M.RestrictionType.BETTING_BLOCK]
                : capability === M.PlayerCapability.DEPOSIT
                  ? [M.RestrictionType.DEPOSIT_BLOCK]
                  : [M.RestrictionType.WITHDRAWAL_REVIEW],
            }),
        ),
        trustedActors: [
          system,
          {
            actorId: recordActorId,
            actorKind: M.ActorKind.SERVICE,
            capabilities: [M.Capability.SYNTHETIC_KYC, M.Capability.READ_PLAYER_REFERENCE],
          },
        ],
      },
    ],
    proofs: [{ operatorId, contactId, proofRef: 'synthetic:verified' }],
    checks: fixtures.map(check => ({ operatorId, check })),
    recordActors: [{ operatorId, actorId: recordActorId }],
    outboxRetryMs: 10,
  };

  await owner.query('REVOKE UPDATE, DELETE, TRUNCATE ON player_kyc_checks FROM runtime_user');
  let failPublication = true;
  const delivered: string[] = [];
  const app = await createPlayerApplication(
    configuration,
    clock,
    {
      publish: async (context, event) => {
        assert.equal(context.operatorId, operatorId);
        const transactions = await owner.query<{
          count: string;
        }>(
          "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname=current_database() AND usename='runtime_user' AND state='idle in transaction'",
        );

        assert.equal(transactions.rows[0]?.count, '0', 'Remote provider work must follow claim COMMIT');
        assert.equal(
          JSON.stringify(
            event,
            (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value,
          ).includes(
            'firstName',
          ),
          false,
        );
        delivered.push(event.messageId);

        if (failPublication) {
          failPublication = false;
          throw new Error('Lost receipt');
        }

        return { messageId: event.messageId, acceptedAt: clock.now(), durable: true };
      },
    },
  );

  try {
    const registered = await app.operations.registerPlayer.execute(registration);

    assert.ok(registered.ok, losslessJson(registered));
    assert.equal(registered.value.profile.playerId, playerId);
    assert.equal(registered.value.profile.status, M.PlayerStatus.REGISTERED);
    const replays = await Promise.all(
      Array.from(
        { length: 12 },
        () =>
          app.operations.registerPlayer.execute(
            { ...registration, context: { ...system, correlationId: next() } },
          ),
      ),
    );

    assert.ok(replays.every(result => result.ok && result.value.profile.playerId === playerId));
    assert.equal(
      (await owner.query<{
        count: string;
      }>(
        'SELECT count(*)::text AS count FROM players WHERE operator_id=$1',
        [operatorId],
      )).rows[0]?.count,
      '1',
    );
    const player: M.ICallContext = {
      ...system,
      actorId: playerId,
      actorKind: M.ActorKind.PLAYER,
      playerId,
      capabilities: [
        M.Capability.PROFILE_READ,
        M.Capability.PROFILE_WRITE,
        M.Capability.CONTACT_WRITE,
        M.Capability.KYC_STATUS,
        M.Capability.RESTRICTION_READ,
        M.Capability.EVALUATE_ELIGIBILITY,
      ],
    };
    const patched = await app.operations.updatePlayerProfile.execute(
      {
        context: player,
        requestId: next(),
        playerId,
        expectedVersion: 1n,
        patch: {
          firstName: '  Synthetic  ',
          lastName: 'Fixture',
          birthDate: '2000-02-29',
          residenceCountry: 'JP',
        },
      },
    );

    assert.ok(patched.ok, losslessJson(patched));
    assert.equal(patched.value.profile.birthDate, '2000-02-29');
    assert.equal(patched.value.profile.firstName, 'Synthetic');
    const stale = await app.operations.updatePlayerProfile.execute(
      {
        context: player,
        requestId: next(),
        playerId,
        expectedVersion: 1n,
        patch: { firstName: 'Changed' },
      },
    );

    assert.equal(stale.ok, false);

    if (!stale.ok) {
      assert.equal(stale.error.code, M.ErrorCode.VERSION_CONFLICT);
    }

    const contact = await app.operations.addContact.execute(
      {
        context: player,
        requestId: contactRequestId,
        playerId,
        kind: M.ContactKind.EMAIL,
        value: 'synthetic@EXAMPLE.test',
        isPrimary: true,
      },
    );

    assert.ok(contact.ok, losslessJson(contact));
    assert.equal(contact.value.contact.displayValue, 'synthetic@example.test');
    assert.equal(contact.value.contact.verifiedAt, undefined);
    assert.equal(
      (await app.operations.verifyContact.execute(
        { context: system, requestId: next(), playerId, contactId, proofRef: 'synthetic:wrong' },
      )).ok,
      false,
    );
    const verified = await app.operations.verifyContact.execute(
      { context: system, requestId: next(), playerId, contactId, proofRef: 'synthetic:verified' },
    );

    assert.ok(verified.ok, losslessJson(verified));
    assert.equal(verified.value.contact.verifiedAt, clock.now());
    const current = await app.operations.getPlayer.execute({ context: player, playerId });

    assert.ok(current.ok);
    const active = await app.operations.changePlayerStatus.execute(
      {
        context: system,
        requestId: next(),
        playerId,
        expectedVersion: current.value.profile.version,
        status: M.PlayerStatusTarget.ACTIVE,
        reasonCode: 'ACTIVATE',
      },
    );

    assert.ok(active.ok, losslessJson(active));
    const pending = await app.operations.checkEligibility.execute(
      { context: player, playerId, capability: M.PlayerCapability.PLACE_BET },
    );

    assert.ok(pending.ok);
    assert.equal(pending.value.eligibility.reasonCode, M.EligibilityReason.KYC_REQUIRED);
    const opened = await app.operations.openKycCase.execute(
      { context: system, requestId: openRequestId, playerId, requiredLevel: M.KycLevel.BASIC },
    );

    assert.ok(opened.ok, losslessJson(opened));
    assert.equal(opened.value.kycCase.caseId, caseId);
    const incomplete = await app.operations.decideKycCase.execute(
      {
        context: system,
        requestId: next(),
        playerId,
        caseId,
        expectedVersion: 1n,
        decision: M.KycDecision.APPROVED,
        decisionCode: 'APPROVED',
        validUntil: '2026-10-15T12:00:00Z',
      },
    );

    assert.equal(incomplete.ok, false);
    const batchInput = { context: system, batchId: next(), limit: 1, cutoff: clock.now() };
    const competing = await Promise.all(
      [
        app.workers.syntheticKyc.execute(batchInput),
        app.workers.syntheticKyc.execute({ ...batchInput, batchId: next() }),
      ],
    );

    assert.ok(competing.every(result => result.ok), losslessJson(competing));
    const selectedCount = Number(
      (await owner.query<{
        count: string;
      }>(
        'SELECT count(*)::text AS count FROM player_kyc_checks WHERE operator_id=$1 AND kyc_case_id=$2',
        [operatorId, caseId],
      )).rows[0]?.count,
    );

    assert.ok(selectedCount >= 1 && selectedCount <= 2);
    const remainder = await app.workers.syntheticKyc.execute({ ...batchInput, batchId: next(), limit: 200 });

    assert.ok(remainder.ok, losslessJson(remainder));
    assert.equal(remainder.value.selected, Object.values(M.KycCheckType).length - selectedCount);
    const drained = await app.workers.syntheticKyc.execute({ ...batchInput, batchId: next(), limit: 200 });

    assert.ok(drained.ok);
    assert.equal(drained.value.selected, 0);

    for (const checkType of Object.values(M.KycCheckType)) {
      const input = { context: system, requestId: next(), playerId, caseId, checkType, attemptNo: 1 };
      const check = await app.operations.runSyntheticKycCheck.execute(input);

      assert.ok(check.ok, losslessJson(check));
      const replay = await app.operations.runSyntheticKycCheck.execute({ ...input, requestId: next() });

      assert.ok(replay.ok, losslessJson(replay));
    }
    const cases = await app.operations.getKycStatus.execute({ context: player, playerId });

    assert.ok(cases.ok);
    const finalCase = cases.value.cases.find(value => value.caseId === caseId);

    assert.ok(finalCase);
    const decided = await app.operations.decideKycCase.execute(
      {
        context: system,
        requestId: next(),
        playerId,
        caseId,
        expectedVersion: finalCase.version,
        decision: M.KycDecision.APPROVED,
        decisionCode: 'APPROVED',
        validUntil: '2026-10-15T12:00:00Z',
      },
    );

    assert.ok(decided.ok, losslessJson(decided));
    const eligible = await app.operations.checkEligibility.execute(
      { context: player, playerId, capability: M.PlayerCapability.PLACE_BET },
    );

    assert.ok(eligible.ok);
    assert.equal(eligible.value.eligibility.allowed, true);
    assert.equal('birthDate' in eligible.value.eligibility, false);
    const restricted = await app.operations.applyRestriction.execute(
      {
        context: system,
        requestId: next(),
        playerId,
        type: M.RestrictionType.BETTING_BLOCK,
        reasonCode: 'TEST',
        startsAt: clock.now(),
        endsAt: '2026-10-14T12:10:00Z',
      },
    );

    assert.ok(restricted.ok, losslessJson(restricted));
    const betting = await app.operations.checkEligibility.execute(
      { context: player, playerId, capability: M.PlayerCapability.PLACE_BET },
    );
    const withdrawal = await app.operations.checkEligibility.execute(
      { context: player, playerId, capability: M.PlayerCapability.WITHDRAW },
    );

    assert.ok(betting.ok && withdrawal.ok);
    assert.equal(betting.value.eligibility.allowed, false);
    assert.equal(withdrawal.value.eligibility.allowed, true);
    const restrictions =
      await app.operations.getRestrictions.execute(
        {
          context:
            player,
          playerId,
          page:
          {
            limit:
              1,
          },
        },
      );

    assert.ok(restrictions.ok);
    assert.equal(restrictions.value.restrictions.length, 1);
    assert.ok(
      (await app.operations.clearRestriction.execute(
        {
          context: system,
          requestId: next(),
          playerId,
          restrictionId: restricted.value.restriction.restrictionId,
          reasonCode: 'CLEAR',
        },
      )).ok,
    );
    const reference = await app.operations.getPlayerReference.execute(
      {
        context: {
          ...system,
          actorId: recordActorId,
          actorKind: M.ActorKind.SERVICE,
          playerId,
          capabilities: [M.Capability.READ_PLAYER_REFERENCE],
        },
        playerId,
      },
    );

    assert.ok(reference.ok);
    assert.deepEqual(Object.keys(reference.value).sort(), ['exists', 'operatorId', 'playerId']);
    const foreign = await app.operations.getPlayer.execute(
      { context: { ...player, actorId: next(), playerId: next() }, playerId },
    );

    assert.equal(foreign.ok, false);
    const plaintext = await owner.query<{
      protected: string;
    }>(
      "SELECT encode(first_name_enc,'escape') AS protected FROM player_profiles WHERE operator_id=$1 AND player_id=$2",
      [operatorId, playerId],
    );

    assert.equal(plaintext.rows[0]?.protected.includes('Synthetic'), false);
    const commandRows = await owner.query<{
      text: string;
    }>(
      'SELECT semantic_input::text || COALESCE(response_snapshot::text,\'\') AS text FROM player_commands WHERE operator_id=$1',
      [operatorId],
    );

    assert.ok(
      commandRows.rows.every(
        value => !value.text.includes('Synthetic') && !value.text.includes('2000-02-29'),
      ),
    );
    const firstCheck = fixtures[0];

    assert.ok(firstCheck);
    const forbiddenCheck = await app.operations.recordKycCheck.execute(
      { context: system, requestId: next(), playerId, caseId, check: firstCheck },
    );

    assert.equal(forbiddenCheck.ok, false);

    if (!forbiddenCheck.ok) {
      assert.equal(forbiddenCheck.error.code, M.ErrorCode.PERMISSION_DENIED);
    }

    const faultStore = await createPlayerPersistence(
      { ...configuration.persistence, poolMax: 1 },
      ids,
      clock,
      configuration.protection,
      configuration.operators,
    );
    let beforeCommit = true;
    let lostResponse = false;
    const faulting: PlayerUnitOfWorkPort = {
      run: async (context, work) => {
        const result = await faultStore.unitOfWork.run(
          context,
          async (ports) => {
            const value = await work(ports);

            if (beforeCommit) {
              beforeCommit = false;

              return failure(M.ErrorCode.DEPENDENCY_UNAVAILABLE, context);
            }

            return value;
          },
        );

        if (lostResponse) {
          lostResponse = false;

          return failure(M.ErrorCode.DEPENDENCY_UNAVAILABLE, context, true);
        }

        return result;
      },
    };

    try {
      const command = new RegisterPlayerUseCase(
        {
          unitOfWork: faulting,
          ids,
          clock,
          fingerprint: new CommandFingerprint(),
          settings: configuration.operators,
        },
      );
      const before = { ...registration, requestId: next(), externalRef: 'synthetic:before-fault' };
      const rolledBack = await command.execute(before);

      assert.equal(rolledBack.ok, false);
      assert.equal(
        (await owner.query<{
          count: string;
        }>(
          'SELECT count(*)::text AS count FROM player_commands WHERE operator_id=$1 AND request_id=$2',
          [operatorId, before.requestId],
        )).rows[0]?.count,
        '0',
      );
      assert.equal(
        (await owner.query<{
          count: string;
        }>(
          'SELECT count(*)::text AS count FROM players WHERE operator_id=$1 AND external_ref=$2',
          [operatorId, before.externalRef],
        )).rows[0]?.count,
        '0',
      );
      const after = { ...registration, requestId: next(), externalRef: 'synthetic:after-fault' };

      lostResponse = true;
      const unknown = await command.execute(after);

      assert.equal(unknown.ok, false);

      if (!unknown.ok) {
        assert.equal(unknown.error.outcomeUnknown, true);
      }

      const saved = await command.execute(after);

      assert.ok(saved.ok, losslessJson(saved));
      assert.equal(
        (await owner.query<{
          count: string;
        }>(
          'SELECT count(*)::text AS count FROM players WHERE operator_id=$1 AND external_ref=$2',
          [operatorId, after.externalRef],
        )).rows[0]?.count,
        '1',
      );
    } finally {
      await faultStore.close();
    }
    const published = await app.operations.publishOutboxBatch.execute(
      { input: { context: system, batchId: next(), limit: 200, cutoff: clock.now() } },
    );

    assert.ok(published.ok);
    assert.equal(published.value.report.pending, 1);
    time += 20;
    const retried = await app.operations.publishOutboxBatch.execute(
      { input: { context: system, batchId: next(), limit: 200, cutoff: clock.now() } },
    );

    assert.ok(retried.ok);
    assert.equal(retried.value.report.applied, 1);
    assert.equal(delivered.at(-1), delivered[0]);
    time = Date.parse('2026-10-16T12:00:00Z');
    const renewedContext = { ...player, deadlineAt: '2026-10-16T13:00:00Z' };
    const expired = await app.operations.checkEligibility.execute(
      { context: renewedContext, playerId, capability: M.PlayerCapability.PLACE_BET },
    );

    assert.ok(expired.ok);
    assert.equal(expired.value.eligibility.reasonCode, M.EligibilityReason.KYC_EXPIRED);
    console.log(
      'Player ' + backend
      + ': lifecycle, protected profile/contact/commands, KYC, replay, capability restrictions, scoped reference and outbox recovery passed.',
    );
  } finally {
    await app.close();
  }
}
