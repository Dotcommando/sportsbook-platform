import { createHash } from 'node:crypto';

import type { ICallContext, IWithdrawalView } from '../../../domain/ledger.model.js';
import type { ISyntheticPaymentDecision } from '../../../domain/synthetic-payment.model.js';
import { SyntheticPaymentDecision } from '../../../domain/synthetic-payment.model.js';
import type { SyntheticPaymentPort } from '../../../ports/outbound/synthetic-payment.port.js';

export interface ISyntheticPaymentSettings {
  seed: string;
  rejectionsPerMillion: number;
  rejectionReason: string;
  providers: readonly {
    operatorId: string;
    actorId: string;
    name: string;
  }[];
}

export class SyntheticPaymentClient implements SyntheticPaymentPort {
  private readonly settings: ISyntheticPaymentSettings;

  constructor(settings: ISyntheticPaymentSettings) {
    if (!/^(0|[1-9][0-9]{0,18})$/.test(settings.seed) || BigInt(settings.seed) > 9223372036854775807n
      || !Number.isInteger(settings.rejectionsPerMillion)
      || settings.rejectionsPerMillion < 0
      || settings.rejectionsPerMillion > 1000000
      || !/^[A-Z][A-Z0-9_]{0,63}$/.test(settings.rejectionReason)
      || !settings.providers.length
      || settings.providers.some(p => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(p.name))) {
      throw new Error('Explicit synthetic payment fixture settings required');
    }
    this.settings = structuredClone(settings);
  }

  async decide(context: ICallContext, withdrawal: IWithdrawalView): Promise<ISyntheticPaymentDecision> {
    const provider = this.settings.providers.find(
      p => p.operatorId === context.operatorId && p.actorId === context.actorId,
    );

    if (!provider) {
      throw new Error('No configured synthetic provider');
    }

    const bucket = createHash('sha256').update(
      JSON.stringify([this.settings.seed, context.operatorId, withdrawal.withdrawalId]),
    ).digest().readUInt32BE(
      0,
    )
      % 1000000;

    return bucket < this.settings.rejectionsPerMillion
      ? { decision: SyntheticPaymentDecision.REJECT, reasonCode: this.settings.rejectionReason }
      : {
        decision: SyntheticPaymentDecision.COMPLETE,
        providerRef: provider.name + ':' + withdrawal.withdrawalId,
      };
  }
}
