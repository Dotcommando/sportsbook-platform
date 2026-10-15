import type { IQuerySession, ITransactionalRuntime } from '@sportsbook/persistence';
import { TransactionIsolation } from '@sportsbook/persistence';
import { MessagingMetric, MessagingMetrics } from '@sportsbook/service-transport';

import * as M from '../../../domain/betting.model.js';
import { requireRule, validInstant, validUuid } from '../../../domain/betting.policy.js';
import type { ClockPort, IdGeneratorPort, OutboxDeliveryPort } from '../../../ports/outbound/betting.port.js';
import * as Codec from './betting.codec.js';

export class BetOutboxDelivery implements OutboxDeliveryPort {
  readonly metrics = MessagingMetrics.forService('betting');

  constructor(
    private readonly runtime: ITransactionalRuntime,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly leaseMs: number,
  ) { }

  claim(input: M.IWorkerBatchInput): Promise<M.IOutboxLease[]> {
    return this.runtime.run(
      TransactionIsolation.READ_COMMITTED,
      async session => {
        await this.backlog(session);
        const now = this.clock.now();
        const rows = await session.query(
          'SELECT bet_outbox_event_id,payload,attempt_count FROM bet_outbox_events WHERE operator_id=$1 AND published_at IS NULL AND next_attempt_at<=$2 AND occurred_at<=$3 AND (lease_until IS NULL OR lease_until<=$2) ORDER BY next_attempt_at,bet_outbox_event_id FOR UPDATE SKIP LOCKED LIMIT $4',
          [input.context.operatorId, now, input.cutoff, input.limit],
        );
        const result: M.IOutboxLease[] = [];

        for (const row of rows) {
          const message = Codec.envelope(row.payload);

          requireRule(
            validUuid(message.messageId) && message.operatorId === input.context.operatorId
            && validInstant(message.occurredAt)
            && message.schemaVersion === 1,
            M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
          );
          const attemptNo = Number(row.attempt_count) + 1;
          const leaseId = this.ids.derive(message.operatorId, message.messageId, 'betting:outbox-lease:' + attemptNo);
          const leaseUntil = new Date(Date.parse(now) + this.leaseMs).toISOString();

          await session.query(
            'UPDATE bet_outbox_events SET lease_id=$3,lease_until=$4,attempt_count=$5 WHERE operator_id=$1 AND bet_outbox_event_id=$2 RETURNING message_id',
            [input.context.operatorId, Codec.text(row.bet_outbox_event_id), leaseId, leaseUntil, attemptNo],
          );
          result.push({ leaseId, message, attemptNo, leaseUntil });
        }

        return result;
      },
    );
  }

  async markDelivered(context: M.ICallContext, leaseId: string, receipt: M.IPublicationReceipt): Promise<void> {
    requireRule(
      receipt.durable && validUuid(receipt.messageId) && validInstant(receipt.acceptedAt),
    );
    await this.runtime.run(
      TransactionIsolation.READ_COMMITTED,
      async session => {
        const rows = await session.query(
          'UPDATE bet_outbox_events SET published_at=$4,lease_id=NULL,lease_until=NULL WHERE operator_id=$1 AND lease_id=$2 AND message_id=$3 AND lease_until>$5 AND published_at IS NULL RETURNING message_id',
          [context.operatorId, leaseId, receipt.messageId, receipt.acceptedAt, this.clock.now()],
        );

        requireRule(rows.length === 1, M.ErrorCode.VERSION_CONFLICT);
        await this.backlog(session);
      },
    );
  }

  async release(
    context: M.ICallContext,
    leaseId: string,
    nextAttemptAt: string,
    reasonCode: string,
  ): Promise<void> {
    requireRule(validInstant(nextAttemptAt) && /^[A-Z][A-Z0-9_]{0,63}$/.test(reasonCode));
    await this.runtime.run(
      TransactionIsolation.READ_COMMITTED,
      async session => {
        const rows = await session.query(
          'UPDATE bet_outbox_events SET lease_id=NULL,lease_until=NULL,next_attempt_at=$3,failure_reason_code=$4 WHERE operator_id=$1 AND lease_id=$2 AND lease_until>$5 AND published_at IS NULL RETURNING message_id',
          [context.operatorId, leaseId, nextAttemptAt, reasonCode, this.clock.now()],
        );

        requireRule(rows.length === 1, M.ErrorCode.VERSION_CONFLICT);
        await this.backlog(session);
      },
    );
  }

  private async backlog(session: IQuerySession): Promise<void> {
    const rows = await session.query(
      'SELECT count(*)::text AS pending FROM bet_outbox_events WHERE published_at IS NULL',
      [],
    );
    const value = rows[0]?.pending;

    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new Error('Invalid outbox count');
    }
    this.metrics.set(MessagingMetric.OUTBOX_BACKLOG, Number(value));
  }
}
