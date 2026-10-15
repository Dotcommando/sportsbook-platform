import assert from 'node:assert/strict';
import test from 'node:test';

import { CommandFingerprint } from '../src/adapters/outbound/ids/command-fingerprint.js';
import { UuidGenerator } from '../src/adapters/outbound/ids/uuid-generator.js';
import { CreateWalletUseCase } from '../src/app/use-cases/create-wallet.use-case.js';
import { DepositTestFundsUseCase } from '../src/app/use-cases/deposit-test-funds.use-case.js';
import { GetBalanceUseCase } from '../src/app/use-cases/get-balance.use-case.js';
import { GetBetFinancialStatusUseCase } from '../src/app/use-cases/get-bet-financial-status.use-case.js';
import { GetCommandOutcomeUseCase } from '../src/app/use-cases/get-command-outcome.use-case.js';
import { GetLedgerEntriesUseCase } from '../src/app/use-cases/get-ledger-entries.use-case.js';
import { GetTransactionUseCase } from '../src/app/use-cases/get-transaction.use-case.js';
import { GetWalletUseCase } from '../src/app/use-cases/get-wallet.use-case.js';
import { GetWalletTransactionsUseCase } from '../src/app/use-cases/get-wallet-transactions.use-case.js';
import { GetWithdrawalUseCase } from '../src/app/use-cases/get-withdrawal.use-case.js';
import { ProvisionPlayerWalletUseCase } from '../src/app/use-cases/provision-player-wallet.use-case.js';
import { PublishOutboxBatchUseCase } from '../src/app/use-cases/publish-outbox-batch.use-case.js';
import { RequestWithdrawalUseCase } from '../src/app/use-cases/request-withdrawal.use-case.js';
import { ReserveStakeUseCase } from '../src/app/use-cases/reserve-stake.use-case.js';
import { validInstant } from '../src/domain/ledger.error.js';
import { MAX_INT64 } from '../src/domain/ledger.error.js';
import type { ICallContext, IOperatorFinancialPolicy, IOutboxLease } from '../src/domain/ledger.model.js';
import { ActorKind, Capability, ErrorCode, EventSource, EventType } from '../src/domain/ledger.model.js';
import { MemoryLedger } from './memory-ledger.fixture.js';

const now = '2026-10-14T12:00:00.000Z';

const clock = { now: (): string => now };

function id(index: number): string {
  return '00000000-0000-4000-8000-' + String(index).padStart(12, '0');
}

function setup(): {
  system: ICallContext;
  player: ICallContext;
  betting: ICallContext;
  store: MemoryLedger;
  ids: UuidGenerator;
  policies: IOperatorFinancialPolicy[]
} {
  const system: ICallContext = {
    operatorId: id(1),
    actorId: id(3),
    actorKind: ActorKind.SYSTEM,
    capabilities: Object.values(Capability),
    correlationId: id(5),
    deadlineAt: '2026-10-14T13:00:00Z',
  };
  const player: ICallContext = {
    ...system,
    actorId: id(2),
    playerId: id(2),
    actorKind: ActorKind.PLAYER,
    capabilities: [Capability.READ_WALLET, Capability.READ_JOURNAL, Capability.WITHDRAW],
  };
  const betting: ICallContext = {
    ...system,
    actorId: id(4),
    playerId: id(2),
    actorKind: ActorKind.SERVICE,
    capabilities: [Capability.RESERVE_STAKE, Capability.SETTLE_BET, Capability.CANCEL_RESERVATION],
  };
  const policies: IOperatorFinancialPolicy[] = [
    {
      operatorId: id(1),
      currencies: ['USD', 'EUR'].map(currency => ({ currency, minimumMinor: 1n, maximumMinor: MAX_INT64 })),
      providerNames: ['synthetic', 'other'],
      rejectionReasons: ['PAYMENT_REJECTED'],
      trustedActors: [{ ...system, providerName: 'synthetic' }, betting],
    },
  ];
  const ids = new UuidGenerator('6ba7b810-9dad-11d1-80b4-00c04fd430c8');

  return { system, player, betting, ids, policies, store: new MemoryLedger(ids, now) };
}

