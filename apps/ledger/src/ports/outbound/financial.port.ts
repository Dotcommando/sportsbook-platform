import type { CurrencyCode, IAccountDelta, IAccountState, ICallContext, IClaimResult, IEntry, IEventEnvelope, IJournalView, Instant, IOutboxLease, IPageInput, IPublicationReceipt, IReconciliationReport, IReservationView, IResult, IStableChildId, IStoredCommand, IWalletView, IWithdrawalView, IWorkerBatchInput, RegisteredInput, RegisteredOutput, Sha256, UUID } from '../../domain/ledger.model.js';
import type { ReservationState, WithdrawalState } from '../../domain/ledger.model.js';

export interface AccountStorePort {
  findWallet(context: ICallContext, walletId: UUID): Promise<IWalletView | undefined>;
  createWallet(context: ICallContext, wallet: IWalletView, accountIds: UUID[]): Promise<IWalletView>;
  loadAccounts(context: ICallContext, accountIds: UUID[]): Promise<IAccountState[]>;
  applyDeltas(context: ICallContext, deltas: IAccountDelta[], expectedVersions: bigint[]): Promise<IAccountState[]>;
}

export interface JournalStorePort {
  append(context: ICallContext, posting: IJournalView): Promise<IJournalView>;
  find(context: ICallContext, transactionId: UUID): Promise<IJournalView | undefined>;
}

export interface BetReservationStorePort {
  find(context: ICallContext, betId: UUID): Promise<IReservationView | undefined>;
  create(context: ICallContext, reservation: IReservationView): Promise<IReservationView>;
  transition(context: ICallContext, betId: UUID, expectedState: ReservationState.RESERVED, next: IReservationView): Promise<IReservationView>;
}

export interface WithdrawalStorePort {
  find(context: ICallContext, withdrawalId: UUID): Promise<IWithdrawalView | undefined>;
  create(context: ICallContext, withdrawal: IWithdrawalView): Promise<IWithdrawalView>;
  transition(context: ICallContext, withdrawalId: UUID, expectedState: WithdrawalState.HELD, next: IWithdrawalView): Promise<IWithdrawalView>;
  listHeld(context: ICallContext, page: IPageInput, heldBefore: Instant): Promise<IWithdrawalView[]>;
}

export interface IdempotencyStorePort {
  find(context: ICallContext, requestId: UUID): Promise<IStoredCommand | undefined>;
  claim(context: ICallContext, requestId: UUID, operation: string, payloadHash: Sha256, semanticInput: RegisteredInput, stableChildIds: IStableChildId[]): Promise<IClaimResult>;
  complete(context: ICallContext, requestId: UUID, outcome: IResult<RegisteredOutput>): Promise<void>;
}

export interface OutboxStorePort { append(context: ICallContext, event: IEventEnvelope): Promise<void>; }

export interface IFinancialTransactionPorts {
  accounts: AccountStorePort;
journal: JournalStorePort;
reservations: BetReservationStorePort;
  withdrawals: WithdrawalStorePort;
idempotency: IdempotencyStorePort;
outbox: OutboxStorePort;
}

export interface FinancialUnitOfWorkPort {
  run<T>(context: ICallContext, work: (ports: IFinancialTransactionPorts) => Promise<IResult<T>>): Promise<IResult<T>>;
}

export interface IPageResult<T> { items: T[]; nextCursor?: string; observedAt: Instant; }

export interface FinancialQueryPort {
  getWallet(context: ICallContext, playerId: UUID, currency: CurrencyCode): Promise<IWalletView | undefined>;
  getBalance(context: ICallContext, walletId: UUID): Promise<IWalletView | undefined>;
  getTransaction(context: ICallContext, transactionId: UUID): Promise<IJournalView | undefined>;
  listEntries(context: ICallContext, walletId: UUID, page: IPageInput): Promise<IPageResult<IEntry>>;
  listTransactions(context: ICallContext, walletId: UUID, page: IPageInput): Promise<IPageResult<IJournalView>>;
  getReservation(context: ICallContext, betId: UUID): Promise<IReservationView | undefined>;
  getWithdrawal(context: ICallContext, withdrawalId: UUID): Promise<IWithdrawalView | undefined>;
  getCommandOutcome(context: ICallContext, requestId: UUID): Promise<IStoredCommand | undefined>;
}

export interface ReconciliationStorePort {
  scan(context: ICallContext, cutoff: Instant, page: IPageInput): Promise<IReconciliationReport>;
  record(context: ICallContext, report: IReconciliationReport): Promise<void>;
}

export interface OutboxDeliveryPort {
  claim(input: IWorkerBatchInput): Promise<IOutboxLease[]>;
  markDelivered(context: ICallContext, leaseId: UUID, receipt: IPublicationReceipt): Promise<void>;
  release(context: ICallContext, leaseId: UUID, nextAttemptAt: Instant, reasonCode: string): Promise<void>;
}

export interface MessagePublicationPort { publish(context: ICallContext, event: IEventEnvelope): Promise<IPublicationReceipt>; }

export interface ClockPort { now(): Instant; }

export interface IdGeneratorPort { next(purpose: string): UUID; derive(operatorId: UUID, requestId: UUID, purpose: string): UUID; }

export interface CommandFingerprintPort { hash(operation: string, input: RegisteredInput): Sha256; }
