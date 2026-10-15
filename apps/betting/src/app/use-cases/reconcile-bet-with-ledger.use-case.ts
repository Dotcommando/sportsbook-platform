import * as M from '../../domain/betting.model.js';
import { requireRule, success, validInstant, validUuid } from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type { ReconcileBetWithLedgerPort } from '../../ports/inbound/betting-operations.port.js';
import type { IBettingDependencies } from '../services/betting-operation.service.js';
import { authorize, fail, page } from '../services/betting-operation.service.js';

export class ReconcileBetWithLedgerUseCase implements ReconcileBetWithLedgerPort {
  constructor(private readonly d: IBettingDependencies) { }

  async execute(
    input: M.IBettingReconcileBetWithLedgerInput,
  ): Promise<
    M.IResult<
      M.IBettingReconcileBetWithLedgerOutput
    >
  > {
    try {
      authorize(this.d, input.context, M.Capability.RECONCILE_BETS, undefined, true);
      page(input.page);
      requireRule(
        validUuid(input.requestId) && validUuid(input.runId) && validInstant(input.cutoff)
        && Date.parse(input.cutoff) <= Date.parse(this.d.clock.now()),
      );
      const candidates = await this.d.queries.listAuditCandidates(input.context, input.cutoff, input.page);
      const violations: { code: string; businessRef?: string }[] = [];
      let observed = 0n;

      for (const bet of candidates.items) {
        const status = await this.d.reservations.getStatus({ ...input.context, playerId: bet.playerId }, bet.betId);

        requireRule(
          Output.isILedgerGetBetFinancialStatusOutput(status),
          M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
        );
        const financial = status.reservation;

        if (financial) {
          observed++;
        }

        const matches = bet.status === M.BetStatus.PENDING_RESERVATION
          ? true
          : bet.status === M.BetStatus.REJECTED
            ? financial === undefined || financial.state === M.ReservationState.CANCELED
            : financial?.betId === bet.betId && financial.stake.amountMinor === bet.stake.amountMinor
            && financial.stake.currency === bet.stake.currency
            && ([M.BetStatus.ACCEPTED, M.BetStatus.SETTLEMENT_PENDING].includes(bet.status)
              ? financial.state === M.ReservationState.RESERVED
              || bet.status === M.BetStatus.SETTLEMENT_PENDING
              : bet.status === M.BetStatus.WON
                ? financial.state === M.ReservationState.WON
                && financial.grossPayoutMinor === bet.actualPayoutMinor
                : bet.status === M.BetStatus.LOST
                  ? financial.state === M.ReservationState.LOST && financial.grossPayoutMinor === 0n
                  : financial.state === M.ReservationState.CANCELED
                  && financial.grossPayoutMinor === bet.stake.amountMinor);

        if (!matches) {
          violations.push({ code: 'FINANCIAL_DIVERGENCE', businessRef: bet.betId });
        }
      }
      const report: M.IReconciliationReport = {
        runId: input.runId,
        snapshotAt: this.d.clock.now(),
        status: violations.length ? M.ReconciliationStatus.FAIL : M.ReconciliationStatus.PASS,
        counts: {
          transactions: BigInt(candidates.items.length),
          entries: observed,
          violations: BigInt(violations.length),
        },
        violations,
        ...(candidates.nextCursor ? { nextCursor: candidates.nextCursor } : {}),
      };

      await this.d.audit.record(input.context, report);

      return success({ report });
    } catch (error) {
      return fail(error, input.context);
    }
  }
}
