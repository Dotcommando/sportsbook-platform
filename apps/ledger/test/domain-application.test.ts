import assert from 'node:assert/strict';
import test from 'node:test';

import { CommandFingerprint } from '../src/adapters/outbound/ids/command-fingerprint.js';
import { UuidGenerator } from '../src/adapters/outbound/ids/uuid-generator.js';
import type { ILedgerCommandDependencies } from '../src/app/services/financial-command.service.js';
import { CancelBetUseCase } from '../src/app/use-cases/cancel-bet.use-case.js';
import { CompleteWithdrawalUseCase } from '../src/app/use-cases/complete-withdrawal.use-case.js';
import { CreateWalletUseCase } from '../src/app/use-cases/create-wallet.use-case.js';
import { DepositTestFundsUseCase } from '../src/app/use-cases/deposit-test-funds.use-case.js';
import { GetBalanceUseCase } from '../src/app/use-cases/get-balance.use-case.js';
import { GetCommandOutcomeUseCase } from '../src/app/use-cases/get-command-outcome.use-case.js';
import { GetLedgerEntriesUseCase } from '../src/app/use-cases/get-ledger-entries.use-case.js';
import { ReconcileLedgerUseCase } from '../src/app/use-cases/reconcile-ledger.use-case.js';
import { RejectWithdrawalUseCase } from '../src/app/use-cases/reject-withdrawal.use-case.js';
import { RequestWithdrawalUseCase } from '../src/app/use-cases/request-withdrawal.use-case.js';
import { ReserveStakeUseCase } from '../src/app/use-cases/reserve-stake.use-case.js';
import { SettleLossUseCase } from '../src/app/use-cases/settle-loss.use-case.js';
import { SettleWinUseCase } from '../src/app/use-cases/settle-win.use-case.js';
import { Currency } from '../src/domain/currency.js';
import { MAX_INT64 } from '../src/domain/ledger.error.js';
import type { ICallContext, IOperatorFinancialPolicy } from '../src/domain/ledger.model.js';
import {
  ActorKind,
  AuditState,
  Capability,
  ErrorCode,
  RefundReason,
  ReservationState,
  WithdrawalState,
} from '../src/domain/ledger.model.js';
import { Money } from '../src/domain/money.js';
import { ReservationPolicy } from '../src/domain/reservation.policy.js';
import { WithdrawalPolicy } from '../src/domain/withdrawal.policy.js';
import { fixtureUuid as randomUUID } from './fixed-id.fixture.js';
import { MemoryFault, MemoryLedger } from './memory-ledger.fixture.js';

const now = '2026-10-14T12:00:00.000Z';

const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const clock = { now: (): string => now };

async function fixture(): Promise<{
  dependencies: ILedgerCommandDependencies;
  store: MemoryLedger;
  system: ICallContext;
  betting: ICallContext;
  player: ICallContext;
  walletId: string
}> {
  const ids = new UuidGenerator(namespace);
  const operatorId = randomUUID();
  const playerId = randomUUID();
  const system: ICallContext = {
    operatorId,
    actorId: randomUUID(),
    actorKind: ActorKind.SYSTEM,
    capabilities: Object.values(Capability),
    correlationId: randomUUID(),
    deadlineAt: '2026-10-14T13:00:00.000Z',
  };
  const betting: ICallContext = {
    ...system,
    actorId: randomUUID(),
    actorKind: ActorKind.SERVICE,
    playerId,
    capabilities: [Capability.RESERVE_STAKE, Capability.SETTLE_BET, Capability.CANCEL_RESERVATION],
  };
  const player: ICallContext = {
    ...system,
    actorId: playerId,
    actorKind: ActorKind.PLAYER,
    playerId,
    capabilities: [Capability.READ_WALLET, Capability.READ_JOURNAL, Capability.WITHDRAW],
  };
  const policy: IOperatorFinancialPolicy = {
    operatorId,
    currencies: [{ currency: 'USD', minimumMinor: 1n, maximumMinor: MAX_INT64 }],
    providerNames: ['synthetic'],
    rejectionReasons: ['PAYMENT_REJECTED'],
    trustedActors: [{ ...system, providerName: 'synthetic' }, betting],
  };
  const store = new MemoryLedger(ids, now);
  const dependencies: ILedgerCommandDependencies =
    {
      unitOfWork:
      store,
      ids,
      clock,
      fingerprint:
      new CommandFingerprint(),
      policies:
      [
        policy,
      ],
    };
  const created = await new CreateWalletUseCase(dependencies).execute(
    { context: system, requestId: randomUUID(), playerId, currency: 'USD' },
  );

  assert.ok(created.ok);
  const walletId = created.value.wallet.walletId;
  const deposit = await new DepositTestFundsUseCase(dependencies).execute(
    {
      context: system,
      requestId: randomUUID(),
      walletId,
      amount: { amountMinor: 10000n, currency: 'USD' },
      providerRef: 'synthetic:fixture',
    },
  );

  assert.ok(deposit.ok);

  return { dependencies, store, system, betting, player, walletId };
}

