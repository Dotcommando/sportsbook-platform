import type { ICallContext, Instant, KycCheckType, KycLevel } from '../../domain/player.model.js';

export interface IKycWorkPolicy {
  level: KycLevel;
  version: string;
  checks: readonly KycCheckType[];
}

export interface IKycWorkItem {
  playerId: string;
  caseId: string;
  checkType: KycCheckType;
  attemptNo: number;
}

export interface KycWorkQueryPort {
  listDue(
    context: ICallContext,
    cutoff: Instant,
    limit: number,
    policies: readonly IKycWorkPolicy[]
  ): Promise<IKycWorkItem[]>;
}
