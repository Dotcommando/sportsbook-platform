import { CapabilityPolicy } from '../../domain/capability.policy.js';
import { failure, success, validInstant, validUuid } from '../../domain/ledger.error.js';
import type { IBatchReport, ILedgerPublishOutboxBatchInput, ILedgerPublishOutboxBatchOutput, IResult } from '../../domain/ledger.model.js';
import { ActorKind, Capability, ErrorCode } from '../../domain/ledger.model.js';
import type { PublishOutboxBatchPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ClockPort, MessagePublicationPort, OutboxDeliveryPort } from '../../ports/outbound/financial.port.js';

export class PublishOutboxBatchUseCase implements PublishOutboxBatchPort {
  constructor(private readonly delivery: OutboxDeliveryPort, private readonly publication: MessagePublicationPort, private readonly clock: ClockPort, private readonly retryDelayMs: number) {
    if (!Number.isInteger(retryDelayMs) || retryDelayMs < 1 || retryDelayMs > 60000) throw new Error('Invalid outbox retry delay');
  }

  async execute(request: ILedgerPublishOutboxBatchInput): Promise<IResult<ILedgerPublishOutboxBatchOutput>> {
    const input = request.input;
    const authorized = CapabilityPolicy.authorize(input.context, Capability.PUBLISH_EVENTS);

    if (!authorized.ok) return authorized;
    if (input.context.actorKind !== ActorKind.SYSTEM) return failure(ErrorCode.PERMISSION_DENIED, input.context.correlationId);
    if (Date.parse(input.context.deadlineAt) <= Date.parse(this.clock.now())) return failure(ErrorCode.DEADLINE_EXCEEDED, input.context.correlationId);
    if (!validUuid(input.batchId) || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200 || !validInstant(input.cutoff) || Date.parse(input.cutoff) > Date.parse(this.clock.now())) return failure(ErrorCode.INVALID_INPUT, input.context.correlationId);

    const report: IBatchReport = { selected: 0, applied: 0, replayed: 0, rejected: 0, pending: 0, failed: 0 };

    try {
      const leases = await this.delivery.claim(input);

      if (leases.length > input.limit) return failure(ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
      report.selected = leases.length;

      for (const lease of leases) {
        try {
          const receipt = await this.publication.publish(input.context, lease.message);

          if (!receipt.durable || receipt.messageId !== lease.message.messageId || !validInstant(receipt.acceptedAt)) throw new Error('Invalid durable receipt');
          await this.delivery.markDelivered(input.context, lease.leaseId, receipt);
          report.applied++;
        } catch {
          try {
            await this.delivery.release(input.context, lease.leaseId, new Date(Date.parse(this.clock.now()) + this.retryDelayMs).toISOString(), ErrorCode.DEPENDENCY_UNAVAILABLE);
            report.pending++;
          } catch { report.failed++; }
        }
      }

      return success({ report });
    } catch { return failure(ErrorCode.DEPENDENCY_UNAVAILABLE, input.context.correlationId, true); }
  }
}