test(
  'currency and exact minor-unit arithmetic reject mismatch and int64 overflow',
  () => {
    const usd = Currency.parse('USD', ['USD']);
    const eur = Currency.parse('EUR', ['EUR']);

    assert.ok(usd.ok && eur.ok);
    const amount = Money.create(10000n, usd.value);
    const top = Money.create(MAX_INT64, usd.value);
    const one = Money.create(1n, usd.value);
    const other = Money.create(1n, eur.value);

    assert.ok(amount.ok && top.ok && one.ok && other.ok);
    assert.equal(amount.value.toMinorUnits(), 10000n);
    assert.equal(top.value.add(one.value).ok, false);
    assert.equal(amount.value.add(other.value).ok, false);
    assert.equal(Currency.parse('usd', ['USD']).ok, false);
  },
);

test(
  'UUIDv5 is scoped, stable across instances, purpose/currency-sensitive; hash ignores retry metadata',
  () => {
    const ids = new UuidGenerator(namespace);
    const other = new UuidGenerator(namespace);
    const op = randomUUID();
    const requestId = randomUUID();

    assert.equal(
      ids.derive(op, requestId, 'provision-wallet:USD'),
      other.derive(op, requestId, 'provision-wallet:USD'),
    );
    assert.notEqual(
      ids.derive(op, requestId, 'provision-wallet:USD'),
      ids.derive(op, requestId, 'provision-wallet:EUR'),
    );
    assert.notEqual(
      ids.derive(op, requestId, 'transaction'),
      ids.derive(randomUUID(), requestId, 'transaction'),
    );
    assert.match(ids.derive(op, requestId, 'transaction'), /^[0-9a-f-]{14}5/);
    assert.throws(() => new UuidGenerator(''), /namespace/);
    const context: ICallContext = {
      operatorId: op,
      actorId: randomUUID(),
      actorKind: ActorKind.SYSTEM,
      capabilities: [Capability.CREATE_WALLET],
      correlationId: randomUUID(),
      deadlineAt: now,
    };
    const input = { context, requestId, playerId: randomUUID(), currency: 'USD' };
    const hash = new CommandFingerprint();

    assert.equal(
      hash.hash('CreateWallet', input),
      hash.hash(
        'CreateWallet',
        {
          ...input,
          context: { ...context, correlationId: randomUUID(), deadlineAt: '2026-10-15T00:00:00Z' },
        },
      ),
    );
    assert.notEqual(
      hash.hash('CreateWallet', input),
      hash.hash('CreateWallet', { ...input, currency: 'EUR' }),
    );
  },
);

test(
  'reserve and win post gross payout once; changed payload conflicts; readers never settle',
  async () => {
    const f = await fixture();
    const betId = randomUUID();
    const requestId = randomUUID();
    const reserve = await new ReserveStakeUseCase(f.dependencies).execute(
      {
        context: f.betting,
        requestId: randomUUID(),
        walletId: f.walletId,
        betId,
        stake: { amountMinor: 2000n, currency: 'USD' },
      },
    );

    assert.ok(reserve.ok);
    const input = {
      context: f.betting,
      requestId,
      betId,
      settlementSeq: 1n,
      grossPayout: { amountMinor: 5000n, currency: 'USD' },
    };
    const win = await new SettleWinUseCase(f.dependencies).execute(input);

    assert.ok(win.ok);
    assert.equal(win.value.outcome.wallet.availableMinor, 13000n);
    assert.equal(win.value.outcome.wallet.reservedMinor, 0n);
    const count = f.store.state.journals.size;
    const replay = await new SettleWinUseCase(f.dependencies).execute(
      { ...input, context: { ...f.betting, correlationId: randomUUID() } },
    );

    assert.ok(replay.ok);
    assert.equal(replay.value.outcome.replayed, true);
    assert.equal(f.store.state.journals.size, count);
    const changed = await new SettleWinUseCase(f.dependencies).execute(
      { ...input, grossPayout: { amountMinor: 6000n, currency: 'USD' } },
    );

    assert.equal(changed.ok, false);

    if (!changed.ok) {
      assert.equal(changed.error.code, ErrorCode.IDEMPOTENCY_CONFLICT);
    }

    const readDeps = { queries: f.store, reconciliation: f.store, clock, policies: f.dependencies.policies };

    assert.ok(
      (await new GetBalanceUseCase(readDeps).execute({ context: f.player, walletId: f.walletId })).ok,
    );
    assert.ok(
      (await new GetLedgerEntriesUseCase(readDeps).execute(
        { context: f.player, walletId: f.walletId, page: { limit: 2 } },
      )).ok,
    );
    assert.equal(f.store.state.journals.size, count);
    const reconciliation = await new ReconcileLedgerUseCase(readDeps).execute(
      {
        context: f.system,
        requestId: randomUUID(),
        runId: randomUUID(),
        cutoff: now,
        page: { limit: 1 },
      },
    );

    assert.ok(reconciliation.ok);
    assert.equal(reconciliation.value.report.status, AuditState.PASS);
  },
);

