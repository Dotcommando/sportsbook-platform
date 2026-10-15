import {MessagingMetric, MessagingMetrics} from '@sportsbook/service-transport';

import { LedgerError } from '../../../domain/ledger.error.js';
import type { ICallContext, IOutboxLease, IPublicationReceipt, IWorkerBatchInput } from '../../../domain/ledger.model.js';
import { ErrorCode } from '../../../domain/ledger.model.js';
import type { ClockPort, IdGeneratorPort, OutboxDeliveryPort } from '../../../ports/outbound/financial.port.js';
import { decodeEvent, timestamp, uuid } from './ledger.codec.js';
import type { ISqlSession, ISqlTransactionManager } from './sql-session.js';
import { SqlIsolation } from './sql-session.js';

export class SqlOutboxDelivery implements OutboxDeliveryPort {
  readonly metrics = MessagingMetrics.forService('ledger');

  constructor(private readonly manager: ISqlTransactionManager, private readonly ids: IdGeneratorPort, private readonly clock: ClockPort, private readonly leaseMs: number) {}

  async claim(input: IWorkerBatchInput): Promise<IOutboxLease[]> {
    return this.manager.transaction(SqlIsolation.READ_COMMITTED, async session => {
      await this.backlog(session);const now = this.clock.now();
      const leaseUntil = new Date(Date.parse(now) + this.leaseMs).toISOString();
      const selected = await session.query('SELECT message_id,payload,attempt_count FROM ledger_outbox_events WHERE operator_id=$1::uuid AND published_at IS NULL AND occurred_at<=$2::timestamptz AND next_attempt_at<=$3::timestamptz AND (lease_until IS NULL OR lease_until<=$3::timestamptz) ORDER BY next_attempt_at,ledger_outbox_event_id LIMIT $4 FOR UPDATE SKIP LOCKED', [input.context.operatorId, input.cutoff, now, input.limit]);
      const leases: IOutboxLease[] = [];

      for (const row of selected) {
        if (typeof row.attempt_count !== 'number' || !Number.isInteger(row.attempt_count) || row.attempt_count < 0 || row.attempt_count >= 2147483647) throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);

        const message = decodeEvent(row.payload);

        if (message.operatorId !== input.context.operatorId || message.messageId !== uuid(row.message_id)) throw new LedgerError(ErrorCode.INVARIANT_VIOLATION);

        const attemptNo = row.attempt_count + 1;
        const leaseId = this.ids.derive(input.context.operatorId, input.batchId, 'ledger:lease:' + message.messageId + ':' + attemptNo);

        await session.query('UPDATE ledger_outbox_events SET lease_id=$3::uuid,lease_until=$4::timestamptz,attempt_count=$5 WHERE operator_id=$1::uuid AND message_id=$2::uuid RETURNING message_id', [input.context.operatorId, message.messageId, leaseId, leaseUntil, attemptNo]);
        leases.push({ leaseId, message, attemptNo, leaseUntil });
      }

      return leases;
    });
  }

  async markDelivered(context: ICallContext, leaseId: string, receipt: IPublicationReceipt): Promise<void> {
    if (!receipt.durable) throw new LedgerError(ErrorCode.INVALID_INPUT);
    await this.manager.transaction(SqlIsolation.READ_COMMITTED, async session => {
      const changed = await session.query('UPDATE ledger_outbox_events SET published_at=$4::timestamptz,lease_id=NULL,lease_until=NULL,failure_reason_code=NULL WHERE operator_id=$1::uuid AND lease_id=$2::uuid AND message_id=$3::uuid AND published_at IS NULL AND lease_until>$5::timestamptz RETURNING message_id', [context.operatorId, leaseId, receipt.messageId, timestamp(receipt.acceptedAt), this.clock.now()]);

      if (changed.length !== 1) throw new LedgerError(ErrorCode.VERSION_CONFLICT);await this.backlog(session);
    });
  }

  async release(context: ICallContext, leaseId: string, nextAttemptAt: string, reasonCode: string): Promise<void> {
    await this.manager.transaction(SqlIsolation.READ_COMMITTED, async session => {
      const changed = await session.query('UPDATE ledger_outbox_events SET lease_id=NULL,lease_until=NULL,next_attempt_at=$3::timestamptz,failure_reason_code=$4 WHERE operator_id=$1::uuid AND lease_id=$2::uuid AND published_at IS NULL AND lease_until>$5::timestamptz RETURNING message_id', [context.operatorId, leaseId, timestamp(nextAttemptAt), reasonCode, this.clock.now()]);

      if (changed.length !== 1) throw new LedgerError(ErrorCode.VERSION_CONFLICT);await this.backlog(session);
    });
  }

  private async backlog(session:ISqlSession):Promise<void> {const rows = await session.query('SELECT count(*)::text AS pending FROM ledger_outbox_events WHERE published_at IS NULL');const pending = rows[0]?.pending;

if (typeof pending !== 'string' || !/^\d+$/.test(pending)) throw new Error('Invalid outbox count');this.metrics.set(MessagingMetric.OUTBOX_BACKLOG, Number(pending));}
}

