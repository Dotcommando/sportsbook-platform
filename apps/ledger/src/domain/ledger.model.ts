export type UUID = string;

export type Instant = string;

export type CurrencyCode = string;

export type OpaqueCursor = string;

export type Sha256 = string;

export enum ActorKind {
  PLAYER = 'PLAYER',
  SERVICE = 'SERVICE',
  SYSTEM = 'SYSTEM',
}

export enum Side {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum WalletState {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

export enum JournalStatus {
  POSTED = 'POSTED',
  REJECTED = 'REJECTED',
}

export enum AccountKind {
  AVAILABLE = 'AVAILABLE'
  ,
  RESERVED = 'RESERVED'
  ,
  WITHDRAWAL_HOLD = 'WITHDRAWAL_HOLD'
  ,
  CLEARING = 'CLEARING'
  ,
  REVENUE = 'REVENUE'
  ,
  EXPENSE = 'EXPENSE'
  ,
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT'
  ,
  RESERVE_STAKE = 'RESERVE_STAKE'
  ,
  SETTLE_WIN = 'SETTLE_WIN'
  ,
  SETTLE_LOSS = 'SETTLE_LOSS'
  ,
  CANCEL_RESERVATION = 'CANCEL_RESERVATION'
  ,
  WITHDRAWAL_HOLD = 'WITHDRAWAL_HOLD'
  ,
  WITHDRAWAL_COMPLETE = 'WITHDRAWAL_COMPLETE'
  ,
  WITHDRAWAL_REJECT = 'WITHDRAWAL_REJECT'
  ,
}

export enum FinancialState {
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export enum ReservationState {
  RESERVED = 'RESERVED'
  ,
  WON = 'WON'
  ,
  LOST = 'LOST'
  ,
  CANCELED = 'CANCELED'
  ,
}

export enum WithdrawalState {
  HELD = 'HELD',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export enum CommandState {
  IN_PROGRESS = 'IN_PROGRESS'
  ,
  COMPLETED = 'COMPLETED'
  ,
  FAILED_FINAL = 'FAILED_FINAL'
  ,
}

export enum RefundReason {
  VOID = 'VOID'
  ,
  CANCELED = 'CANCELED'
  ,
  ACCEPTANCE_FAILED = 'ACCEPTANCE_FAILED'
  ,
}

export enum AuditState {
  PASS = 'PASS',
  FAIL = 'FAIL',
}

export enum ClaimKind {
  NEW = 'NEW',
  REPLAY = 'REPLAY',
  IN_PROGRESS = 'IN_PROGRESS',
}

export enum EventSource {
  EVENTS = 'EVENTS'
  ,
  PLAYER = 'PLAYER'
  ,
  BETTING = 'BETTING'
  ,
  LEDGER = 'LEDGER'
  ,
}

export enum EventType {
  PLAYER_REGISTERED = 'PLAYER_REGISTERED'
  ,
  PLAYER_PROFILE_CHANGED = 'PLAYER_PROFILE_CHANGED'
  ,
  PLAYER_ELIGIBILITY_CHANGED = 'PLAYER_ELIGIBILITY_CHANGED'
  ,
  MATCH_PHASE_CHANGED = 'MATCH_PHASE_CHANGED'
  ,
  EVENT_RESULT = 'EVENT_RESULT'
  ,
  BET_STATE_CHANGED = 'BET_STATE_CHANGED'
  ,
  LEDGER_POSTED = 'LEDGER_POSTED'
  ,
  WITHDRAWAL_RESOLVED = 'WITHDRAWAL_RESOLVED'
  ,
  WALLET_CREATED = 'WALLET_CREATED'
  ,
}

export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT'
  ,
  AMOUNT_OUT_OF_RANGE = 'AMOUNT_OUT_OF_RANGE'
  ,
  CURRENCY_MISMATCH = 'CURRENCY_MISMATCH'
  ,
  UNAUTHENTICATED = 'UNAUTHENTICATED'
  ,
  PERMISSION_DENIED = 'PERMISSION_DENIED'
  ,
  NOT_FOUND = 'NOT_FOUND'
  ,
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT'
  ,
  VERSION_CONFLICT = 'VERSION_CONFLICT'
  ,
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS'
  ,
  INELIGIBLE = 'INELIGIBLE'
  ,
  STALE_QUOTE = 'STALE_QUOTE'
  ,
  MARKET_CLOSED = 'MARKET_CLOSED'
  ,
  INVALID_STATE = 'INVALID_STATE'
  ,
  IN_PROGRESS = 'IN_PROGRESS'
  ,
  OVERLOADED = 'OVERLOADED'
  ,
  DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED'
  ,
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE'
  ,
  ADAPTER_CONTRACT_VIOLATION = 'ADAPTER_CONTRACT_VIOLATION'
  ,
  INVARIANT_VIOLATION = 'INVARIANT_VIOLATION'
  ,
}

export enum Capability {
  CREATE_WALLET = 'CREATE_WALLET'
  ,
  READ_WALLET = 'READ_WALLET'
  ,
  READ_JOURNAL = 'READ_JOURNAL'
  ,
  FUND_SYNTHETIC = 'FUND_SYNTHETIC'
  ,
  WITHDRAW = 'WITHDRAW'
  ,
  PAYMENT_SIMULATOR = 'PAYMENT_SIMULATOR'
  ,
  RESERVE_STAKE = 'RESERVE_STAKE'
  ,
  SETTLE_BET = 'SETTLE_BET'
  ,
  CANCEL_RESERVATION = 'CANCEL_RESERVATION'
  ,
  RECONCILE_LEDGER = 'RECONCILE_LEDGER'
  ,
  PUBLISH_EVENTS = 'PUBLISH_EVENTS'
  ,
}

export interface IError {
  code: ErrorCode;
  message: string;
  correlationId: UUID;
  fields?: { path: string; code: string }[];
  retryable: boolean;
  outcomeUnknown: boolean;
  retryAfterMs?: number;
}

export type IResult<T> = { ok: true; value: T } | { ok: false; error: IError };

export interface ICallContext {
  operatorId: UUID;
  actorId: UUID;
  actorKind: ActorKind;
  playerId?: UUID;
  capabilities: Capability[];
  correlationId: UUID;
  deadlineAt: Instant;
}

export interface IMoney { amountMinor: bigint; currency: CurrencyCode; }

export interface IPageInput { limit: number; cursor?: OpaqueCursor; from?: Instant; to?: Instant; }

export interface IWalletView {
  walletId: UUID;
  playerId: UUID;
  currency: CurrencyCode;
  status: WalletState;
  availableMinor: bigint;
  reservedMinor: bigint;
  withdrawalHoldMinor: bigint;
  version: bigint;
  observedAt: Instant;
}

export interface IJournalView {
  transactionId: UUID;
  requestId: UUID;
  transactionType: TransactionType;
  businessRef: string;
  currency: CurrencyCode;
  status: JournalStatus;
  postedAt?: Instant;
  entries: IEntry[];
}

export interface IEntry {
  entryId: UUID;
  accountId: UUID;
  transactionId: UUID;
  entryNo: number;
  side: Side;
  amountMinor: bigint;
  currency: CurrencyCode;
  postedAt: Instant;
}

export interface IFinancialOutcome {
  requestId: UUID;
  state: FinancialState;
  transactionId?: UUID;
  businessRef: UUID;
  wallet: IWalletView;
  reasonCode?: ErrorCode;
  replayed: boolean;
}

export interface IReservationView {
  betId: UUID;
  walletId: UUID;
  stake: IMoney;
  state: ReservationState;
  reservationTransactionId: UUID;
  settlementTransactionId?: UUID;
  settlementSeq?: bigint;
  grossPayoutMinor?: bigint;
}

export interface IWithdrawalView {
  withdrawalId: UUID;
  walletId: UUID;
  amount: IMoney;
  state: WithdrawalState;
  holdTransactionId: UUID;
  resolutionTransactionId?: UUID;
  providerRef?: string;
  reasonCode?: string;
  createdAt: Instant;
  resolvedAt?: Instant;
}

export interface IReconciliationReport {
  runId: UUID;
  snapshotAt: Instant;
  status: AuditState;
  counts: { transactions: bigint; entries: bigint; violations: bigint };
  violations: { code: string; businessRef?: UUID }[];
  nextCursor?: OpaqueCursor;
}

export interface IBatchReport {
  selected: number;
  applied: number;
  replayed: number;
  rejected: number;
  pending: number;
  failed: number;
  nextCursor?: OpaqueCursor;
}

export interface ILedgerCreateWalletInput {
  context: ICallContext;
  requestId: UUID;
  playerId: UUID;
  currency: CurrencyCode;
}

export interface ILedgerCreateWalletOutput { wallet: IWalletView; created: boolean; }

export interface ILedgerGetBalanceInput { context: ICallContext; walletId: UUID; }

export interface ILedgerGetBalanceOutput { wallet: IWalletView; }

export interface ILedgerGetTransactionInput { context: ICallContext; transactionId: UUID; }

export interface ILedgerGetTransactionOutput { transaction: IJournalView; }

export interface ILedgerGetLedgerEntriesInput {
  context: ICallContext;
  walletId: UUID;
  page: IPageInput;
}

export interface ILedgerGetLedgerEntriesOutput {
  entries: IEntry[];
  nextCursor?: OpaqueCursor;
  observedAt: Instant;
}

export interface ILedgerGetWalletTransactionsInput {
  context: ICallContext;
  walletId: UUID;
  page: IPageInput;
}

export interface ILedgerGetWalletTransactionsOutput {
  transactions: IJournalView[];
  nextCursor?: OpaqueCursor;
  observedAt: Instant;
}

export interface ILedgerGetBetFinancialStatusInput { context: ICallContext; betId: UUID; }

export interface ILedgerGetBetFinancialStatusOutput {
  reservation?: IReservationView;
  observedAt: Instant;
}

export interface ILedgerGetWithdrawalInput { context: ICallContext; withdrawalId: UUID; }

export interface ILedgerGetWithdrawalOutput { withdrawal: IWithdrawalView; }

export interface ILedgerGetCommandOutcomeInput { context: ICallContext; requestId: UUID; }

export interface ILedgerGetCommandOutcomeOutput {
  found: boolean;
  operation?: string;
  state?: CommandState;
  result?: IResult<RegisteredOutput>;
}

export interface ILedgerDepositTestFundsInput {
  context: ICallContext;
  requestId: UUID;
  walletId: UUID;
  amount: IMoney;
  providerRef: string;
}

export interface ILedgerDepositTestFundsOutput { outcome: IFinancialOutcome; }

export interface ILedgerRequestWithdrawalInput {
  context: ICallContext;
  requestId: UUID;
  walletId: UUID;
  withdrawalId: UUID;
  amount: IMoney;
}

export interface ILedgerRequestWithdrawalOutput {
  withdrawal: IWithdrawalView;
  outcome: IFinancialOutcome;
}

export interface ILedgerCompleteWithdrawalInput {
  context: ICallContext;
  requestId: UUID;
  withdrawalId: UUID;
  providerRef: string;
}

export interface ILedgerCompleteWithdrawalOutput {
  withdrawal: IWithdrawalView;
  outcome: IFinancialOutcome;
}

export interface ILedgerRejectWithdrawalInput {
  context: ICallContext;
  requestId: UUID;
  withdrawalId: UUID;
  reasonCode: string;
}

export interface ILedgerRejectWithdrawalOutput {
  withdrawal: IWithdrawalView;
  outcome: IFinancialOutcome;
}

export interface ILedgerReserveStakeInput {
  context: ICallContext;
  requestId: UUID;
  betId: UUID;
  walletId: UUID;
  stake: IMoney;
}

export interface ILedgerReserveStakeOutput {
  reservation: IReservationView;
  outcome: IFinancialOutcome;
}

export interface ILedgerSettleWinInput {
  context: ICallContext;
  requestId: UUID;
  betId: UUID;
  settlementSeq: bigint;
  grossPayout: IMoney;
}

export interface ILedgerSettleWinOutput {
  reservation: IReservationView;
  outcome: IFinancialOutcome;
}

export interface ILedgerSettleLossInput {
  context: ICallContext;
  requestId: UUID;
  betId: UUID;
  settlementSeq: bigint;
}

export interface ILedgerSettleLossOutput {
  reservation: IReservationView;
  outcome: IFinancialOutcome;
}

export interface ILedgerCancelBetInput {
  context: ICallContext;
  requestId: UUID;
  betId: UUID;
  reasonCode: RefundReason;
}

export interface ILedgerCancelBetOutput {
  reservation: IReservationView;
  outcome: IFinancialOutcome;
}

export interface ILedgerReconcileLedgerInput {
  context: ICallContext;
  requestId: UUID;
  runId: UUID;
  cutoff: Instant;
  page: IPageInput;
}

export interface ILedgerReconcileLedgerOutput { report: IReconciliationReport; }

export interface ILedgerGetWalletInput {
  context: ICallContext;
  playerId: UUID;
  currency: CurrencyCode;
}

export interface ILedgerGetWalletOutput { wallet: IWalletView; }

export interface IAccountState {
  accountId: UUID;
  walletId?: UUID;
  currency: CurrencyCode;
  accountKind: AccountKind;
  normalSide: Side;
  balanceMinor: bigint;
  version: bigint;
}

export interface IAccountDelta { accountId: UUID; currency: CurrencyCode; deltaMinor: bigint; }

export interface IWorkerBatchInput {
  context: ICallContext;
  batchId: UUID;
  limit: number;
  cutoff: Instant;
}

export interface ILedgerPublishOutboxBatchInput { input: IWorkerBatchInput; }

export interface ILedgerPublishOutboxBatchOutput { report: IBatchReport; }

export interface ILedgerProvisionPlayerWalletInput {
  context: ICallContext;
  envelope: IEventEnvelope;
  playerId: UUID;
  currencies: CurrencyCode[];
}

export interface ILedgerProvisionPlayerWalletOutput { wallets: IWalletView[]; }

export interface IEventEnvelope {
  messageId: UUID;
  source: EventSource;
  eventType: EventType;
  schemaVersion: number;
  operatorId: UUID;
  correlationId: UUID;
  occurredAt: Instant;
  payload: IEventPayload;
}

export interface IEventPayload {
  transactionId?: UUID;
  requestId?: UUID;
  businessRef?: UUID;
  transactionType?: TransactionType;
  currency?: CurrencyCode;
  amountMinor?: bigint;
  walletId?: UUID;
  playerId?: UUID;
  registeredAt?: Instant;
  withdrawalId?: UUID;
  state?: WithdrawalState;
  resolutionTransactionId?: UUID;
}

export interface IStableChildId { purpose: string; id: UUID; }

export interface IStoredCommand {
  requestId: UUID;
  operation: string;
  payloadHash: Sha256;
  state: CommandState;
  outcome?: IResult<RegisteredOutput>;
  actorId: UUID;
  actorKind: ActorKind;
  playerId?: UUID;
  updatedAt: Instant;
  semanticInput: RegisteredInput;
  stableChildIds: IStableChildId[];
}

export interface IClaimResult { kind: ClaimKind; command: IStoredCommand; }

export interface IOutboxLease {
  leaseId: UUID;
  message: IEventEnvelope;
  attemptNo: number;
  leaseUntil: Instant;
}

export interface IPublicationReceipt { messageId: UUID; acceptedAt: Instant; durable: boolean; }

export type RegisteredInput = ILedgerCreateWalletInput
  | ILedgerGetBalanceInput
  | ILedgerGetTransactionInput
  | ILedgerGetLedgerEntriesInput
  | ILedgerGetWalletTransactionsInput
  | ILedgerGetBetFinancialStatusInput
  | ILedgerGetWithdrawalInput
  | ILedgerGetCommandOutcomeInput
  | ILedgerDepositTestFundsInput
  | ILedgerRequestWithdrawalInput
  | ILedgerCompleteWithdrawalInput
  | ILedgerRejectWithdrawalInput
  | ILedgerReserveStakeInput
  | ILedgerSettleWinInput
  | ILedgerSettleLossInput
  | ILedgerCancelBetInput
  | ILedgerReconcileLedgerInput
  | ILedgerGetWalletInput
  | ILedgerPublishOutboxBatchInput
  | ILedgerProvisionPlayerWalletInput;

export type RegisteredOutput = ILedgerCreateWalletOutput
  | ILedgerGetBalanceOutput
  | ILedgerGetTransactionOutput
  | ILedgerGetLedgerEntriesOutput
  | ILedgerGetWalletTransactionsOutput
  | ILedgerGetBetFinancialStatusOutput
  | ILedgerGetWithdrawalOutput
  | ILedgerGetCommandOutcomeOutput
  | ILedgerDepositTestFundsOutput
  | ILedgerRequestWithdrawalOutput
  | ILedgerCompleteWithdrawalOutput
  | ILedgerRejectWithdrawalOutput
  | ILedgerReserveStakeOutput
  | ILedgerSettleWinOutput
  | ILedgerSettleLossOutput
  | ILedgerCancelBetOutput
  | ILedgerReconcileLedgerOutput
  | ILedgerGetWalletOutput
  | ILedgerPublishOutboxBatchOutput
  | ILedgerProvisionPlayerWalletOutput;

export interface ICurrencyPolicy {
  currency: CurrencyCode;
  minimumMinor: bigint;
  maximumMinor: bigint;
}

export interface IOperatorFinancialPolicy {
  operatorId: UUID;
  currencies: readonly ICurrencyPolicy[];
  providerNames: readonly string[];
  rejectionReasons: readonly string[];
  trustedActors: readonly {
    actorId: UUID;

    actorKind: ActorKind;

    capabilities: readonly Capability[];

    providerName?: string

  }[];
}

export interface IChartAccountIds {
  available: UUID;
  reserved: UUID;
  withdrawalHold: UUID;
  clearing: UUID;
  revenue: UUID;
  expense: UUID;
}