test(
  'insufficient funds, unauthorized actor, foreign owner and settled cancellation make no financial changes',
  async () => {
    const f = await fixture();
    const reserve = new ReserveStakeUseCase(f.dependencies);
    const count = f.store.state.journals.size;
    const input = {
      context: f.betting,
      requestId: randomUUID(),
      walletId: f.walletId,
      betId: randomUUID(),
      stake: { amountMinor: 10001n, currency: 'USD' },
    };
    const insufficient = await reserve.execute(input);

    assert.equal(insufficient.ok, false);

    if (!insufficient.ok) {
      assert.equal(insufficient.error.code, ErrorCode.INSUFFICIENT_FUNDS);
    }
    assert.equal(f.store.state.journals.size, count);
    const unauthorized = await reserve.execute(
      { ...input, requestId: randomUUID(), context: { ...f.betting, actorId: randomUUID() } },
    );

    assert.equal(unauthorized.ok, false);

    if (!unauthorized.ok) {
      assert.equal(unauthorized.error.code, ErrorCode.PERMISSION_DENIED);
    }

    const foreign = await reserve.execute(
      { ...input, requestId: randomUUID(), context: { ...f.betting, playerId: randomUUID() } },
    );

    assert.equal(foreign.ok, false);

    if (!foreign.ok) {
      assert.equal(foreign.error.code, ErrorCode.NOT_FOUND);
    }

    const betId = randomUUID();

    assert.ok(
      (await reserve.execute(
        { ...input, requestId: randomUUID(), betId, stake: { amountMinor: 2000n, currency: 'USD' } },
      )).ok,
    );
    assert.ok(
      (await new SettleLossUseCase(f.dependencies).execute(
        { context: f.betting, requestId: randomUUID(), betId, settlementSeq: 1n },
      )).ok,
    );
    const cancel = await new CancelBetUseCase(f.dependencies).execute(
      { context: f.betting, requestId: randomUUID(), betId, reasonCode: RefundReason.VOID },
    );

    assert.equal(cancel.ok, false);

    if (!cancel.ok) {
      assert.equal(cancel.error.code, ErrorCode.INVALID_STATE);
    }
  },
);

