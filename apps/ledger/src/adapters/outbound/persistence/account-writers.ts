import { LedgerError, MAX_INT64 } from '../../../domain/ledger.error.js';
import type { IAccountDelta, IAccountState, ICallContext } from '../../../domain/ledger.model.js';
import { ErrorCode } from '../../../domain/ledger.model.js';
import { decodeAccount } from './ledger.codec.js';
import type { ISqlSession, ITransactionMetrics } from './sql-session.js';

export interface IAccountWriter {
  load(session: ISqlSession, context: ICallContext, ids: string[]): Promise<IAccountState[]>;
  apply(session: ISqlSession, context: ICallContext, deltas: IAccountDelta[], expectedVersions: bigint[], now: string): Promise<IAccountState[]>;
}

const ACCOUNT_SELECT = `SELECT a.account_id,a.wallet_id,a.currency,a.account_kind,a.normal_side,b.balance_minor::text,b.version::text
  FROM ledger_accounts a JOIN ledger_account_balances b ON b.account_id=a.account_id AND b.operator_id=a.operator_id
  WHERE a.operator_id=$1::uuid AND a.account_id IN (SELECT value::uuid FROM jsonb_array_elements_text($2::jsonb)) AND a.status='ACTIVE' ORDER BY a.account_id`;

abstract class SqlAccountWriter implements IAccountWriter {
  constructor(protected readonly metrics: ITransactionMetrics) {}

  protected abstract readonly lockClause: string;

  async load(session: ISqlSession, context: ICallContext, ids: string[]): Promise<IAccountState[]> {
    if (!ids.length || ids.length > 16 || new Set(ids).size !== ids.length) throw new LedgerError(ErrorCode.INVALID_INPUT);

    const start = performance.now();
    const found = await session.query(ACCOUNT_SELECT + this.lockClause, [context.operatorId, JSON.stringify([...ids].sort())]);

    this.metrics.lockCoordinationMs += performance.now() - start;

    if (found.length !== ids.length) throw new LedgerError(ErrorCode.NOT_FOUND);

    return found.map(decodeAccount);
  }

  async apply(session: ISqlSession, context: ICallContext, deltas: IAccountDelta[], versions: bigint[], now: string): Promise<IAccountState[]> {
    if (deltas.length !== versions.length || new Set(deltas.map(delta => delta.accountId)).size !== deltas.length || deltas.some((delta, index) => index > 0 && (deltas[index - 1]?.accountId ?? '') >= delta.accountId)) throw new LedgerError(ErrorCode.INVARIANT_VIOLATION);

    const result: IAccountState[] = [];

    for (const [index, delta] of deltas.entries()) {
      const version = versions[index];

      if (version === undefined || version >= MAX_INT64) throw new LedgerError(ErrorCode.AMOUNT_OUT_OF_RANGE);

      const start = performance.now();
      const changed = await session.query(`UPDATE ledger_account_balances b SET balance_minor=(b.balance_minor::numeric+$3::numeric)::bigint,version=b.version+1,updated_at=$5::timestamptz
        FROM ledger_accounts a WHERE b.operator_id=$1::uuid AND b.account_id=$2::uuid AND b.version=$4::bigint
        AND a.operator_id=b.operator_id AND a.account_id=b.account_id AND a.currency=$6 AND a.status='ACTIVE'
        AND b.balance_minor::numeric+$3::numeric BETWEEN -9223372036854775808 AND 9223372036854775807
        AND (a.wallet_id IS NULL OR b.balance_minor::numeric+$3::numeric>=0)
        RETURNING a.account_id,a.wallet_id,a.currency,a.account_kind,a.normal_side,b.balance_minor::text,b.version::text`, [context.operatorId, delta.accountId, delta.deltaMinor.toString(), version.toString(), now, delta.currency]);

      this.metrics.lockCoordinationMs += performance.now() - start;

      if (changed.length !== 1) throw new LedgerError(ErrorCode.VERSION_CONFLICT);

      const row = changed[0];

      if (!row) throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);
      result.push(decodeAccount(row));
    }

    return result;
  }
}

export class ConditionalAccountWriter extends SqlAccountWriter { protected readonly lockClause = ''; }

export class ForUpdateAccountWriter extends SqlAccountWriter { protected readonly lockClause = ' FOR UPDATE OF b'; }

export class SerializableAccountWriter extends SqlAccountWriter { protected readonly lockClause = ''; }
