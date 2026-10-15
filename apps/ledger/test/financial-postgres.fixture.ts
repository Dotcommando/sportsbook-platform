import assert from 'node:assert/strict';

import { PersistenceBackend } from '@sportsbook/persistence';
import type { Pool } from 'pg';

import { losslessJson } from '../src/adapters/outbound/ids/command-fingerprint.js';
import { CommandFingerprint } from '../src/adapters/outbound/ids/command-fingerprint.js';
import { UuidGenerator } from '../src/adapters/outbound/ids/uuid-generator.js';
import type { ILedgerPersistenceSettings } from '../src/adapters/outbound/persistence/financial-persistence.factory.js';
import * as Writers from '../src/adapters/outbound/persistence/ledger.writers.js';
import { LedgerConcurrencyStrategy } from '../src/adapters/outbound/persistence/sql-session.js';
import {
  PgTransactionManager,
  PrismaTransactionManager,
  SequelizeTransactionManager,
  TypeOrmTransactionManager,
} from '../src/adapters/outbound/persistence/transaction-managers.js';
import { ReserveStakeUseCase } from '../src/app/use-cases/reserve-stake.use-case.js';
import { MAX_INT64 } from '../src/domain/ledger.error.js';
import type { ICallContext, IOperatorFinancialPolicy } from '../src/domain/ledger.model.js';
import { ActorKind, AuditState, Capability, ErrorCode, RefundReason } from '../src/domain/ledger.model.js';
import { createLedgerApplication } from '../src/infra/ledger-application.factory.js';
import { createLedgerPaymentWorker } from '../src/infra/ledger-worker.factory.js';
import { FaultInjectingTransactionManager, TransactionFault } from './transaction-fault.fixture.js';