test(
  'player registration provisions each configured currency with stable child keys; repeats and poison do not duplicate',
  async () => {
    const f = setup();
    const dependencies = {
      unitOfWork: f.store,
      clock,
      ids: f.ids,
      fingerprint: new CommandFingerprint(),
      policies: f.policies,
    };
    const provision = new ProvisionPlayerWalletUseCase(
      new CreateWalletUseCase(dependencies),
      f.ids,
      clock,
      f.policies,
    );
    const input = {
      context: f.system,
      playerId: id(2),
      currencies: ['USD', 'EUR'],
      envelope: {
        messageId: id(10),
        source: EventSource.PLAYER,
        eventType: EventType.PLAYER_REGISTERED,
        schemaVersion: 1,
        operatorId: id(1),
        correlationId: id(5),
        occurredAt: now,
        payload: { playerId: id(2), registeredAt: now },
      },
    };
    const created = await provision.execute(input);

    assert.ok(created.ok);
    assert.equal(created.value.wallets.length, 2);
    const repeat = await provision.execute({ ...input, currencies: ['EUR', 'USD'] });

    assert.ok(repeat.ok);
    assert.equal(f.store.state.wallets.size, 2);
    assert.equal(f.store.state.outbox.length, 2);
    const poisoned = await provision.execute(
      {
        ...input,
        playerId: id(99),
        envelope: { ...input.envelope, payload: { playerId: id(99), registeredAt: now } },
      },
    );

    assert.equal(poisoned.ok, false);

    if (!poisoned.ok) {
      assert.equal(poisoned.error.code, ErrorCode.IDEMPOTENCY_CONFLICT);
    }
    assert.equal(f.store.state.wallets.size, 2);
    assert.equal((await provision.execute({ ...input, currencies: ['USD'] })).ok, false);
  },
);

test(
  'publisher releases database phase before remote work and retries the original message ID after an ambiguous reply',
  async () => {
    const f = setup();
    let claimOpen = false;
    let sends = 0;
    const idsSent: string[] = [];
    const completed = new Set<string>();
    const released: string[] = [];
    const leases: IOutboxLease[] = [10, 11].map(
      index =>
        ({
          leaseId: id(index + 20),
          attemptNo: 1,
          leaseUntil: '2026-10-14T12:01:00Z',
          message: {
            messageId: id(index),
            source: EventSource.LEDGER,
            eventType: EventType.WALLET_CREATED,
            schemaVersion: 1,
            operatorId: id(1),
            correlationId: id(5),
            occurredAt: now,
            payload: { walletId: id(index + 40), playerId: id(2), currency: 'USD' },
          },
        }),
    );
    const publisher = new PublishOutboxBatchUseCase(
      {
        claim: async () => {
          claimOpen = true;
          const result = leases.filter(lease => !completed.has(lease.leaseId));

          claimOpen = false;

          return result;
        },
        markDelivered: async (_context, leaseId) => {
          completed.add(leaseId);
        },
        release: async (_context, leaseId) => {
          released.push(leaseId);
        },
      },
      {
        publish: async (_context, event) => {
          assert.equal(claimOpen, false);
          idsSent.push(event.messageId);

          if (++sends === 2) {
            throw new Error('Lost publish reply');
          }

          return { messageId: event.messageId, durable: true, acceptedAt: now };
        },
      },
      clock,
      10,
    );
    const first = await publisher.execute({ input: { context: f.system, batchId: id(60), limit: 2, cutoff: now } });

    assert.ok(first.ok);
    assert.deepEqual(
      first.value.report,
      { selected: 2, applied: 1, replayed: 0, rejected: 0, pending: 1, failed: 0 },
    );
    assert.equal(released.length, 1);
    const retry = await publisher.execute({ input: { context: f.system, batchId: id(61), limit: 2, cutoff: now } });

    assert.ok(retry.ok);
    assert.equal(retry.value.report.applied, 1);
    assert.deepEqual(idsSent, [id(10), id(11), id(11)]);
  },
);

