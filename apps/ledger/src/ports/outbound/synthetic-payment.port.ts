import type { ICallContext, IWithdrawalView } from '../../domain/ledger.model.js';
import type { ISyntheticPaymentDecision } from '../../domain/synthetic-payment.model.js';

export interface SyntheticPaymentPort {
  decide(context: ICallContext, withdrawal: IWithdrawalView): Promise<ISyntheticPaymentDecision>;
}
