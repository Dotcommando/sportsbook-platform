import { CommandFingerprint } from '../adapters/outbound/ids/command-fingerprint.js';
import { UuidGenerator } from '../adapters/outbound/ids/uuid-generator.js';
import type { ILedgerPersistence, ILedgerPersistenceSettings } from '../adapters/outbound/persistence/financial-persistence.factory.js';
import { createFinancialPersistence } from '../adapters/outbound/persistence/financial-persistence.factory.js';
import type { ILedgerCommandDependencies } from '../app/services/financial-command.service.js';
import type { ILedgerReadDependencies } from '../app/services/financial-query.service.js';
import { CancelBetUseCase } from '../app/use-cases/cancel-bet.use-case.js';
import { CompleteWithdrawalUseCase } from '../app/use-cases/complete-withdrawal.use-case.js';
import { CreateWalletUseCase } from '../app/use-cases/create-wallet.use-case.js';
import { DepositTestFundsUseCase } from '../app/use-cases/deposit-test-funds.use-case.js';
import { GetBalanceUseCase } from '../app/use-cases/get-balance.use-case.js';
import { GetBetFinancialStatusUseCase } from '../app/use-cases/get-bet-financial-status.use-case.js';
import { GetCommandOutcomeUseCase } from '../app/use-cases/get-command-outcome.use-case.js';
import { GetLedgerEntriesUseCase } from '../app/use-cases/get-ledger-entries.use-case.js';
import { GetTransactionUseCase } from '../app/use-cases/get-transaction.use-case.js';
import { GetWalletUseCase } from '../app/use-cases/get-wallet.use-case.js';
import { GetWalletTransactionsUseCase } from '../app/use-cases/get-wallet-transactions.use-case.js';
import { GetWithdrawalUseCase } from '../app/use-cases/get-withdrawal.use-case.js';
import { ProvisionPlayerWalletUseCase } from '../app/use-cases/provision-player-wallet.use-case.js';
import { PublishOutboxBatchUseCase } from '../app/use-cases/publish-outbox-batch.use-case.js';
import { ReconcileLedgerUseCase } from '../app/use-cases/reconcile-ledger.use-case.js';
import { RejectWithdrawalUseCase } from '../app/use-cases/reject-withdrawal.use-case.js';
import { RequestWithdrawalUseCase } from '../app/use-cases/request-withdrawal.use-case.js';
import { ReserveStakeUseCase } from '../app/use-cases/reserve-stake.use-case.js';
import { SettleLossUseCase } from '../app/use-cases/settle-loss.use-case.js';
import { SettleWinUseCase } from '../app/use-cases/settle-win.use-case.js';
import type { IOperatorFinancialPolicy } from '../domain/ledger.model.js';
import type { ILedgerOperationPorts } from '../ports/inbound/ledger-application.port.js';

export type { ILedgerOperationPorts } from '../ports/inbound/ledger-application.port.js';

import type { ClockPort, MessagePublicationPort } from '../ports/outbound/financial.port.js';

export interface ILedgerApplication { operations:ILedgerOperationPorts; persistence:ILedgerPersistence; close():Promise<void>; }

export async function createLedgerApplication(settings:ILedgerPersistenceSettings, namespace:string, policies:readonly IOperatorFinancialPolicy[], clock:ClockPort, publication:MessagePublicationPort, outboxRetryDelayMs:number):Promise<ILedgerApplication> {
  if (!Number.isInteger(outboxRetryDelayMs) || outboxRetryDelayMs < 1 || outboxRetryDelayMs > 60000) throw new Error('Invalid outbox retry delay');

  const ids = new UuidGenerator(namespace);
  const immutablePolicies = structuredClone(policies);

  for (const policy of immutablePolicies) {for (const currency of policy.currencies)Object.freeze(currency);

for (const actor of policy.trustedActors) {Object.freeze(actor.capabilities);Object.freeze(actor);}Object.freeze(policy.currencies);Object.freeze(policy.providerNames);Object.freeze(policy.rejectionReasons);Object.freeze(policy.trustedActors);Object.freeze(policy);}
  Object.freeze(immutablePolicies);
  const immutableSettings = {...settings, retry:Object.freeze({...settings.retry})};
  const persistence = await createFinancialPersistence(immutableSettings, ids, clock, immutablePolicies);
  const commands:ILedgerCommandDependencies = {unitOfWork:persistence.unitOfWork, ids, clock, fingerprint:new CommandFingerprint(), policies:immutablePolicies};
  const readers:ILedgerReadDependencies = {queries:persistence.queries, reconciliation:persistence.reconciliation, clock, policies:immutablePolicies};
  const createWallet = new CreateWalletUseCase(commands);
  const operations:ILedgerOperationPorts = {
    createWallet:createWallet,
    depositTestFunds:new DepositTestFundsUseCase(commands),
    requestWithdrawal:new RequestWithdrawalUseCase(commands),
    completeWithdrawal:new CompleteWithdrawalUseCase(commands),
    rejectWithdrawal:new RejectWithdrawalUseCase(commands),
    reserveStake:new ReserveStakeUseCase(commands),
    settleWin:new SettleWinUseCase(commands),
    settleLoss:new SettleLossUseCase(commands),
    cancelBet:new CancelBetUseCase(commands),
    getBalance:new GetBalanceUseCase(readers),
    getTransaction:new GetTransactionUseCase(readers),
    getLedgerEntries:new GetLedgerEntriesUseCase(readers),
    getWalletTransactions:new GetWalletTransactionsUseCase(readers),
    getBetFinancialStatus:new GetBetFinancialStatusUseCase(readers),
    getWithdrawal:new GetWithdrawalUseCase(readers),
    getCommandOutcome:new GetCommandOutcomeUseCase(readers),
    getWallet:new GetWalletUseCase(readers),
    reconcileLedger:new ReconcileLedgerUseCase(readers),
    publishOutboxBatch:new PublishOutboxBatchUseCase(persistence.outbox, publication, clock, outboxRetryDelayMs),
    provisionPlayerWallet:new ProvisionPlayerWalletUseCase(createWallet, ids, clock, immutablePolicies),
  };

  return {operations, persistence, close:()=>persistence.close()};
}