export async function verifyFinancialPersistence(
  owner: Pool,
  connectionString: string,
  backend: PersistenceBackend,
  strategies: readonly LedgerConcurrencyStrategy[],
  full: boolean,
): Promise<void> {
  const fixtureIds = new UuidGenerator('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  let sequence = 0;
  const randomUUID = (): string =>
    fixtureIds.derive(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      'fixture:' + backend + ':' + (++sequence),
    );

  for (const strategy of strategies) {
    const operatorId = randomUUID();
    const playerId = randomUUID();
    const clock = { now: (): string => new Date().toISOString() };
    const context: ICallContext = {
      operatorId,
      actorId: randomUUID(),
      actorKind: ActorKind.SYSTEM,
      capabilities: Object.values(Capability),
      correlationId: randomUUID(),
      deadlineAt: new Date(Date.now() + 600000).toISOString(),
    };
    const betting: ICallContext = {
      ...context,
      actorId: randomUUID(),
      actorKind: ActorKind.SERVICE,
      playerId,
      capabilities: [Capability.RESERVE_STAKE, Capability.SETTLE_BET, Capability.CANCEL_RESERVATION],
    };
    const player: ICallContext = {
      ...context,
      actorId: playerId,
      actorKind: ActorKind.PLAYER,
      playerId,
      capabilities: [Capability.READ_WALLET, Capability.READ_JOURNAL, Capability.WITHDRAW],
    };
    const policies: IOperatorFinancialPolicy[] = [
      {
        operatorId,
        currencies: [{ currency: 'USD', minimumMinor: 1n, maximumMinor: MAX_INT64 }],
        providerNames: ['synthetic'],
        rejectionReasons: ['PAYMENT_REJECTED'],
        trustedActors: [{ ...context, providerName: 'synthetic' }, betting],
      },
    ];
    const settings: ILedgerPersistenceSettings = {
      backend,
      strategy,
      connectionString,
      poolMax: 5,
      replicaCount: 1,
      aggregateConnectionBudget: 10,
      acquisitionTimeoutMs: 10000,
      transactionTimeoutMs: 30000,
      retry: {
        serializationAttempts: 50,
        deadlockAttempts: 10,
        versionAttempts: 100,
        retryBaseMs: 1,
        retryMaxMs: 16,
        statementTimeoutMs: 10000,
        lockTimeoutMs: 2000,
      },
      outboxLeaseMs: 10000,
      jitter: () => 0.5,
    };
    const app = await createLedgerApplication(
      settings,
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      policies,
      clock,
      {
        publish: async (_ctx, event) => ({ messageId: event.messageId, acceptedAt: clock.now(), durable: true }),
      },
      10,
    );

    try {
      const created = await app.operations.createWallet.execute(
        { context, requestId: randomUUID(), playerId, currency: 'USD' },
      );

      assert.ok(created.ok, losslessJson(created));
      const walletId = created.value.wallet.walletId;
      const deposited = await app.operations.depositTestFunds.execute(
        {
          context,
          requestId: randomUUID(),
          walletId,
          amount: { amountMinor: 10000n, currency: 'USD' },
          providerRef: 'synthetic:fund-' + strategy,
        },
      );

      assert.ok(deposited.ok, losslessJson(deposited));
      const betId = randomUUID();
      const reserveInput = {
        context: betting,
        requestId: randomUUID(),
        walletId,
        betId,
        stake: { amountMinor: 2000n, currency: 'USD' },
      };
      const reserved = await app.operations.reserveStake.execute(reserveInput);

      assert.ok(reserved.ok, losslessJson(reserved));
      const winInput = {
        context: betting,
        requestId: randomUUID(),
        betId,
        settlementSeq: 1n,
        grossPayout: { amountMinor: 5000n, currency: 'USD' },
      };
      const won = await app.operations.settleWin.execute(winInput);

      assert.ok(won.ok, losslessJson(won));
      assert.equal(won.value.outcome.wallet.availableMinor, 13000n);
      const replay = await app.operations.settleWin.execute(
        { ...winInput, context: { ...betting, correlationId: randomUUID() } },
      );

      assert.ok(replay.ok, losslessJson(replay));
      assert.equal(replay.value.outcome.replayed, true);
      const conflict = await app.operations.settleWin.execute(
        { ...winInput, grossPayout: { amountMinor: 6000n, currency: 'USD' } },
      );

      assert.equal(conflict.ok, false);

      if (!conflict.ok) {
        assert.equal(conflict.error.code, ErrorCode.IDEMPOTENCY_CONFLICT);
      }

      const cancelFinal = await app.operations.cancelBet.execute(
        { context: betting, requestId: randomUUID(), betId, reasonCode: RefundReason.VOID },
      );

      assert.equal(cancelFinal.ok, false);
      const withdrawalId = randomUUID();
      const held = await app.operations.requestWithdrawal.execute(
        {
          context: player,
          requestId: randomUUID(),
          walletId,
          withdrawalId,
          amount: { amountMinor: 1000n, currency: 'USD' },
        },
      );

      assert.ok(held.ok, losslessJson(held));
      const completed = await app.operations.completeWithdrawal.execute(
        {
          context,
          requestId: randomUUID(),
          withdrawalId,
          providerRef: 'synthetic:withdrawal-' + strategy,
        },
      );

      assert.ok(completed.ok, losslessJson(completed));
      assert.equal(completed.value.outcome.wallet.withdrawalHoldMinor, 0n);
      assert.equal(
        (await app.operations.rejectWithdrawal.execute(
          { context, requestId: randomUUID(), withdrawalId, reasonCode: 'PAYMENT_REJECTED' },
        )).ok,
        false,
      );
      const history = await app.operations.getLedgerEntries.execute({ context: player, walletId, page: { limit: 1 } });

      assert.ok(history.ok, losslessJson(history));
      assert.ok(history.value.nextCursor);
      const next = await app.operations.getLedgerEntries.execute(
        { context: player, walletId, page: { limit: 1, cursor: history.value.nextCursor } },
      );

      assert.ok(next.ok, losslessJson(next));
      assert.notEqual(history.value.entries[0]?.entryId, next.value.entries[0]?.entryId);
      const foreign = await app.operations.getBalance.execute(
        { context: { ...player, actorId: randomUUID(), playerId: randomUUID() }, walletId },
      );

      assert.equal(foreign.ok, false);
      const current = await app.operations.getBalance.execute({ context: player, walletId });

      assert.ok(current.ok);
      assert.equal(current.value.wallet.availableMinor, 12000n);
      {
        const manager = backend === PersistenceBackend.TypeOrm
          ? await TypeOrmTransactionManager.create(settings)
          : backend === PersistenceBackend.Prisma
            ? new PrismaTransactionManager(settings)
            : backend === PersistenceBackend.Sequelize
              ? new SequelizeTransactionManager(settings)
              : new PgTransactionManager(settings);
        const probe = new FaultInjectingTransactionManager(manager);
        const selected = backend === PersistenceBackend.TypeOrm
          ? [
            Writers.TypeOrmConditionalWriter,
            Writers.TypeOrmForUpdateWriter,
            Writers.TypeOrmSerializableWriter,
          ]
          : backend === PersistenceBackend.Prisma
            ? [
              Writers.PrismaConditionalWriter,
              Writers.PrismaForUpdateWriter,
              Writers.PrismaSerializableWriter,
            ]
            : backend === PersistenceBackend.Sequelize
              ? [
                Writers.SequelizeConditionalWriter,
                Writers.SequelizeForUpdateWriter,
                Writers.SequelizeSerializableWriter,
              ]
              : [Writers.PgConditionalWriter, Writers.PgForUpdateWriter, Writers.PgSerializableWriter];
        const Writer = selected[strategy === LedgerConcurrencyStrategy.CONDITIONAL
          ? 0
          : strategy === LedgerConcurrencyStrategy.FOR_UPDATE ? 1 : 2];

        assert.ok(Writer);
        const ids = new UuidGenerator('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
        const faulting = new ReserveStakeUseCase(
          {
            unitOfWork: new Writer({ manager: probe, ids, clock, retry: settings.retry, jitter: settings.jitter }),
            clock,
            ids,
            fingerprint: new CommandFingerprint(),
            policies,
          },
        );

        try {
          const beforeInput = {
            context: betting,
            requestId: randomUUID(),
            walletId,
            betId: randomUUID(),
            stake: { currency: 'USD', amountMinor: 100n },
          };

          probe.fault = TransactionFault.BEFORE_COMMIT;
          const failed = await faulting.execute(beforeInput);

          assert.equal(failed.ok, false);

          if (!failed.ok) {
            assert.equal(failed.error.outcomeUnknown, false);
          }

          const unchanged = await app.operations.getBalance.execute({ context: player, walletId });

          assert.ok(unchanged.ok);
          assert.equal(unchanged.value.wallet.availableMinor, 12000n);
          const absent = await app.operations.getCommandOutcome.execute(
            { context: betting, requestId: beforeInput.requestId },
          );

          assert.ok(absent.ok);
          assert.equal(absent.value.found, false);
          const afterInput = { ...beforeInput, requestId: randomUUID(), betId: randomUUID() };

          probe.fault = TransactionFault.AFTER_COMMIT;
          const unknown = await faulting.execute(afterInput);

          assert.equal(unknown.ok, false);

          if (!unknown.ok) {
            assert.equal(unknown.error.outcomeUnknown, true);
          }

          const saved =
            await app.operations.getCommandOutcome.execute(
              {
                context:
                  betting,
                requestId:
                  afterInput.requestId,
              },
            );

          assert.ok(saved.ok && saved.value.found);
          const repeated = await faulting.execute(afterInput);

          assert.ok(repeated.ok);
          assert.equal(repeated.value.outcome.replayed, true);
          const once = await app.operations.getBalance.execute({ context: player, walletId });

          assert.ok(once.ok);
          assert.equal(once.value.wallet.availableMinor, 11900n);
        } finally {
          await probe.close();
        }
      }
      const count = full ? 1000 : 30;
      const raceWallet = await app.operations.createWallet.execute(
        { context, requestId: randomUUID(), playerId: randomUUID(), currency: 'USD' },
      );

      assert.ok(raceWallet.ok);
      const racing = { ...betting, playerId: raceWallet.value.wallet.playerId };
      const raceId = raceWallet.value.wallet.walletId;

      assert.ok(
        (await app.operations.depositTestFunds.execute(
          {
            context,
            requestId: randomUUID(),
            walletId: raceId,
            amount: { amountMinor: full ? 10000n : 1000n, currency: 'USD' },
            providerRef: 'synthetic:race-' + strategy,
          },
        )).ok,
      );
      const requests = Array.from(
        { length: count },
        () =>
          ({
            context: racing,
            requestId: randomUUID(),
            walletId: raceId,
            betId: randomUUID(),
            stake: { amountMinor: 100n, currency: 'USD' },
          }),
      );
      const results = await Promise.all(requests.map(input => app.operations.reserveStake.execute(input)));
      const successful = results.filter(result => result.ok).length;
      const insufficient =
        results.filter(
          result => !result.ok
            && result.error.code
            === ErrorCode.INSUFFICIENT_FUNDS,
        ).length;

      assert.equal(
        successful,
        full ? 100 : 10,
        losslessJson(results.filter(result => !result.ok).slice(0, 3)),
      );
      assert.equal(
        insufficient,
        count - successful,
        'All bounded retries resolve to a known business outcome',
      );
      const before = (await owner.query<{
        count: string;
      }>(
        "SELECT count(*)::text AS count FROM ledger_transactions WHERE operator_id=$1 AND transaction_type='RESERVE_STAKE'",
        [operatorId],
      )).rows[0]?.count;
      const repeated = await Promise.all(requests.map(input => app.operations.reserveStake.execute(input)));

      assert.equal(repeated.filter(result => result.ok).length, successful);
      assert.equal(
        (await owner.query<{
          count: string;
        }>(
          "SELECT count(*)::text AS count FROM ledger_transactions WHERE operator_id=$1 AND transaction_type='RESERVE_STAKE'",
          [operatorId],
        )).rows[0]?.count,
        before,
      );
      const activeBet = requests.find((_input, index) => results[index]?.ok);

      assert.ok(activeBet);
      const terminals = await Promise.all(
        [
          app.operations.settleLoss.execute(
            { context: racing, requestId: randomUUID(), betId: activeBet.betId, settlementSeq: 1n },
          ),
          app.operations.cancelBet.execute(
            {
              context: racing,
              requestId: randomUUID(),
              betId: activeBet.betId,
              reasonCode: RefundReason.VOID,
            },
          ),
          app.operations.settleWin.execute(
            {
              context: racing,
              requestId: randomUUID(),
              betId: activeBet.betId,
              settlementSeq: 1n,
              grossPayout: { amountMinor: 200n, currency: 'USD' },
            },
          ),
        ],
      );

      assert.equal(terminals.filter(result => result.ok).length, 1);

      for (const reject of [false, true]) {
        const pendingId = randomUUID();

        assert.ok(
          (await app.operations.requestWithdrawal.execute(
            {
              context: player,
              requestId: randomUUID(),
              walletId,
              withdrawalId: pendingId,
              amount: { amountMinor: 100n, currency: 'USD' },
            },
          )).ok,
        );
        const simulation = {
          seed: '42',
          rejectionsPerMillion: reject ? 1000000 : 0,
          rejectionReason: 'PAYMENT_REJECTED',
          providers: [{ operatorId, actorId: context.actorId, name: 'synthetic' }],
        };
        const worker = createLedgerPaymentWorker(
          app,
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          policies,
          clock,
          simulation,
        );
        const input = { context, batchId: randomUUID(), limit: 200, cutoff: clock.now() };
        const resolved = await worker.execute(input);

        assert.ok(resolved.ok, losslessJson(resolved));
        assert.equal(reject ? resolved.value.rejected : resolved.value.applied, 1);
        const restarted = createLedgerPaymentWorker(
          app,
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          policies,
          clock,
          simulation,
        );
        const drained = await restarted.execute({ ...input, batchId: randomUUID() });

        assert.ok(drained.ok);
        assert.equal(drained.value.selected, 0);
        const terminal = await owner.query<{
          count: string;
        }>(
          "SELECT count(*)::text AS count FROM ledger_transactions WHERE operator_id=$1 AND business_ref=$2 AND transaction_type IN ('WITHDRAWAL_COMPLETE','WITHDRAWAL_REJECT')",
          [operatorId, pendingId],
        );

        assert.equal(terminal.rows[0]?.count, '1');
      }
      const cutoff = clock.now();
      const runId = randomUUID();
      const report = await app.operations.reconcileLedger.execute(
        { context, requestId: randomUUID(), runId, cutoff, page: { limit: 1 } },
      );

      assert.ok(report.ok, losslessJson(report));
      assert.equal(
        report.value.report.status,
        AuditState.PASS,
        losslessJson(report.value.report.violations),
      );
      assert.ok(
        (await app.operations.reconcileLedger.execute(
          { context, requestId: randomUUID(), runId, cutoff, page: { limit: 1 } },
        )).ok,
        'Audit run replay',
      );
      await owner.query(
        'UPDATE ledger_account_balances SET balance_minor=balance_minor+1 WHERE operator_id=$1',
        [operatorId],
      );
      const corrupted = await app.operations.reconcileLedger.execute(
        {
          context,
          requestId: randomUUID(),
          runId: randomUUID(),
          cutoff: clock.now(),
          page: { limit: 1 },
        },
      );

      assert.ok(corrupted.ok, losslessJson(corrupted));
      assert.equal(corrupted.value.report.status, AuditState.FAIL);
      assert.ok(corrupted.value.report.counts.violations > 1n);
      assert.equal(corrupted.value.report.violations.length, 1);
      await owner.query(
        'UPDATE ledger_account_balances SET balance_minor=balance_minor-1 WHERE operator_id=$1',
        [operatorId],
      );
      const published = await app.operations.publishOutboxBatch.execute(
        { input: { context, batchId: randomUUID(), limit: 200, cutoff: clock.now() } },
      );

      assert.ok(published.ok, losslessJson(published));
      assert.ok(published.value.report.applied > 0);
      const metrics = app.persistence.metrics();

      assert.ok(metrics.queryRoundTrips > 0);
      assert.ok(
        metrics.active !== undefined && metrics.idle !== undefined && metrics.waiting !== undefined,
      );
      assert.ok(metrics.lockCoordinationMs > 0);
      assert.equal((await app.persistence.databaseWaits()).lockWaitingSessions, 0n);
      console.log(
        'Ledger ' + backend + '/' + strategy
        + ': lifecycle, replay/conflict, ownership, keyset history, '
        + count
        + '-request race, terminal exclusivity, full audit and outbox persistence passed.',
      );
    } finally {
      await app.close();
    }
  }
}
