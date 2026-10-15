import { Pool } from 'pg';

import { AuditStatus, ServiceName } from './experiment.model.js';

export interface IFinancialReconciliation {
  runId: string;
  snapshotAt: string;
  status: AuditStatus;
  counts: {
    transactions: string;
    entries: string;
    violations: string;
  };
  violations: {
    code: string;
    businessRef?: string;
  }[];
}

const ledgerChecks: readonly [
  string,
  string,
][] = [
  [
    'UNBALANCED_TRANSACTION',
    "SELECT t.ledger_transaction_id::text AS ref FROM ledger_transactions t LEFT JOIN ledger_entries e USING(operator_id,ledger_transaction_id) GROUP BY t.ledger_transaction_id HAVING (t.status='POSTED' AND (count(e.ledger_entry_id)<2 OR coalesce(sum(CASE WHEN e.side='DEBIT' THEN e.amount_minor ELSE -e.amount_minor END),0)<>0 OR bool_or(e.currency<>t.currency))) OR (t.status<>'POSTED' AND count(e.ledger_entry_id)>0)",
  ],
  [
    'ENTRY_REFERENCE',
    "SELECT e.ledger_entry_id::text AS ref FROM ledger_entries e LEFT JOIN ledger_transactions t USING(operator_id,ledger_transaction_id) LEFT JOIN ledger_accounts a USING(operator_id,account_id) WHERE t.ledger_transaction_id IS NULL OR a.account_id IS NULL OR t.status<>'POSTED' OR e.currency<>t.currency OR e.currency<>a.currency OR e.posted_at<>t.posted_at",
  ],
  [
    'PROJECTION_MISMATCH',
    'SELECT a.account_id::text AS ref FROM ledger_accounts a LEFT JOIN ledger_account_balances b USING(operator_id,account_id) LEFT JOIN ledger_entries e USING(operator_id,account_id) GROUP BY a.account_id,b.balance_minor HAVING b.balance_minor IS NULL OR b.balance_minor<>coalesce(sum(CASE WHEN e.side=a.normal_side THEN e.amount_minor ELSE -e.amount_minor END),0) OR (a.wallet_id IS NOT NULL AND b.balance_minor<0)',
  ],
  [
    'PROJECTION_REFERENCE',
    'SELECT b.account_id::text AS ref FROM ledger_account_balances b LEFT JOIN ledger_accounts a USING(operator_id,account_id) WHERE a.account_id IS NULL',
  ],
  [
    'WALLET_REFERENCE',
    'SELECT a.account_id::text AS ref FROM ledger_accounts a LEFT JOIN wallets w USING(operator_id,wallet_id) WHERE a.wallet_id IS NOT NULL AND (w.wallet_id IS NULL OR w.currency<>a.currency)',
  ],
  [
    'WALLET_ACCOUNT_INVENTORY',
    "SELECT w.wallet_id::text AS ref FROM wallets w LEFT JOIN ledger_accounts a USING(operator_id,wallet_id) GROUP BY w.wallet_id HAVING count(*) FILTER(WHERE a.account_kind IN ('AVAILABLE','RESERVED','WITHDRAWAL_HOLD'))<>3",
  ],
  [
    'RESERVE_LIABILITY',
    "SELECT a.account_id::text AS ref FROM ledger_accounts a JOIN ledger_account_balances b USING(operator_id,account_id) WHERE a.account_kind='RESERVED' AND b.balance_minor<>(SELECT coalesce(sum(r.stake_minor),0) FROM ledger_bet_reservations r WHERE r.operator_id=a.operator_id AND r.wallet_id=a.wallet_id AND r.status='RESERVED')",
  ],
  [
    'WITHDRAWAL_LIABILITY',
    "SELECT a.account_id::text AS ref FROM ledger_accounts a JOIN ledger_account_balances b USING(operator_id,account_id) WHERE a.account_kind='WITHDRAWAL_HOLD' AND b.balance_minor<>(SELECT coalesce(sum(w.amount_minor),0) FROM ledger_withdrawals w WHERE w.operator_id=a.operator_id AND w.wallet_id=a.wallet_id AND w.status='HELD')",
  ],
  [
    'DUPLICATE_COMMAND',
    'SELECT min(ledger_transaction_id::text) AS ref FROM ledger_transactions GROUP BY operator_id,request_id HAVING count(*)>1',
  ],
  [
    'INCOMPLETE_COMMAND',
    "SELECT request_id::text AS ref FROM ledger_idempotency_records WHERE state='IN_PROGRESS' OR response_snapshot IS NULL",
  ],
  [
    'WITHDRAWAL_REFERENCE',
    "SELECT r.withdrawal_id::text AS ref FROM ledger_withdrawals r LEFT JOIN wallets w USING(operator_id,wallet_id) LEFT JOIN ledger_transactions h ON h.operator_id=r.operator_id AND h.ledger_transaction_id=r.hold_transaction_id LEFT JOIN ledger_transactions t ON t.operator_id=r.operator_id AND t.ledger_transaction_id=r.completion_transaction_id WHERE w.wallet_id IS NULL OR w.currency<>r.currency OR h.transaction_type IS DISTINCT FROM 'WITHDRAWAL_HOLD' OR h.currency<>r.currency OR (r.status='HELD' AND r.completion_transaction_id IS NOT NULL) OR (r.status='COMPLETED' AND (t.transaction_type IS DISTINCT FROM 'WITHDRAWAL_COMPLETE' OR r.provider_ref IS NULL)) OR (r.status='REJECTED' AND (t.transaction_type IS DISTINCT FROM 'WITHDRAWAL_REJECT' OR r.reason_code IS NULL))",
  ],
  [
    'RESERVATION_REFERENCE',
    "SELECT r.bet_id::text AS ref FROM ledger_bet_reservations r LEFT JOIN wallets w USING(operator_id,wallet_id) LEFT JOIN ledger_transactions h ON h.operator_id=r.operator_id AND h.ledger_transaction_id=r.reservation_transaction_id LEFT JOIN ledger_transactions t ON t.operator_id=r.operator_id AND t.ledger_transaction_id=r.settlement_transaction_id WHERE w.wallet_id IS NULL OR w.currency<>r.currency OR h.transaction_type IS DISTINCT FROM 'RESERVE_STAKE' OR h.business_ref<>r.bet_id::text OR h.currency<>r.currency OR (r.status='RESERVED' AND r.settlement_transaction_id IS NOT NULL) OR (r.status='WON' AND (t.transaction_type IS DISTINCT FROM 'SETTLE_WIN' OR r.gross_payout_minor<r.stake_minor)) OR (r.status='LOST' AND (t.transaction_type IS DISTINCT FROM 'SETTLE_LOSS' OR r.gross_payout_minor<>0)) OR (r.status='CANCELED' AND (t.transaction_type IS DISTINCT FROM 'CANCEL_RESERVATION' OR r.gross_payout_minor<>r.stake_minor))",
  ],
];

