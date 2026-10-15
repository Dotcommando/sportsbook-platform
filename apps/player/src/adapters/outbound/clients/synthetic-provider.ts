import * as M from '../../../domain/player.model.js';
import { PlayerError, requireRule } from '../../../domain/player.policy.js';
import type { KycProviderPort, SyntheticVerificationPort } from '../../../ports/outbound/player.port.js';

export interface ISyntheticProof { operatorId: string; contactId: string; proofRef: string; }

export interface ISyntheticCheck { operatorId: string; check: M.IKycCheck; }

export class SyntheticVerification implements SyntheticVerificationPort {
  private readonly fixtures: readonly ISyntheticProof[];

  constructor(fixtures: readonly ISyntheticProof[]) {
    this.fixtures = Object.freeze(structuredClone(fixtures).map(value => Object.freeze(value)));
  }

  async verify(context: M.ICallContext, contactId: string, proofRef: string): Promise<boolean> {
    requireRule(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(proofRef));

    return this.fixtures.some(
      value =>
        value.operatorId === context.operatorId && value.contactId === contactId
        && value.proofRef === proofRef,
    );
  }
}

export class SyntheticKycClient implements KycProviderPort {
  private readonly fixtures: readonly ISyntheticCheck[];

  constructor(fixtures: readonly ISyntheticCheck[]) {
    this.fixtures = Object.freeze(structuredClone(fixtures).map(value => Object.freeze(value)));
  }

  async requestCheck(
    context: M.ICallContext,
    caseId: string,
    checkType: M.KycCheckType,
    attemptNo: number,
    commandId: string,
  ): Promise<M.IKycCheck> {
    const found = this.fixtures.find(
      value =>
        value.operatorId === context.operatorId && value.check.caseId === caseId
        && value.check.checkType === checkType
        && value.check.attemptNo === attemptNo
        && value.check.checkId === commandId,
    );

    if (!found) {
      throw new PlayerError(M.ErrorCode.DEPENDENCY_UNAVAILABLE);
    }

    return structuredClone(found.check);
  }
}
