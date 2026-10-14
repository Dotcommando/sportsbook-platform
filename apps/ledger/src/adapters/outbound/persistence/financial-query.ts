import { LedgerError } from '../../../domain/ledger.error.js';
import type { ICallContext, IEntry, IJournalView, IPageInput, IReservationView, IStoredCommand, IWalletView, IWithdrawalView } from '../../../domain/ledger.model.js';
import { ErrorCode } from '../../../domain/ledger.model.js';
import type { ClockPort, FinancialQueryPort, IPageResult } from '../../../ports/outbound/financial.port.js';
import { decodeStoredCommand } from './ledger.codec.js';
import type { ISqlSession, ISqlTransactionManager } from './sql-session.js';
import { SqlIsolation, SqlTransactionFailure } from './sql-session.js';
import { decodeEntry, decodeJournal, historyPage, journalById, reservationById, walletById, walletByOwner, withdrawalById } from './sql-stores.js';

export class SqlFinancialQuery implements FinancialQueryPort {
  constructor(private readonly manager: ISqlTransactionManager, private readonly clock: ClockPort, private readonly statementTimeoutMs: number) {}

  private async read<T>(context: ICallContext, work: (session: ISqlSession) => Promise<T>): Promise<T> {
    try {
      return await this.manager.transaction(SqlIsolation.REPEATABLE_READ, async session => {
        const remaining = Date.parse(context.deadlineAt) - Date.parse(this.clock.now());

        if (remaining <= 0) throw new LedgerError(ErrorCode.DEADLINE_EXCEEDED);
        await session.query("SELECT set_config('transaction_read_only','on',true),set_config('statement_timeout',$1,true)", [String(Math.max(1, Math.min(remaining, this.statementTimeoutMs)))]);

        return work(session);
      });
    } catch (caught) {
      const error = caught instanceof SqlTransactionFailure ? caught.original : caught;

      if (error instanceof LedgerError) throw error;
      throw new LedgerError(ErrorCode.DEPENDENCY_UNAVAILABLE);
    }
  }

  getWallet(context: ICallContext, playerId: string, currency: string): Promise<IWalletView | undefined> { return this.read(context, session => walletByOwner(session, context, playerId, currency)); }

  getBalance(context: ICallContext, walletId: string): Promise<IWalletView | undefined> { return this.read(context, session => walletById(session, context, walletId)); }

  getTransaction(context: ICallContext, id: string): Promise<IJournalView | undefined> { return this.read(context, session => journalById(session, context, id)); }

  getReservation(context: ICallContext, id: string): Promise<IReservationView | undefined> { return this.read(context, session => reservationById(session, context, id)); }

  getWithdrawal(context: ICallContext, id: string): Promise<IWithdrawalView | undefined> { return this.read(context, session => withdrawalById(session, context, id)); }

  listEntries(context: ICallContext, walletId: string, page: IPageInput): Promise<IPageResult<IEntry>> { return this.read(context, session => historyPage(session, context, walletId, page, 'entries', decodeEntry)); }

  listTransactions(context: ICallContext, walletId: string, page: IPageInput): Promise<IPageResult<IJournalView>> { return this.read(context, session => historyPage(session, context, walletId, page, 'transactions', decodeJournal)); }

  getCommandOutcome(context: ICallContext, id: string): Promise<IStoredCommand | undefined> {
    return this.read(context, async session => {
      const result = await session.query(`SELECT * FROM ledger_idempotency_records WHERE operator_id=$1::uuid AND request_id=$2::uuid
        AND ((actor_id=$3::uuid AND actor_kind=$4) OR ($5::uuid IS NOT NULL AND (player_id=$5::uuid OR COALESCE(response_snapshot#>>'{value,wallet,playerId}',response_snapshot#>>'{value,outcome,wallet,playerId}')=$5::text)))`, [context.operatorId, id, context.actorId, context.actorKind, context.playerId ?? null]);

      return result[0] ? decodeStoredCommand(result[0]) : undefined;
    });
  }
}