test(
  'void/acceptance compensation releases stake; withdrawal resolution is exclusive',
  async () => {
    const f = await fixture();
    const betId = randomUUID();

    assert.ok(
      (await new ReserveStakeUseCase(f.dependencies).execute(
        {
          context: f.betting,
          requestId: randomUUID(),
          walletId: f.walletId,
          betId,
          stake: { amountMinor: 2000n, currency: 'USD' },
        },
      )).ok,
    );
    const canceled = await new CancelBetUseCase(f.dependencies).execute(
      {
        context: f.betting,
        requestId: randomUUID(),
        betId,
        reasonCode: RefundReason.ACCEPTANCE_FAILED,
      },
    );

    assert.ok(canceled.ok);
    assert.equal(canceled.value.outcome.wallet.availableMinor, 10000n);
    const withdrawalId = randomUUID();

    assert.ok(
      (await new RequestWithdrawalUseCase(f.dependencies).execute(
        {
          context: f.player,
          requestId: randomUUID(),
          walletId: f.walletId,
          withdrawalId,
          amount: { amountMinor: 1000n, currency: 'USD' },
        },
      )).ok,
    );
    const completed = await new CompleteWithdrawalUseCase(f.dependencies).execute(
      { context: f.system, requestId: randomUUID(), withdrawalId, providerRef: 'synthetic:payment' },
    );

    assert.ok(completed.ok);
    assert.equal(completed.value.outcome.wallet.availableMinor, 9000n);
    assert.equal(completed.value.outcome.wallet.withdrawalHoldMinor, 0n);
    assert.equal(
      (await new RejectWithdrawalUseCase(f.dependencies).execute(
        { context: f.system, requestId: randomUUID(), withdrawalId, reasonCode: 'PAYMENT_REJECTED' },
      )).ok,
      false,
    );
    const heldId = randomUUID();

    assert.ok(
      (await new RequestWithdrawalUseCase(f.dependencies).execute(
        {
          context: f.player,
          requestId: randomUUID(),
          walletId: f.walletId,
          withdrawalId: heldId,
          amount: { amountMinor: 1000n, currency: 'USD' },
        },
      )).ok,
    );
    const rejected = await new RejectWithdrawalUseCase(f.dependencies).execute(
      {
        context: f.system,
        requestId: randomUUID(),
        withdrawalId: heldId,
        reasonCode: 'PAYMENT_REJECTED',
      },
    );

    assert.ok(rejected.ok);
    assert.equal(rejected.value.outcome.wallet.availableMinor, 9000n);
  },
);

test(
  'precommit rollback and lost postcommit reply preserve original command outcome and stable IDs',
  async () => {
    const f = await fixture();
    const reserve = new ReserveStakeUseCase(f.dependencies);
    const requestId = randomUUID();
    const betId = randomUUID();
    const input = {
      context: f.betting,
      requestId,
      walletId: f.walletId,
      betId,
      stake: { amountMinor: 1000n, currency: 'USD' },
    };
    const count = f.store.state.journals.size;

    f.store.fault = MemoryFault.BEFORE_COMMIT;
    assert.equal((await reserve.execute(input)).ok, false);
    assert.equal(f.store.state.journals.size, count);
    f.store.fault = MemoryFault.AFTER_COMMIT;
    const unknown = await reserve.execute(input);

    assert.equal(unknown.ok, false);

    if (!unknown.ok) {
      assert.equal(unknown.error.outcomeUnknown, true);
    }
    assert.equal(f.store.state.journals.size, count + 1);
    const readDeps = { queries: f.store, reconciliation: f.store, clock, policies: f.dependencies.policies };
    const recovered = await new GetCommandOutcomeUseCase(readDeps).execute({ context: f.betting, requestId });

    assert.ok(recovered.ok && recovered.value.found);
    const replay = await reserve.execute(input);

    assert.ok(replay.ok);
    assert.equal(replay.value.outcome.replayed, true);
    assert.equal(f.store.state.journals.size, count + 1);
    const stored = f.store.state.commands.get(f.betting.operatorId + ':' + requestId);

    assert.ok(stored);
    assert.deepEqual(stored.semanticInput, input);
    assert.ok(stored.stableChildIds.length >= 3);
  },
);

test(
  'domain transitions reject incompatible terminal resolution and forbidden amount combinations',
  () => {
    const reservation = {
      betId: randomUUID(),
      walletId: randomUUID(),
      stake: { currency: 'USD', amountMinor: 2000n },
      state: ReservationState.RESERVED,
      reservationTransactionId: randomUUID(),
    };

    assert.equal(
      ReservationPolicy.settle(reservation, ReservationState.WON, randomUUID(), 1999n, 1n).ok,
      false,
    );
    const lost = ReservationPolicy.settle(reservation, ReservationState.LOST, randomUUID(), 0n, 1n);

    assert.ok(lost.ok);
    assert.equal(
      ReservationPolicy.settle(lost.value, ReservationState.CANCELED, randomUUID(), 2000n).ok,
      false,
    );
    const withdrawal = {
      withdrawalId: randomUUID(),
      walletId: randomUUID(),
      amount: { currency: 'USD', amountMinor: 1000n },
      state: WithdrawalState.HELD,
      holdTransactionId: randomUUID(),
      createdAt: now,
    };
    const complete = WithdrawalPolicy.resolve(
      withdrawal,
      WithdrawalState.COMPLETED,
      randomUUID(),
      now,
      'synthetic:payment',
    );

    assert.ok(complete.ok);
    assert.equal(
      WithdrawalPolicy.resolve(
        complete.value,
        WithdrawalState.REJECTED,
        randomUUID(),
        now,
        'PAYMENT_REJECTED',
      ).ok,
      false,
    );
  },
);
