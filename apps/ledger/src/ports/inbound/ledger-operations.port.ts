import type {
  ILedgerCancelBetInput,
  ILedgerCancelBetOutput,
  ILedgerCompleteWithdrawalInput,
  ILedgerCompleteWithdrawalOutput,
  ILedgerCreateWalletInput,
  ILedgerCreateWalletOutput,
  ILedgerDepositTestFundsInput,
  ILedgerDepositTestFundsOutput,
  ILedgerGetBalanceInput,
  ILedgerGetBalanceOutput,
  ILedgerGetBetFinancialStatusInput,
  ILedgerGetBetFinancialStatusOutput,
  ILedgerGetCommandOutcomeInput,
  ILedgerGetCommandOutcomeOutput,
  ILedgerGetLedgerEntriesInput,
  ILedgerGetLedgerEntriesOutput,
  ILedgerGetTransactionInput,
  ILedgerGetTransactionOutput,
  ILedgerGetWalletInput,
  ILedgerGetWalletOutput,
  ILedgerGetWalletTransactionsInput,
  ILedgerGetWalletTransactionsOutput,
  ILedgerGetWithdrawalInput,
  ILedgerGetWithdrawalOutput,
  ILedgerProvisionPlayerWalletInput,
  ILedgerProvisionPlayerWalletOutput,
  ILedgerPublishOutboxBatchInput,
  ILedgerPublishOutboxBatchOutput,
  ILedgerReconcileLedgerInput,
  ILedgerReconcileLedgerOutput,
  ILedgerRejectWithdrawalInput,
  ILedgerRejectWithdrawalOutput,
  ILedgerRequestWithdrawalInput,
  ILedgerRequestWithdrawalOutput,
  ILedgerReserveStakeInput,
  ILedgerReserveStakeOutput,
  ILedgerSettleLossInput,
  ILedgerSettleLossOutput,
  ILedgerSettleWinInput,
  ILedgerSettleWinOutput,
  IResult,
} from '../../domain/ledger.model.js';

export interface CreateWalletPort {
  execute(input: ILedgerCreateWalletInput): Promise<IResult<ILedgerCreateWalletOutput>>;
}

export interface GetBalancePort {
  execute(input: ILedgerGetBalanceInput): Promise<IResult<ILedgerGetBalanceOutput>>;
}

export interface GetTransactionPort {
  execute(input: ILedgerGetTransactionInput): Promise<IResult<ILedgerGetTransactionOutput>>;
}

export interface GetLedgerEntriesPort {
  execute(input: ILedgerGetLedgerEntriesInput): Promise<IResult<ILedgerGetLedgerEntriesOutput>>;
}

export interface GetWalletTransactionsPort {
  execute(input: ILedgerGetWalletTransactionsInput): Promise<IResult<ILedgerGetWalletTransactionsOutput>>;
}

export interface GetBetFinancialStatusPort {
  execute(input: ILedgerGetBetFinancialStatusInput): Promise<IResult<ILedgerGetBetFinancialStatusOutput>>;
}

export interface GetWithdrawalPort {
  execute(input: ILedgerGetWithdrawalInput): Promise<IResult<ILedgerGetWithdrawalOutput>>;
}

export interface GetCommandOutcomePort {
  execute(input: ILedgerGetCommandOutcomeInput): Promise<IResult<ILedgerGetCommandOutcomeOutput>>;
}

export interface DepositTestFundsPort {
  execute(input: ILedgerDepositTestFundsInput): Promise<IResult<ILedgerDepositTestFundsOutput>>;
}

export interface RequestWithdrawalPort {
  execute(input: ILedgerRequestWithdrawalInput): Promise<IResult<ILedgerRequestWithdrawalOutput>>;
}

export interface CompleteWithdrawalPort {
  execute(input: ILedgerCompleteWithdrawalInput): Promise<IResult<ILedgerCompleteWithdrawalOutput>>;
}

export interface RejectWithdrawalPort {
  execute(input: ILedgerRejectWithdrawalInput): Promise<IResult<ILedgerRejectWithdrawalOutput>>;
}

export interface ReserveStakePort {
  execute(input: ILedgerReserveStakeInput): Promise<IResult<ILedgerReserveStakeOutput>>;
}

export interface SettleWinPort {
  execute(input: ILedgerSettleWinInput): Promise<IResult<ILedgerSettleWinOutput>>;
}

export interface SettleLossPort {
  execute(input: ILedgerSettleLossInput): Promise<IResult<ILedgerSettleLossOutput>>;
}

export interface CancelBetPort {
  execute(input: ILedgerCancelBetInput): Promise<IResult<ILedgerCancelBetOutput>>;
}

export interface ReconcileLedgerPort {
  execute(input: ILedgerReconcileLedgerInput): Promise<IResult<ILedgerReconcileLedgerOutput>>;
}

export interface GetWalletPort {
  execute(input: ILedgerGetWalletInput): Promise<IResult<ILedgerGetWalletOutput>>;
}

export interface PublishOutboxBatchPort {
  execute(input: ILedgerPublishOutboxBatchInput): Promise<IResult<ILedgerPublishOutboxBatchOutput>>;
}

export interface ProvisionPlayerWalletPort {
  execute(input: ILedgerProvisionPlayerWalletInput): Promise<IResult<ILedgerProvisionPlayerWalletOutput>>;
}
