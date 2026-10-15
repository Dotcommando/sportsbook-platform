import type { ISyntheticPaymentSettings } from '../adapters/outbound/clients/synthetic-payment.client.js';
import { SyntheticPaymentClient } from '../adapters/outbound/clients/synthetic-payment.client.js';
import { CommandFingerprint } from '../adapters/outbound/ids/command-fingerprint.js';
import { UuidGenerator } from '../adapters/outbound/ids/uuid-generator.js';
import { RunSyntheticPaymentBatchUseCase } from '../app/use-cases/run-synthetic-payment-batch.use-case.js';
import type { IOperatorFinancialPolicy } from '../domain/ledger.model.js';
import type { RunSyntheticPaymentBatchPort } from '../ports/inbound/synthetic-payment-batch.port.js';
import type { ClockPort } from '../ports/outbound/financial.port.js';
import type { ILedgerApplication } from './ledger-application.factory.js';

export function createLedgerPaymentWorker(
  application: ILedgerApplication,
  namespace: string,
  policies: readonly IOperatorFinancialPolicy[],
  clock: ClockPort,
  settings: ISyntheticPaymentSettings,
): RunSyntheticPaymentBatchPort {
  return new RunSyntheticPaymentBatchUseCase(
    {
      unitOfWork: application.persistence.unitOfWork,
      ids: new UuidGenerator(namespace),
      clock,
      policies,
      fingerprint: new CommandFingerprint(),
    },
    new SyntheticPaymentClient(settings),
    application.operations.completeWithdrawal,
    application.operations.rejectWithdrawal,
  );
}
