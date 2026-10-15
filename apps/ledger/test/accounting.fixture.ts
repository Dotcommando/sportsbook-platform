import assert from 'node:assert/strict';

import type { Pool } from 'pg';

import { fixtureUuid as randomUUID } from './fixed-id.fixture.js';

export async function verifyAccountingFixture(owner: Pool, runtime: Pool): Promise<void> {
  const operatorId = randomUUID();
  const accounts = new Map<string, string>();
  const walletId = randomUUID();
  const now = '2026-10-14T00:00:00.000Z';
  let nextEntry = 0;

  await owner.query(
    'INSERT INTO wallets VALUES ($1,$2,$3,$4,$5,$6,$6)',
    [walletId, operatorId, randomUUID(), 'EUR', 'ACTIVE', now],
  );

  for (const kind of ['AVAILABLE', 'RESERVED', 'WITHDRAWAL_HOLD', 'CLEARING', 'REVENUE', 'EXPENSE']) {
    const id = randomUUID();
    const normal = ['CLEARING', 'EXPENSE'].includes(kind) ? 'DEBIT' : 'CREDIT';

    accounts.set(kind, id);
    await owner.query(
      'INSERT INTO ledger_accounts VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        id,
        operatorId,
        ['AVAILABLE', 'RESERVED', 'WITHDRAWAL_HOLD'].includes(kind) ? walletId : null,
        'EUR',
        kind,
        normal,
        'ACTIVE',
        now,
      ],
    );
    await owner.query('INSERT INTO ledger_account_balances VALUES ($1,$2,0,1,$3)', [id, operatorId, now]);
  }
  const posting = async (type: string, lines: { kind: string; side: string; amount: bigint }[]): Promise<void> => {
    const client = await runtime.connect();
    const transactionId = randomUUID();
    const header = {
      operatorId,
      transactionId,
      requestId: randomUUID(),
      transactionType: type,
      businessRef: randomUUID(),
      currency: 'EUR',
      status: 'POSTED',
      postedAt: now,
      correlationId: randomUUID(),
    };
    const entries = lines.map(
      line =>
        ({
          entryId: randomUUID(),
          accountId: accounts.get(line.kind),
          currency: 'EUR',
          side: line.side,
          amount: line.amount.toString(),
          entryNo: ++nextEntry,
        }),
    );

    try {
      await client.query('BEGIN');

      for (const line of lines) {
        const sign = (['CLEARING', 'EXPENSE'].includes(line.kind) ? 'DEBIT' : 'CREDIT') === line.side ? 1n : -1n;

        await client.query(
          'UPDATE ledger_account_balances SET balance_minor=balance_minor+$1,version=version+1,updated_at=$2 WHERE account_id=$3 AND operator_id=$4',
          [(sign * line.amount).toString(), now, accounts.get(line.kind), operatorId],
        );
      }
      await client.query(
        'SELECT public.ledger_append_posting($1::jsonb,$2::jsonb)',
        [JSON.stringify(header), JSON.stringify(entries)],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  const move = async (type: string, from: string, to: string, amount: bigint): Promise<void> =>
    posting(type, [{ kind: from, side: 'DEBIT', amount }, { kind: to, side: 'CREDIT', amount }]);

  await move('DEPOSIT', 'CLEARING', 'AVAILABLE', 10000n);
  await move('RESERVE_STAKE', 'AVAILABLE', 'RESERVED', 2000n);
  await posting(
    'SETTLE_WIN',
    [
      { kind: 'RESERVED', side: 'DEBIT', amount: 2000n },
      { kind: 'EXPENSE', side: 'DEBIT', amount: 3000n },
      { kind: 'AVAILABLE', side: 'CREDIT', amount: 5000n },
    ],
  );
  const balance = async (kind: string): Promise<bigint> => {
    const result = await runtime.query<{ balance_minor: string }>(
      'SELECT balance_minor FROM ledger_account_balances WHERE account_id=$1',
      [accounts.get(kind)],
    );

    assert.ok(result.rows[0]);

    return BigInt(result.rows[0].balance_minor);
  };

  assert.equal(await balance('AVAILABLE'), 13000n);
  assert.equal(await balance('RESERVED'), 0n);
  await move('RESERVE_STAKE', 'AVAILABLE', 'RESERVED', 2000n);
  await move('SETTLE_LOSS', 'RESERVED', 'REVENUE', 2000n);
  assert.equal(await balance('AVAILABLE'), 11000n);
  await move('RESERVE_STAKE', 'AVAILABLE', 'RESERVED', 2000n);
  await move('CANCEL_RESERVATION', 'RESERVED', 'AVAILABLE', 2000n);
  assert.equal(await balance('AVAILABLE'), 11000n);
  await move('WITHDRAWAL_HOLD', 'AVAILABLE', 'WITHDRAWAL_HOLD', 1000n);
  await move('WITHDRAWAL_COMPLETE', 'WITHDRAWAL_HOLD', 'CLEARING', 1000n);
  await move('WITHDRAWAL_HOLD', 'AVAILABLE', 'WITHDRAWAL_HOLD', 1000n);
  await move('WITHDRAWAL_REJECT', 'WITHDRAWAL_HOLD', 'AVAILABLE', 1000n);
  assert.equal(await balance('AVAILABLE'), 10000n);
  assert.equal(await balance('WITHDRAWAL_HOLD'), 0n);
  const reconcile =
    async (): Promise<number> => {
      const result =
        await runtime.query(
          `SELECT b.account_id FROM ledger_account_balances b JOIN ledger_accounts a USING (account_id,operator_id)
      LEFT JOIN ledger_entries e USING (account_id,operator_id) WHERE b.operator_id=$1 GROUP BY b.account_id,b.balance_minor,a.normal_side
      HAVING b.balance_minor <> COALESCE(sum(CASE WHEN e.side=a.normal_side THEN e.amount_minor ELSE -e.amount_minor END),0)`,
          [operatorId],
        );

      return result.rows.length;
    };

  assert.equal(await reconcile(), 0);
  await assert.rejects(
    move('RESERVE_STAKE', 'AVAILABLE', 'RESERVED', 10001n),
    /Invalid posting accounts/,
  );
  assert.equal(await balance('AVAILABLE'), 10000n, 'Rejected posting rolls projections back');
  await assert.rejects(
    posting(
      'DEPOSIT',
      [
        { kind: 'CLEARING', side: 'DEBIT', amount: 2n },
        { kind: 'AVAILABLE', side: 'CREDIT', amount: 1n },
      ],
    ),
    /Unbalanced posting/,
  );

  for (const table of ['ledger_transactions', 'ledger_entries']) {
    await assert.rejects(
      runtime.query(`UPDATE ${table} SET operator_id=$1`, [operatorId]),
      /permission denied/,
    );
    await assert.rejects(runtime.query(`DELETE FROM ${table}`), /permission denied/);
    await assert.rejects(runtime.query(`TRUNCATE ${table}`), /permission denied/);
  }
  await owner.query(
    'UPDATE ledger_account_balances SET balance_minor=balance_minor+1 WHERE account_id=$1',
    [accounts.get('AVAILABLE')],
  );
  assert.equal(await reconcile(), 1, 'Independent SQL detects corrupted projection');
  await owner.query(
    'UPDATE ledger_account_balances SET balance_minor=balance_minor-1 WHERE account_id=$1',
    [accounts.get('AVAILABLE')],
  );
  assert.equal(await reconcile(), 0);
  console.log(
    'Ledger SQL fixture: every movement balanced, rollback, immutability and independent corruption detection passed.',
  );
}