test(
  'all recovery/history readers remain read-only; provider and malformed result boundaries are enforced',
  async () => {
    const f = setup();
    const dependencies = {
      unitOfWork: f.store,
      clock,
      ids: f.ids,
      fingerprint: new CommandFingerprint(),
      policies: f.policies,
    };
    const wallet = await new CreateWalletUseCase(dependencies).execute(
      { context: f.system, requestId: id(10), playerId: id(2), currency: 'USD' },
    );

    assert.ok(wallet.ok);
    const walletId = wallet.value.wallet.walletId;
    const badProvider = await new DepositTestFundsUseCase(dependencies).execute(
      {
        context: f.system,
        requestId: id(11),
        walletId,
        amount: { currency: 'USD', amountMinor: 10000n },
        providerRef: 'other:payment',
      },
    );

    assert.equal(badProvider.ok, false);
    assert.ok(
      (await new DepositTestFundsUseCase(dependencies).execute(
        {
          context: f.system,
          requestId: id(12),
          walletId,
          amount: { currency: 'USD', amountMinor: 10000n },
          providerRef: 'synthetic:payment',
        },
      )).ok,
    );
    const reserve = await new ReserveStakeUseCase(dependencies).execute(
      {
        context: f.betting,
        requestId: id(13),
        walletId,
        betId: id(20),
        stake: { currency: 'USD', amountMinor: 1000n },
      },
    );

    assert.ok(reserve.ok);
    assert.ok(reserve.value.outcome.transactionId);
    assert.ok(
      (await new RequestWithdrawalUseCase(dependencies).execute(
        {
          context: f.player,
          requestId: id(14),
          walletId,
          withdrawalId: id(21),
          amount: { currency: 'USD', amountMinor: 1000n },
        },
      )).ok,
    );
    const readers = { queries: f.store, reconciliation: f.store, clock, policies: f.policies };
    const before = f.store.state.journals.size;

    assert.ok(
      (await new GetWalletUseCase(readers).execute({ context: f.player, playerId: id(2), currency: 'USD' })).ok,
    );
    assert.ok((await new GetBalanceUseCase(readers).execute({ context: f.player, walletId })).ok);
    assert.ok(
      (await new GetTransactionUseCase(readers).execute(
        { context: f.player, transactionId: reserve.value.outcome.transactionId },
      )).ok,
    );
    assert.ok(
      (await new GetLedgerEntriesUseCase(readers).execute(
        { context: f.player, walletId, page: { limit: 2 } },
      )).ok,
    );
    assert.ok(
      (await new GetWalletTransactionsUseCase(readers).execute(
        { context: f.player, walletId, page: { limit: 2 } },
      )).ok,
    );
    assert.ok(
      (await new GetBetFinancialStatusUseCase(readers).execute({ context: f.betting, betId: id(20) })).ok,
    );
    assert.ok(
      (await new GetWithdrawalUseCase(readers).execute({ context: f.player, withdrawalId: id(21) })).ok,
    );
    assert.ok(
      (await new GetCommandOutcomeUseCase(readers).execute({ context: f.betting, requestId: id(13) })).ok,
    );
    assert.equal(f.store.state.journals.size, before);
    const original = f.store.getBalance.bind(f.store);

    f.store.getBalance =
      async (context, id) => {
        const value = await original(context, id);

        return value ? { ...value, availableMinor: -1n } : undefined;
      };
    const invalid = await new GetBalanceUseCase(readers).execute({ context: f.player, walletId });

    assert.equal(invalid.ok, false);

    if (!invalid.ok) {
      assert.equal(invalid.error.code, ErrorCode.ADAPTER_CONTRACT_VIOLATION);
    }
  },
);

test(
  'instant validation rejects impossible calendar dates and implicit/local offsets',
  () => {
    assert.equal(validInstant('2026-02-30T12:00:00Z'), false);
    assert.equal(validInstant('2026-10-14T24:00:00Z'), false);
    assert.equal(validInstant('2026-10-14T12:00:00'), false);
    assert.equal(validInstant('2024-02-29T12:00:00+03:00'), true);
  },
);
