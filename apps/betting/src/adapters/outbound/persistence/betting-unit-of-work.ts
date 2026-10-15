import type { ITransactionalRuntime } from '@sportsbook/persistence';
import { persistenceRecord, TransactionFailure, TransactionIsolation } from '@sportsbook/persistence';

import * as M from '../../../domain/betting.model.js';
import { BettingError, failure, requireRule, validInstant } from '../../../domain/betting.policy.js';
import type {
  BetUnitOfWorkPort,
  ClockPort,
  IBetTransactionPorts,
  IdGeneratorPort,
} from '../../../ports/outbound/betting.port.js';
import { BetSqlStores } from './betting-stores.js';

export function sqlCode(error: unknown): string | undefined {
  let current = error;

  for (let depth = 0; depth < 10 && current !== null && typeof current === 'object'; depth++) {
    const record = persistenceRecord(current);

    if (typeof record.code === 'string' && /^[0-9A-Z]{5}$/.test(record.code)
      && !record.code.startsWith('P')) {
      return record.code;
    }
    if (record.code === 'P2034') {
      return '40001';
    }

    const meta = record.meta !== null && typeof record.meta === 'object' ? persistenceRecord(record.meta) : {};

    if (typeof meta.code === 'string') {
      return meta.code;
    }
    current =
      record.original ?? record.driverError ?? record.parent ?? meta.driverAdapterError
      ?? record.cause;
  }

  return undefined;
}

export class BetSqlUnitOfWork implements BetUnitOfWorkPort {
  constructor(
    private readonly runtime: ITransactionalRuntime,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly attempts: number,
    private readonly statementMs: number,
    private readonly lockMs: number,
  ) { }

  async run<T>(
    context: M.ICallContext,
    work: (ports: IBetTransactionPorts) => Promise<M.IResult<T>>,
  ): Promise<M.IResult<T>> {
    for (let attempt = 0; attempt < this.attempts; attempt++) {
      try {
        requireRule(
          validInstant(context.deadlineAt)
          && Date.parse(context.deadlineAt) > Date.parse(this.clock.now()),
          M.ErrorCode.DEADLINE_EXCEEDED,
        );

        return await this.runtime.run(
          TransactionIsolation.READ_COMMITTED,
          async session => {
            const remaining = Math.max(1, Date.parse(context.deadlineAt) - Date.parse(this.clock.now()));

            await session.query(
              "SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)",
              [String(Math.min(remaining, this.statementMs)), String(Math.min(remaining, this.lockMs))],
            );
            const stores = new BetSqlStores(session, context, this.ids, this.clock);
            const result = await work(stores.ports);

            if (!result.ok
              && [
                M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
                M.ErrorCode.INVARIANT_VIOLATION,
                M.ErrorCode.DEPENDENCY_UNAVAILABLE,
                M.ErrorCode.DEADLINE_EXCEEDED,
              ].includes(
                result.error.code,
              )) {
              throw new BettingError(result.error.code);
            }
            requireRule(
              Date.parse(context.deadlineAt) > Date.parse(this.clock.now()),
              M.ErrorCode.DEADLINE_EXCEEDED,
            );

            return result;
          },
        );
      } catch (error) {
        const code = sqlCode(error);

        if (['40001', '40P01'].includes(code ?? '') && attempt + 1 < this.attempts
          && Date.parse(context.deadlineAt) > Date.parse(this.clock.now())) {
          await new Promise(resolve => setTimeout(resolve, Math.min(32, 2 ** Math.min(attempt, 5))));
          continue;
        }

        const original = error instanceof TransactionFailure ? error.original : error;
        const business = original instanceof BettingError
          ? original.code
          : code === '23505'
            ? M.ErrorCode.IDEMPOTENCY_CONFLICT
            : code === '57014' ? M.ErrorCode.DEADLINE_EXCEEDED : M.ErrorCode.DEPENDENCY_UNAVAILABLE;

        return failure(business, context, error instanceof TransactionFailure && error.commitStarted && !code);
      }
    }

    return failure(M.ErrorCode.DEPENDENCY_UNAVAILABLE, context);
  }
}
