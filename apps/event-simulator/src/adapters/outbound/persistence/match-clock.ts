import type { IQuerySession } from '@sportsbook/persistence';

import * as M from '../../../domain/events.model.js';
import { EventsError, requireRule, validInstant } from '../../../domain/events.policy.js';
import type { MatchClockPort } from '../../../ports/outbound/events.port.js';

export class PersistedMatchClock implements MatchClockPort {
  constructor(
    private readonly session: IQuerySession,
    private readonly operatorId: string,
    private readonly runId: string,
  ) { }

  async read(context: M.ICallContext, runId: string): Promise<{ simulatedAt: string; phaseSeq: bigint }> {
    requireRule(
      context.operatorId === this.operatorId && runId === this.runId,
      M.ErrorCode.PERMISSION_DENIED,
    );
    const rows = await this.session.query(
      'SELECT simulated_at,clock_seq::text FROM event_runs WHERE operator_id=$1 AND run_id=$2 FOR UPDATE',
      [context.operatorId, runId],
    );
    const row = rows[0];

    if (!row || typeof row.clock_seq !== 'string' || !(row.simulated_at instanceof Date)) {
      throw new EventsError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
    }

    return { simulatedAt: row.simulated_at.toISOString(), phaseSeq: BigInt(row.clock_seq) };
  }

  async advance(
    context: M.ICallContext,
    runId: string,
    expectedSeq: bigint,
    simulatedAt: string,
  ): Promise<void> {
    requireRule(
      context.operatorId === this.operatorId && runId === this.runId
      && context.actorKind === M.ActorKind.SYSTEM
      && context.capabilities.includes(M.Capability.MATCH_CONTROL),
      M.ErrorCode.PERMISSION_DENIED,
    );
    requireRule(validInstant(simulatedAt));
    const rows = await this.session.query(
      'UPDATE event_runs SET simulated_at=$3,clock_seq=clock_seq+1 WHERE operator_id=$1 AND run_id=$2 AND clock_seq=$4::bigint AND simulated_at<=$3::timestamptz RETURNING run_id',
      [context.operatorId, runId, simulatedAt, expectedSeq.toString()],
    );

    requireRule(rows.length === 1, M.ErrorCode.VERSION_CONFLICT);
  }
}
