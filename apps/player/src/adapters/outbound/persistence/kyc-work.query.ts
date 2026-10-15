import type { ITransactionalRuntime } from '@sportsbook/persistence';
import { TransactionIsolation } from '@sportsbook/persistence';

import type { ICallContext, Instant } from '../../../domain/player.model.js';
import { Capability, KycCheckType } from '../../../domain/player.model.js';
import { requireRule, validUuid } from '../../../domain/player.policy.js';
import type { IKycWorkItem, IKycWorkPolicy, KycWorkQueryPort } from '../../../ports/outbound/kyc-work.port.js';

export class KycWorkQuery implements KycWorkQueryPort {
  constructor(private readonly runtime: ITransactionalRuntime) { }

  listDue(
    context: ICallContext,
    cutoff: Instant,
    limit: number,
    policies: readonly IKycWorkPolicy[],
  ): Promise<IKycWorkItem[]> {
    requireRule(
      context.capabilities.includes(Capability.SYNTHETIC_KYC) && validUuid(context.operatorId)
      && Number.isInteger(limit)
      && limit >= 1
      && limit <= 200,
    );

    return this.runtime.run(
      TransactionIsolation.READ_COMMITTED,
      async (session) => {
        const rows = await session.query(
          "SELECT c.player_id,c.kyc_case_id,t.check_type FROM player_kyc_cases c JOIN jsonb_to_recordset($3::jsonb) p(level text,version text,checks jsonb) ON p.level=c.required_level AND p.version=c.policy_version CROSS JOIN LATERAL jsonb_array_elements_text(p.checks) t(check_type) WHERE c.operator_id=$1 AND c.status IN ('OPEN','IN_REVIEW') AND c.opened_at<=$2::timestamptz AND NOT EXISTS(SELECT 1 FROM player_kyc_checks k WHERE k.operator_id=c.operator_id AND k.kyc_case_id=c.kyc_case_id AND k.check_type=t.check_type AND k.attempt_no=1) ORDER BY c.opened_at,c.kyc_case_id,t.check_type LIMIT $4",
          [context.operatorId, cutoff, JSON.stringify(policies), limit],
        );

        return rows.map(
          row => {
            const checkType = Object.values(KycCheckType).find(value => value === row.check_type);

            requireRule(
              typeof row.player_id === 'string' && validUuid(row.player_id)
              && typeof row.kyc_case_id === 'string'
              && validUuid(row.kyc_case_id)
              && checkType !== undefined,
            );

            if (typeof row.player_id !== 'string' || typeof row.kyc_case_id !== 'string' || !checkType) {
              throw new Error('Invalid due KYC reference');
            }

            return { playerId: row.player_id, caseId: row.kyc_case_id, checkType, attemptNo: 1 };
          },
        );
      },
    );
  }
}
