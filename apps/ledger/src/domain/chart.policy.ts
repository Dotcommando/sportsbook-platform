import type { CurrencyCode, IChartAccountIds, UUID } from './ledger.model.js';

export function deriveChart(
  operatorId: UUID,
  walletId: UUID,
  currency: CurrencyCode,
  derive: (operatorId: UUID, identity: UUID, purpose: string) => UUID,
): IChartAccountIds {
  return {
    available: derive(operatorId, walletId, 'ledger:account:AVAILABLE'),
    reserved: derive(operatorId, walletId, 'ledger:account:RESERVED'),
    withdrawalHold: derive(operatorId, walletId, 'ledger:account:WITHDRAWAL_HOLD'),
    clearing: derive(operatorId, operatorId, `ledger:account:${currency}:CLEARING`),
    revenue: derive(operatorId, operatorId, `ledger:account:${currency}:REVENUE`),
    expense: derive(operatorId, operatorId, `ledger:account:${currency}:EXPENSE`),
  };
}
