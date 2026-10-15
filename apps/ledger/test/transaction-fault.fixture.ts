import type {
  IPoolMetrics,
  ISqlSession,
  ISqlTransactionManager,
  ITransactionMetrics,
  SqlIsolation,
} from '../src/adapters/outbound/persistence/sql-session.js';
import { SqlTransactionFailure } from '../src/adapters/outbound/persistence/sql-session.js';

export enum TransactionFault { NONE, BEFORE_COMMIT, AFTER_COMMIT }

export class FaultInjectingTransactionManager implements ISqlTransactionManager {
  fault = TransactionFault.NONE;
  readonly metrics: ITransactionMetrics;

  constructor(private readonly delegate: ISqlTransactionManager) {
    this.metrics = delegate.metrics;
  }

  async transaction<T>(isolation: SqlIsolation, work: (session: ISqlSession) => Promise<T>): Promise<T> {
    const selected = this.fault;

    this.fault = TransactionFault.NONE;
    const result = await this.delegate.transaction(
      isolation,
      async session => {
        const value = await work(session);

        if (selected === TransactionFault.BEFORE_COMMIT) {
          throw new Error('Synthetic precommit process failure');
        }

        return value;
      },
    );

    if (selected === TransactionFault.AFTER_COMMIT) {
      throw new SqlTransactionFailure(new Error('Synthetic lost commit reply'), true);
    }

    return result;
  }

  poolMetrics(): IPoolMetrics {
    return this.delegate.poolMetrics();
  }

  close(): Promise<void> {
    return this.delegate.close();
  }
}
