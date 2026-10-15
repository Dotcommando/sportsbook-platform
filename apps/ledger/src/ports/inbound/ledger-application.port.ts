import type {
  CancelBetPort,
  CompleteWithdrawalPort,
  CreateWalletPort,
  DepositTestFundsPort,
  GetBalancePort,
  GetBetFinancialStatusPort,
  GetCommandOutcomePort,
  GetLedgerEntriesPort,
  GetTransactionPort,
  GetWalletPort,
  GetWalletTransactionsPort,
  GetWithdrawalPort,
  ProvisionPlayerWalletPort,
  PublishOutboxBatchPort,
  ReconcileLedgerPort,
  RejectWithdrawalPort,
  RequestWithdrawalPort,
  ReserveStakePort,
  SettleLossPort,
  SettleWinPort,
} from './ledger-operations.port.js';

export interface ILedgerOperationPorts {
  createWallet: CreateWalletPort;
  depositTestFunds: DepositTestFundsPort;
  requestWithdrawal: RequestWithdrawalPort;
  completeWithdrawal: CompleteWithdrawalPort;
  rejectWithdrawal: RejectWithdrawalPort;
  reserveStake: ReserveStakePort;
  settleWin: SettleWinPort;
  settleLoss: SettleLossPort;
  cancelBet: CancelBetPort;
  getBalance: GetBalancePort;
  getTransaction: GetTransactionPort;
  getLedgerEntries: GetLedgerEntriesPort;
  getWalletTransactions: GetWalletTransactionsPort;
  getBetFinancialStatus: GetBetFinancialStatusPort;
  getWithdrawal: GetWithdrawalPort;
  getCommandOutcome: GetCommandOutcomePort;
  getWallet: GetWalletPort;
  reconcileLedger: ReconcileLedgerPort;
  publishOutboxBatch: PublishOutboxBatchPort;
  provisionPlayerWallet: ProvisionPlayerWalletPort;
}
