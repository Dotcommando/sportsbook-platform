import { failure, LedgerError, validInstant, validUuid } from '../../../domain/ledger.error.js';
import type { ICallContext, IError, IResult } from '../../../domain/ledger.model.js';
import { ErrorCode } from '../../../domain/ledger.model.js';
import type {
  ClockPort,
  FinancialUnitOfWorkPort,
  IdGeneratorPort,
  IFinancialTransactionPorts,
} from '../../../ports/outbound/financial.port.js';
import type { IAccountWriter } from './account-writers.js';
import type { ISqlTransactionManager, SqlIsolation } from './sql-session.js';
import { sqlState, SqlTransactionFailure } from './sql-session.js';
import { transactionStores } from './sql-stores.js';

export interface IRetrySettings {
  serializationAttempts: number;
  deadlockAttempts: number;
  versionAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
  statementTimeoutMs: number;
  lockTimeoutMs: number;
}

export interface IFinancialPersistenceResources {
  manager: ISqlTransactionManager;
  ids: IdGeneratorPort;
  clock: ClockPort;
  retry: IRetrySettings;
  jitter: () => number;
}

class ReturnedTechnicalResult extends Error {
  constructor(readonly result: { ok: false; error: IError }) {
    super(result.error.code);
  }
}

export class SqlFinancialUnitOfWork implements FinancialUnitOfWorkPort {
  constructor(
    private readonly resources: IFinancialPersistenceResources,
    private readonly writer: IAccountWriter,
    private readonly isolation: SqlIsolation,
  ) { }

  async run<T>(
    context: ICallContext,
    work: (ports: IFinancialTransactionPorts) => Promise<IResult<T>>,
  ): Promise<IResult<T>> {
    if (!validUuid(context.operatorId) || !validUuid(context.actorId)
      || !validInstant(context.deadlineAt)) {
      return failure(ErrorCode.UNAUTHENTICATED, context.correlationId);
    }

    const bound = structuredClone(context);
    let serialization = 0;
    let deadlocks = 0;
    let versions = 0;

    for (; ;) {
      if (Date.parse(bound.deadlineAt) <= Date.parse(this.resources.clock.now())) {
        return failure(ErrorCode.DEADLINE_EXCEEDED, bound.correlationId);
      }

      try {
        return await this.resources.manager.transaction(
          this.isolation,
          async session => {
            const remaining = Date.parse(bound.deadlineAt) - Date.parse(this.resources.clock.now());

            if (remaining <= 0) {
              throw new LedgerError(ErrorCode.DEADLINE_EXCEEDED);
            }
            await session.query(
              "SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)",
              [
                String(Math.max(1, Math.min(remaining, this.resources.retry.statementTimeoutMs))),
                String(Math.max(1, Math.min(remaining, this.resources.retry.lockTimeoutMs))),
              ],
            );
            const result =
              await work(
                transactionStores(
                  session,
                  this.writer,
                  bound,
                  this.resources.ids,
                  this.resources.clock,
                ),
              );

            if (!result.ok
              && (result.error.retryable || result.error.outcomeUnknown
                || [
                  ErrorCode.ADAPTER_CONTRACT_VIOLATION,
                  ErrorCode.INVARIANT_VIOLATION,
                  ErrorCode.DEPENDENCY_UNAVAILABLE,
                  ErrorCode.DEADLINE_EXCEEDED,
                ].includes(
                  result.error.code,
                ))) {
              throw new ReturnedTechnicalResult(result);
            }
            if (Date.parse(bound.deadlineAt) <= Date.parse(this.resources.clock.now())) {
              throw new LedgerError(ErrorCode.DEADLINE_EXCEEDED);
            }

            return result;
          },
        );
      } catch (caught) {
        const error = caught instanceof SqlTransactionFailure ? caught.original : caught;

        if (error instanceof ReturnedTechnicalResult) {
          return error.result;
        }

        const state = sqlState(error);
        const retry = this.resources.retry;
        let attempt: number | undefined;

        if (state === '40001' && ++serialization < retry.serializationAttempts) {
          this.resources.manager.metrics.serializationRetries++;
          attempt = serialization;
        } else if (state === '40P01' && ++deadlocks < retry.deadlockAttempts) {
          this.resources.manager.metrics.deadlockRetries++;
          attempt = deadlocks;
        } else if (error instanceof LedgerError && error.code === ErrorCode.VERSION_CONFLICT
          && ++versions < retry.versionAttempts) {
          this.resources.manager.metrics.versionRetries++;
          attempt = versions;
        }
        if (attempt !== undefined) {
          const random = this.resources.jitter();

          if (!Number.isFinite(random) || random < 0 || random >= 1) {
            return failure(ErrorCode.ADAPTER_CONTRACT_VIOLATION, bound.correlationId);
          }

          const delay = Math.min(retry.retryMaxMs, retry.retryBaseMs * 2 ** Math.min(attempt - 1, 20))
            * (0.5 + random * 0.5);

          if (Date.parse(bound.deadlineAt) - Date.parse(this.resources.clock.now()) <= delay) {
            return failure(ErrorCode.DEADLINE_EXCEEDED, bound.correlationId);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        if (error instanceof LedgerError) {
          return failure(error.code, bound.correlationId, error.code === ErrorCode.VERSION_CONFLICT);
        }
        if (state === '23505') {
          return failure(ErrorCode.IDEMPOTENCY_CONFLICT, bound.correlationId);
        }
        if (state === '23514') {
          return failure(ErrorCode.INVARIANT_VIOLATION, bound.correlationId);
        }
        if (state === '22003') {
          return failure(ErrorCode.AMOUNT_OUT_OF_RANGE, bound.correlationId);
        }
        if (state === '40001' || state === '40P01' || state === '55P03' || state === '57014') {
          return failure(ErrorCode.OVERLOADED, bound.correlationId, true);
        }

        return failure(
          ErrorCode.DEPENDENCY_UNAVAILABLE,
          bound.correlationId,
          true,
          caught instanceof SqlTransactionFailure && caught.commitStarted,
        );
      }
    }
  }
}
