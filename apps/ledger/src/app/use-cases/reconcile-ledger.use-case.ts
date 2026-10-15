import { failure, LedgerError, success, validInstant, validUuid } from '../../domain/ledger.error.js';
import type { ILedgerReconcileLedgerInput, ILedgerReconcileLedgerOutput, IResult } from '../../domain/ledger.model.js';
import { ActorKind, AuditState, Capability, ErrorCode } from '../../domain/ledger.model.js';
import type { ReconcileLedgerPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ILedgerReadDependencies } from '../services/financial-query.service.js';
import { authorizeRead, validPage } from '../services/financial-query.service.js';

export class ReconcileLedgerUseCase implements ReconcileLedgerPort {
  constructor(private readonly dependencies: ILedgerReadDependencies) { }

  async execute(input: ILedgerReconcileLedgerInput): Promise<IResult<ILedgerReconcileLedgerOutput>> {
    const authorized = authorizeRead(this.dependencies, input.context, Capability.RECONCILE_LEDGER);

    if (!authorized.ok) {
      return authorized;
    }
    if (input.context.actorKind !== ActorKind.SYSTEM) {
      return failure(ErrorCode.PERMISSION_DENIED, input.context.correlationId);
    }
    if (!validUuid(input.runId) || !validUuid(input.requestId) || !validInstant(input.cutoff)
      || Date.parse(input.cutoff) > Date.parse(this.dependencies.clock.now())
      || !validPage(input.page)) {
      return failure(ErrorCode.INVALID_INPUT, input.context.correlationId);
    }

    try {
      const scanned = await this.dependencies.reconciliation.scan(input.context, input.cutoff, input.page);

      if (scanned.counts.violations < 0n || scanned.counts.entries < 0n
        || scanned.counts.transactions < 0n
        || scanned.violations.length > input.page.limit
        || (scanned.status === AuditState.PASS) !== (scanned.counts.violations === 0n)
        || !Object.values(AuditState).includes(scanned.status)) {
        return failure(ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
      }

      const report = { ...scanned, runId: input.runId };

      await this.dependencies.reconciliation.record(input.context, report);

      return success({ report });
    } catch (error) {
      return failure(
        error instanceof LedgerError ? error.code : ErrorCode.DEPENDENCY_UNAVAILABLE,
        input.context.correlationId,
      );
    }
  }
}
