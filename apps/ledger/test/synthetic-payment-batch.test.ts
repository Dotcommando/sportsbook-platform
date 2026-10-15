import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SyntheticPaymentClient } from '../src/adapters/outbound/clients/synthetic-payment.client.js';
import { CommandFingerprint } from '../src/adapters/outbound/ids/command-fingerprint.js';
import { RunSyntheticPaymentBatchUseCase } from '../src/app/use-cases/run-synthetic-payment-batch.use-case.js';
import type { IOperatorFinancialPolicy } from '../src/domain/ledger.model.js';
import { ActorKind, ErrorCode, WithdrawalState } from '../src/domain/ledger.model.js';
import type { CompleteWithdrawalPort } from '../src/ports/inbound/ledger-operations.port.js';
import { transportFixture } from './transport.fixture.js';

async function fixture(reject = false, loseReply = false): Promise<{
  f: ReturnType<typeof transportFixture>;
  worker: RunSyntheticPaymentBatchUseCase;
  withdrawalId: string;
  walletId: string;
  now: string;
}> {
  const now = '2026-10-15T12:00:00.000Z';
  const f = transportFixture(now);
  const id = (purpose: string): string => f.ids.derive(f.system.operatorId, f.playerId, purpose);
  const created = await f.operations.createWallet.execute(
    { context: f.system, requestId: id('create'), playerId: f.playerId, currency: 'USD' },
  );

  assert.ok(created.ok);
  const walletId = created.value.wallet.walletId;

  assert.ok(
    (await f.operations.depositTestFunds.execute(
      {
        context: f.system,
        requestId: id('fund'),
        walletId,
        amount: { amountMinor: 10000n, currency: 'USD' },
        providerRef: 'synthetic:batch-fund',
      },
    )).ok,
  );
  const withdrawalId = id('withdrawal');

  assert.ok(
    (await f.operations.requestWithdrawal.execute(
      {
        context: f.player,
        requestId: id('hold'),
        withdrawalId,
        walletId,
        amount: { amountMinor: 1000n, currency: 'USD' },
      },
    )).ok,
  );
  const policies: IOperatorFinancialPolicy[] = [
    {
      operatorId: f.system.operatorId,
      currencies: [{ currency: 'USD', minimumMinor: 1n, maximumMinor: 9223372036854775807n }],
      providerNames: ['synthetic'],
      rejectionReasons: ['PAYMENT_REJECTED'],
      trustedActors: [{ ...f.system, providerName: 'synthetic' }, f.betting],
    },
  ];
  let lost = loseReply;
  const complete: CompleteWithdrawalPort = {
    execute: async (input) => {
      const result = await f.operations.completeWithdrawal.execute(input);

      if (result.ok && lost) {
        lost = false;

        return {
          ok: false,
          error: {
            code: ErrorCode.DEPENDENCY_UNAVAILABLE,
            message: 'DEPENDENCY_UNAVAILABLE',
            correlationId: input.context.correlationId,
            retryable: true,
            outcomeUnknown: true,
          },
        };
      }

      return result;
    },
  };
  const worker = new RunSyntheticPaymentBatchUseCase(
    {
      unitOfWork: f.store,
      clock: { now: () => now },
      ids: f.ids,
      fingerprint: new CommandFingerprint(),
      policies,
    },
    new SyntheticPaymentClient(
      {
        seed: '42',
        rejectionsPerMillion: reject ? 1000000 : 0,
        rejectionReason: 'PAYMENT_REJECTED',
        providers: [{ operatorId: f.system.operatorId, actorId: f.system.actorId, name: 'synthetic' }],
      },
    ),
    complete,
    f.operations.rejectWithdrawal,
  );

  return { f, worker, withdrawalId, walletId, now };
}

for (const reject of [false, true]) {
  test(
    'synthetic payment batch has one terminal effect and safe repeat: '
    + (reject ? 'reject' : 'complete'),
    async () => {
      const { f, worker, withdrawalId, walletId, now } = await fixture(reject);
      const input = {
        context: f.system,
        batchId: f.ids.derive(f.system.operatorId, withdrawalId, 'batch'),
        limit: 1,
        cutoff: now,
      };
      const result = await worker.execute(input);

      assert.ok(result.ok);
      assert.equal(reject ? result.value.rejected : result.value.applied, 1);
      const again = await worker.execute(input);

      assert.ok(again.ok);
      assert.equal(again.value.selected, 0);
      assert.equal(f.store.state.journals.size, 3);
      assert.equal(
        (await f.store.getWithdrawal(f.system, withdrawalId))?.state,
        reject ? WithdrawalState.REJECTED : WithdrawalState.COMPLETED,
      );
      const balance = await f.store.getBalance(f.system, walletId);

      assert.equal(balance?.withdrawalHoldMinor, 0n);
      assert.equal(balance?.availableMinor, reject ? 10000n : 9000n);
    },
  );
}

test(
  'unknown reply after payment commit remains observable without another posting after restart',
  async () => {
    const { f, worker, withdrawalId, now } = await fixture(false, true);
    const input = {
      context: f.system,
      batchId: f.ids.derive(f.system.operatorId, withdrawalId, 'batch'),
      limit: 20,
      cutoff: now,
    };
    const first = await worker.execute(input);

    assert.ok(first.ok);
    assert.equal(first.value.pending, 1);
    const resumed = await worker.execute(
      { ...input, batchId: f.ids.derive(f.system.operatorId, withdrawalId, 'restart') },
    );

    assert.ok(resumed.ok);
    assert.equal(resumed.value.selected, 0);
    assert.equal(f.store.state.journals.size, 3);
    assert.equal(
      (await f.store.getWithdrawal(f.system, withdrawalId))?.state,
      WithdrawalState.COMPLETED,
    );
  },
);

test(
  'payment batch rejects player/foreign actor and invalid bounds before effects',
  async () => {
    const { f, worker, withdrawalId, now } = await fixture();
    const input = {
      context: f.system,
      batchId: f.ids.derive(f.system.operatorId, withdrawalId, 'batch'),
      limit: 20,
      cutoff: now,
    };

    assert.equal(
      (await worker.execute(
        {
          ...input,
          context: { ...f.system, actorKind: ActorKind.PLAYER, actorId: f.playerId, playerId: f.playerId },
        },
      )).ok,
      false,
    );
    assert.equal(
      (await worker.execute({ ...input, context: { ...f.system, actorId: withdrawalId } })).ok,
      false,
    );
    assert.equal((await worker.execute({ ...input, limit: 201 })).ok, false);
    assert.equal(f.store.state.journals.size, 2);
  },
);
