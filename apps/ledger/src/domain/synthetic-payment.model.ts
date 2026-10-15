export enum SyntheticPaymentDecision {
  COMPLETE = 'COMPLETE',
  REJECT = 'REJECT',
}

export interface ISyntheticPaymentDecision {
  decision: SyntheticPaymentDecision;
  providerRef?: string;
  reasonCode?: string;
}