export async function reconcile(
  run: {
    databaseUrls: ReadonlyMap<ServiceName, string>;
    manifest: {
      runId: string;
    };
  },
): Promise<IFinancialReconciliation> {
  const ledgerUrl = run.databaseUrls.get(ServiceName.LEDGER);
  const bettingUrl = run.databaseUrls.get(ServiceName.BETTING);

  if (!ledgerUrl || !bettingUrl) {
    throw new Error('Owned databases required for independent audit');
  }

  const ledger = new Pool({ connectionString: ledgerUrl, max: 1, options: '-c statement_timeout=30000' });
  const betting = new Pool({ connectionString: bettingUrl, max: 1, options: '-c statement_timeout=30000' });
  const violations: {
    code: string;
    businessRef?: string;
  }[] = [];
  let total = 0n;

  try {
    await ledger.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await betting.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    for (const [code, sql] of ledgerChecks) {
      const counts = await ledger.query<{
        count: string;
      }>(
        'SELECT count(*)::text AS count FROM (' + sql + ') invalid',
      );

      total += BigInt(counts.rows[0]?.count ?? '0');
      const detail = await ledger.query<{
        ref: string;
      }>(
        'SELECT ref FROM (' + sql + ') invalid ORDER BY ref LIMIT 20',
      );

      for (const row of detail.rows) {
        violations.push({ code, businessRef: row.ref });
      }
    }
    const unfinished = await betting.query<{
      count: string;
    }>(
      "SELECT count(*)::text AS count FROM bet_commands WHERE state='IN_PROGRESS' OR response_snapshot IS NULL",
    );
    const unfinishedCount = BigInt(unfinished.rows[0]?.count ?? '0');

    total += unfinishedCount;

    if (unfinishedCount > 0n) {
      violations.push({ code: 'BETTING_INCOMPLETE_COMMAND' });
    }

    let cursor = '00000000-0000-0000-0000-000000000000';

    while (true) {
      const page = await betting.query<{
        bet_id: string;
        operator_id: string;
        player_id: string;
        status: string;
        currency: string;
        stake_minor: string;
        actual_payout_minor: string | null;
      }>(
        'SELECT bet_id,operator_id,player_id,status,currency,stake_minor::text,actual_payout_minor::text FROM bets WHERE bet_id>$1::uuid ORDER BY bet_id LIMIT 500',
        [cursor],
      );

      if (!page.rows.length) {
        break;
      }
      cursor = page.rows.at(-1)?.bet_id ?? cursor;
      const rows = await ledger.query<{
        bet_id: string;
        operator_id: string;
        player_id: string;
        currency: string;
        stake_minor: string;
        status: string;
        gross_payout_minor: string | null;
      }>(
        'SELECT r.bet_id,r.operator_id,w.player_id,r.currency,r.stake_minor::text,r.status,r.gross_payout_minor::text FROM ledger_bet_reservations r JOIN wallets w USING(operator_id,wallet_id) WHERE r.bet_id=ANY($1::uuid[])',
        [page.rows.map(row => row.bet_id)],
      );
      const map = new Map(rows.rows.map(row => [row.operator_id + ':' + row.bet_id, row]));

      for (const bet of page.rows) {
        const reservation = map.get(bet.operator_id + ':' + bet.bet_id);
        const expected: Record<
          string,
          string
        > =
          {
            ACCEPTED:
            'RESERVED',
            WON:
            'WON',
            LOST:
            'LOST',
            VOID:
            'CANCELED',
            CANCELED:
            'CANCELED',
          };
        let invalid = ['PENDING_RESERVATION', 'SETTLEMENT_PENDING'].includes(bet.status);

        if (expected[bet.status]) {
          invalid =
            invalid || reservation?.player_id !== bet.player_id || reservation.currency !== bet.currency
            || reservation.stake_minor !== bet.stake_minor
            || reservation.status !== expected[bet.status]
            || (['WON', 'LOST', 'VOID'].includes(bet.status)
              && reservation.gross_payout_minor !== bet.actual_payout_minor);
        }
        if (bet.status === 'REJECTED' && reservation) {
          invalid =
            invalid || reservation.status !== 'CANCELED' || reservation.player_id !== bet.player_id
            || reservation.currency !== bet.currency
            || reservation.stake_minor !== bet.stake_minor
            || reservation.gross_payout_minor !== bet.stake_minor;
        }
        if (invalid) {
          total++;

          if (violations.length < 200) {
            violations.push({ code: 'BETTING_LEDGER_STATE', businessRef: bet.bet_id });
          }
        }
      }
    }
    let reservationCursor = '00000000-0000-0000-0000-000000000000';

    while (true) {
      const reservations = await ledger.query<{
        bet_id: string;
        operator_id: string;
      }>(
        'SELECT bet_id,operator_id FROM ledger_bet_reservations WHERE bet_id>$1::uuid ORDER BY bet_id LIMIT 500',
        [reservationCursor],
      );

      if (!reservations.rows.length) {
        break;
      }
      reservationCursor = reservations.rows.at(-1)?.bet_id ?? reservationCursor;
      const bets = await betting.query<{
        bet_id: string;
        operator_id: string;
      }>(
        'SELECT bet_id,operator_id FROM bets WHERE bet_id=ANY($1::uuid[])',
        [reservations.rows.map(row => row.bet_id)],
      );
      const known = new Set(bets.rows.map(row => row.operator_id + ':' + row.bet_id));

      for (const row of reservations.rows) {
        if (!known.has(row.operator_id + ':' + row.bet_id)) {
          total++;

          if (violations.length < 200) {
            violations.push({ code: 'LEDGER_BETTING_ORPHAN', businessRef: row.bet_id });
          }
        }
      }
    }
    const counts = await ledger.query<{
      transactions: string;
      entries: string;
    }>(
      'SELECT (SELECT count(*)::text FROM ledger_transactions) AS transactions,(SELECT count(*)::text FROM ledger_entries) AS entries',
    );
    const row = counts.rows[0];

    if (!row) {
      throw new Error('Audit counts unavailable');
    }
    await ledger.query('COMMIT');
    await betting.query('COMMIT');

    return {
      runId: run.manifest.runId,
      snapshotAt: new Date().toISOString(),
      status: total === 0n ? AuditStatus.PASS : AuditStatus.FAIL,
      counts: { ...row, violations: String(total) },
      violations,
    };
  } finally {
    await Promise.allSettled([ledger.end(), betting.end()]);
  }
}
