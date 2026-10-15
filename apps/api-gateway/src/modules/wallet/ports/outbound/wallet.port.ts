import type * as M from '../../../../domain/gateway.model.js';

export interface WalletCommandPort {
  deposit(input: M.ILedgerDepositTestFundsInput): Promise<M.IResult<M.ILedgerDepositTestFundsOutput>>;
  requestWithdrawal(input: M.ILedgerRequestWithdrawalInput): Promise<M.IResult<M.ILedgerRequestWithdrawalOutput>>;
}

export interface WalletQueryPort {
  getWallet(input: M.ILedgerGetWalletInput): Promise<M.IResult<M.ILedgerGetWalletOutput>>;
  getWithdrawal(input: M.ILedgerGetWithdrawalInput): Promise<M.IResult<M.ILedgerGetWithdrawalOutput>>;
  listTransactions(
    input: M.ILedgerGetWalletTransactionsInput
  ): Promise<
    M.IResult<
      M.ILedgerGetWalletTransactionsOutput
    >
  >;
}
