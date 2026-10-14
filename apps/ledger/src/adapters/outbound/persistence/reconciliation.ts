import { LedgerError } from '../../../domain/ledger.error.js';
import type { ICallContext, IPageInput, IReconciliationReport } from '../../../domain/ledger.model.js';
import { AuditState, ErrorCode } from '../../../domain/ledger.model.js';
import type { ClockPort, IdGeneratorPort, ReconciliationStorePort } from '../../../ports/outbound/financial.port.js';
import { canonicalJson, losslessJson } from '../ids/command-fingerprint.js';
import { integer, text, uuid } from './ledger.codec.js';
import type { ISqlTransactionManager } from './sql-session.js';
import { object, SqlIsolation, SqlTransactionFailure } from './sql-session.js';

const RECONCILE_SQL = `WITH scoped_transactions AS (
  SELECT * FROM ledger_transactions WHERE operator_id=$1::uuid AND created_at<=$2::timestamptz
), entry_sums AS (
  SELECT e.account_id,sum(CASE WHEN e.side=a.normal_side THEN e.amount_minor ELSE -e.amount_minor END) FILTER(WHERE e.posted_at<=$2::timestamptz) AS historical,
    sum(CASE WHEN e.side=a.normal_side THEN e.amount_minor ELSE -e.amount_minor END) FILTER(WHERE e.posted_at>$2::timestamptz) AS future
  FROM ledger_entries e JOIN ledger_accounts a ON a.account_id=e.account_id AND a.operator_id=e.operator_id WHERE e.operator_id=$1::uuid GROUP BY e.account_id
), historical_accounts AS (
  SELECT a.*,COALESCE(s.historical,0) AS journal_balance,b.balance_minor::numeric-COALESCE(s.future,0) AS projected_balance
  FROM ledger_accounts a LEFT JOIN entry_sums s ON s.account_id=a.account_id LEFT JOIN ledger_account_balances b ON b.account_id=a.account_id AND b.operator_id=a.operator_id
  WHERE a.operator_id=$1::uuid AND a.created_at<=$2::timestamptz
), pending_reservations AS (
  SELECT r.wallet_id,sum(r.stake_minor) AS amount FROM ledger_bet_reservations r
  JOIN ledger_transactions original ON original.ledger_transaction_id=r.reservation_transaction_id AND original.operator_id=r.operator_id
  LEFT JOIN ledger_transactions terminal ON terminal.ledger_transaction_id=r.settlement_transaction_id AND terminal.operator_id=r.operator_id
  WHERE r.operator_id=$1::uuid AND original.posted_at<=$2::timestamptz AND (terminal.posted_at IS NULL OR terminal.posted_at>$2::timestamptz) GROUP BY r.wallet_id
), pending_withdrawals AS (
  SELECT r.wallet_id,sum(r.amount_minor) AS amount FROM ledger_withdrawals r
  JOIN ledger_transactions original ON original.ledger_transaction_id=r.hold_transaction_id AND original.operator_id=r.operator_id
  LEFT JOIN ledger_transactions terminal ON terminal.ledger_transaction_id=r.completion_transaction_id AND terminal.operator_id=r.operator_id
  WHERE r.operator_id=$1::uuid AND original.posted_at<=$2::timestamptz AND (terminal.posted_at IS NULL OR terminal.posted_at>$2::timestamptz) GROUP BY r.wallet_id
), violations AS (
  SELECT 'UNBALANCED_TRANSACTION'::text AS code,h.ledger_transaction_id AS business_ref FROM scoped_transactions h LEFT JOIN ledger_entries e ON e.ledger_transaction_id=h.ledger_transaction_id AND e.operator_id=h.operator_id
  GROUP BY h.ledger_transaction_id,h.status,h.currency HAVING (h.status='POSTED' AND (count(e.ledger_entry_id)<2 OR COALESCE(sum(CASE WHEN e.side='DEBIT' THEN e.amount_minor ELSE -e.amount_minor END),0)<>0 OR bool_or(e.currency<>h.currency))) OR (h.status='REJECTED' AND count(e.ledger_entry_id)>0)
  UNION ALL SELECT 'ENTRY_HEADER_REFERENCE',e.ledger_entry_id FROM ledger_entries e LEFT JOIN ledger_transactions h ON h.ledger_transaction_id=e.ledger_transaction_id
    WHERE e.operator_id=$1::uuid AND e.posted_at<=$2::timestamptz AND (h.ledger_transaction_id IS NULL OR h.operator_id<>e.operator_id OR h.currency<>e.currency OR h.status<>'POSTED' OR h.posted_at<>e.posted_at)
  UNION ALL SELECT 'ENTRY_ACCOUNT_REFERENCE',e.ledger_entry_id FROM ledger_entries e LEFT JOIN ledger_accounts a ON a.account_id=e.account_id
    WHERE e.operator_id=$1::uuid AND e.posted_at<=$2::timestamptz AND (a.account_id IS NULL OR a.operator_id<>e.operator_id OR a.currency<>e.currency)
  UNION ALL SELECT 'PROJECTION_MISMATCH',account_id FROM historical_accounts WHERE projected_balance IS NULL OR projected_balance<>journal_balance OR (wallet_id IS NOT NULL AND projected_balance<0)
  UNION ALL SELECT 'PROJECTION_ACCOUNT_REFERENCE',b.account_id FROM ledger_account_balances b LEFT JOIN ledger_accounts a ON a.account_id=b.account_id WHERE b.operator_id=$1::uuid AND (a.account_id IS NULL OR a.operator_id<>b.operator_id)
  UNION ALL SELECT 'ACCOUNT_WALLET_REFERENCE',a.account_id FROM ledger_accounts a LEFT JOIN wallets w ON w.wallet_id=a.wallet_id WHERE a.operator_id=$1::uuid AND a.wallet_id IS NOT NULL AND (w.wallet_id IS NULL OR w.operator_id<>a.operator_id OR w.currency<>a.currency)
  UNION ALL SELECT 'WALLET_ACCOUNT_INVENTORY',w.wallet_id FROM wallets w LEFT JOIN ledger_accounts a ON a.wallet_id=w.wallet_id AND a.operator_id=w.operator_id WHERE w.operator_id=$1::uuid AND w.created_at<=$2::timestamptz GROUP BY w.wallet_id HAVING count(*) FILTER(WHERE a.account_kind IN ('AVAILABLE','RESERVED','WITHDRAWAL_HOLD'))<>3
  UNION ALL SELECT 'RESERVED_LIABILITY',a.wallet_id FROM historical_accounts a LEFT JOIN pending_reservations r ON r.wallet_id=a.wallet_id WHERE a.account_kind='RESERVED' AND a.journal_balance<>COALESCE(r.amount,0)
  UNION ALL SELECT 'WITHDRAWAL_LIABILITY',a.wallet_id FROM historical_accounts a LEFT JOIN pending_withdrawals r ON r.wallet_id=a.wallet_id WHERE a.account_kind='WITHDRAWAL_HOLD' AND a.journal_balance<>COALESCE(r.amount,0)
  UNION ALL SELECT 'RESERVATION_REFERENCE',r.bet_id FROM ledger_bet_reservations r LEFT JOIN wallets w ON w.wallet_id=r.wallet_id
    LEFT JOIN ledger_transactions original ON original.ledger_transaction_id=r.reservation_transaction_id LEFT JOIN ledger_transactions terminal ON terminal.ledger_transaction_id=r.settlement_transaction_id
    WHERE r.operator_id=$1::uuid AND r.created_at<=$2::timestamptz AND (w.wallet_id IS NULL OR w.operator_id<>r.operator_id OR w.currency<>r.currency OR original.ledger_transaction_id IS NULL OR original.operator_id<>r.operator_id OR original.transaction_type<>'RESERVE_STAKE' OR original.business_ref<>r.bet_id::text OR original.currency<>r.currency
      OR (r.status='RESERVED' AND (r.settlement_transaction_id IS NOT NULL OR r.gross_payout_minor IS NOT NULL)) OR (r.status<>'RESERVED' AND (terminal.ledger_transaction_id IS NULL OR terminal.operator_id<>r.operator_id OR terminal.business_ref<>r.bet_id::text OR terminal.currency<>r.currency OR r.gross_payout_minor IS NULL))
      OR (r.status='WON' AND (terminal.transaction_type<>'SETTLE_WIN' OR r.gross_payout_minor<r.stake_minor OR r.settlement_seq IS NULL)) OR (r.status='LOST' AND (terminal.transaction_type<>'SETTLE_LOSS' OR r.gross_payout_minor<>0 OR r.settlement_seq IS NULL)) OR (r.status='CANCELED' AND (terminal.transaction_type<>'CANCEL_RESERVATION' OR r.gross_payout_minor<>r.stake_minor)))
  UNION ALL SELECT 'WITHDRAWAL_REFERENCE',r.withdrawal_id FROM ledger_withdrawals r LEFT JOIN wallets w ON w.wallet_id=r.wallet_id
    LEFT JOIN ledger_transactions original ON original.ledger_transaction_id=r.hold_transaction_id LEFT JOIN ledger_transactions terminal ON terminal.ledger_transaction_id=r.completion_transaction_id
    WHERE r.operator_id=$1::uuid AND r.created_at<=$2::timestamptz AND (w.wallet_id IS NULL OR w.operator_id<>r.operator_id OR w.currency<>r.currency OR original.ledger_transaction_id IS NULL OR original.operator_id<>r.operator_id OR original.transaction_type<>'WITHDRAWAL_HOLD' OR original.currency<>r.currency
      OR (r.status='HELD' AND r.completion_transaction_id IS NOT NULL) OR (r.status<>'HELD' AND (terminal.ledger_transaction_id IS NULL OR terminal.operator_id<>r.operator_id OR terminal.currency<>r.currency OR r.resolved_at IS NULL)) OR (r.status='COMPLETED' AND (terminal.transaction_type<>'WITHDRAWAL_COMPLETE' OR r.provider_ref IS NULL)) OR (r.status='REJECTED' AND (terminal.transaction_type<>'WITHDRAWAL_REJECT' OR r.reason_code IS NULL)))
  UNION ALL SELECT 'INCOMPLETE_COMMAND',request_id FROM ledger_idempotency_records WHERE operator_id=$1::uuid AND created_at<=$2::timestamptz AND (state='IN_PROGRESS' OR response_snapshot IS NULL)
) SELECT (SELECT count(*)::text FROM scoped_transactions) AS transactions,
  (SELECT count(*)::text FROM ledger_entries WHERE operator_id=$1::uuid AND posted_at<=$2::timestamptz) AS entries,
  (SELECT count(*)::text FROM violations) AS violation_count,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('code',code,'businessRef',business_ref) ORDER BY code,business_ref) FROM (SELECT * FROM violations WHERE ($4::text IS NULL OR (code,business_ref)>($4::text,$5::uuid)) ORDER BY code,business_ref LIMIT $3) details),'[]'::jsonb) AS details`;

