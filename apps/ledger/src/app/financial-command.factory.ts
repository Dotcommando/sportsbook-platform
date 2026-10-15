import { deriveChart } from '../domain/chart.policy.js';
import type { CurrencyCode, IChartAccountIds, UUID } from '../domain/ledger.model.js';
import { AccountKind, TransactionType } from '../domain/ledger.model.js';
import type { IdGeneratorPort } from '../ports/outbound/financial.port.js';

export function chartIds(
  ids: IdGeneratorPort,
  operatorId: UUID,
  walletId: UUID,
  currency: CurrencyCode,
): IChartAccountIds {
  return deriveChart(
    operatorId,
    walletId,
    currency,
    (operator, identity, purpose) => ids.derive(operator, identity, purpose),
  );
}

export const POSTING_ACCOUNTS: Readonly<Record<TransactionType, readonly AccountKind[]>> = {
  [TransactionType.DEPOSIT]: [AccountKind.CLEARING, AccountKind.AVAILABLE],
  [TransactionType.RESERVE_STAKE]: [AccountKind.AVAILABLE, AccountKind.RESERVED],
  [TransactionType.SETTLE_WIN]: [AccountKind.RESERVED, AccountKind.EXPENSE, AccountKind.AVAILABLE],
  [TransactionType.SETTLE_LOSS]: [AccountKind.RESERVED, AccountKind.REVENUE],
  [TransactionType.CANCEL_RESERVATION]: [AccountKind.RESERVED, AccountKind.AVAILABLE],
  [TransactionType.WITHDRAWAL_HOLD]: [AccountKind.AVAILABLE, AccountKind.WITHDRAWAL_HOLD],
  [TransactionType.WITHDRAWAL_COMPLETE]: [AccountKind.WITHDRAWAL_HOLD, AccountKind.CLEARING],
  [TransactionType.WITHDRAWAL_REJECT]: [AccountKind.WITHDRAWAL_HOLD, AccountKind.AVAILABLE],
};