export class SqlReconciliationStore implements ReconciliationStorePort {
  constructor(private readonly manager: ISqlTransactionManager, private readonly ids: IdGeneratorPort, private readonly clock: ClockPort, private readonly timeoutMs: number) {}

  async scan(context: ICallContext, cutoff: string, page: IPageInput): Promise<IReconciliationReport> {
    try {
      return await this.manager.transaction(SqlIsolation.REPEATABLE_READ, async session => {
        const remaining = Date.parse(context.deadlineAt) - Date.parse(this.clock.now());

        if (remaining <= 0) throw new LedgerError(ErrorCode.DEADLINE_EXCEEDED);
        await session.query("SELECT set_config('transaction_read_only','on',true),set_config('statement_timeout',$1,true)", [String(Math.min(remaining, this.timeoutMs))]);
        let lastCode: string | null = null;
        let lastReference: string | null = null;

        if (page.cursor) {
          try { const raw: unknown = JSON.parse(Buffer.from(page.cursor, 'base64url').toString('utf8')); const cursor = object(raw);

 if (cursor.version !== 1 || cursor.operatorId !== context.operatorId || cursor.actorId !== context.actorId || cursor.cutoff !== cutoff) throw new Error('Invalid audit cursor'); lastCode = text(cursor.code); lastReference = uuid(cursor.businessRef); } catch { throw new LedgerError(ErrorCode.INVALID_INPUT); }
        }

        const row = (await session.query(RECONCILE_SQL, [context.operatorId, cutoff, page.limit + 1, lastCode, lastReference]))[0];

        if (!row || !Array.isArray(row.details)) throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);

        const count = integer(row.violation_count);
        const violations = row.details.slice(0, page.limit).map((value: unknown) => { const item = object(value);

 return { code: text(item.code), ...(item.businessRef == null ? {} : { businessRef: uuid(item.businessRef) }) }; });
        const last = violations.at(-1);

        return { runId: this.ids.derive(context.operatorId, context.operatorId, 'ledger:unrecorded-audit-scan'), snapshotAt: cutoff, status: count === 0n ? AuditState.PASS : AuditState.FAIL, counts: { transactions: integer(row.transactions), entries: integer(row.entries), violations: count }, violations, ...(row.details.length > page.limit && last ? { nextCursor: Buffer.from(losslessJson({ version: 1, operatorId: context.operatorId, actorId: context.actorId, cutoff, code: last.code, businessRef: last.businessRef })).toString('base64url') } : {}) };
      });
    } catch (caught) { const error = caught instanceof SqlTransactionFailure ? caught.original : caught;

 if (error instanceof LedgerError) throw error; throw new LedgerError(ErrorCode.DEPENDENCY_UNAVAILABLE); }
  }

  async record(context: ICallContext, report: IReconciliationReport): Promise<void> {
    await this.manager.transaction(SqlIsolation.READ_COMMITTED, async session => {
      const id = this.ids.derive(context.operatorId, report.runId, 'ledger:audit');
      const payload = losslessJson({ ...report, violations: undefined, nextCursor: undefined });
      const saved = await session.query('INSERT INTO ledger_reconciliation_runs (ledger_reconciliation_run_id,operator_id,run_id,status,checked_at,invariant_counts,details_ref) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5::timestamptz,$6::jsonb,NULL) ON CONFLICT(ledger_reconciliation_run_id) DO NOTHING RETURNING run_id', [id, context.operatorId, report.runId, report.status, report.snapshotAt, payload]);

      if (!saved.length) {
        const existing = (await session.query('SELECT invariant_counts FROM ledger_reconciliation_runs WHERE operator_id=$1::uuid AND ledger_reconciliation_run_id=$2::uuid', [context.operatorId, id]))[0];

        if (!existing || canonicalJson(existing.invariant_counts) !== canonicalJson(JSON.parse(payload))) throw new LedgerError(ErrorCode.IDEMPOTENCY_CONFLICT);
      }
    });
  }
}

