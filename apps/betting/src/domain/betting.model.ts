export type UUID = string;

export type Instant = string;

export type CurrencyCode = string;

export type Sha256 = string;

export type ExactDecimal = string;

export type OpaqueCursor = string;

export enum ActorKind {PLAYER = 'PLAYER', SERVICE = 'SERVICE', SYSTEM = 'SYSTEM'}

export enum Capability {PLACE_BET = 'PLACE_BET', BET_READ = 'BET_READ', CANCEL_BET = 'CANCEL_BET', SETTLE_BET = 'SETTLE_BET', RECOVER_BETS = 'RECOVER_BETS', RECONCILE_BETS = 'RECONCILE_BETS', PUBLISH_EVENTS = 'PUBLISH_EVENTS'}

export enum BetStatus {PENDING_RESERVATION = 'PENDING_RESERVATION', ACCEPTED = 'ACCEPTED', REJECTED = 'REJECTED', SETTLEMENT_PENDING = 'SETTLEMENT_PENDING', WON = 'WON', LOST = 'LOST', VOID = 'VOID', CANCELED = 'CANCELED'}

export enum BetType {SINGLE = 'SINGLE'}

export enum BetLegState {PENDING = 'PENDING', WON = 'WON', LOST = 'LOST', VOID = 'VOID'}

export enum EventPhase {PRE_MATCH = 'PRE_MATCH', LIVE = 'LIVE', HALF_TIME = 'HALF_TIME', SUSPENDED = 'SUSPENDED', FINISHED = 'FINISHED'}

export enum Sport {FOOTBALL = 'FOOTBALL'}

export enum MarketState {OPEN = 'OPEN', SUSPENDED = 'SUSPENDED', CLOSED = 'CLOSED'}

export enum Selection {HOME = 'HOME', DRAW = 'DRAW', AWAY = 'AWAY'}

export enum ResultOutcome {HOME = 'HOME', DRAW = 'DRAW', AWAY = 'AWAY', VOID = 'VOID'}

export enum PlayerCapability {PLACE_BET = 'PLACE_BET', DEPOSIT = 'DEPOSIT', WITHDRAW = 'WITHDRAW'}

export enum EligibilityReason {ELIGIBLE = 'ELIGIBLE', PLAYER_INACTIVE = 'PLAYER_INACTIVE', KYC_REQUIRED = 'KYC_REQUIRED', KYC_EXPIRED = 'KYC_EXPIRED', CAPABILITY_RESTRICTED = 'CAPABILITY_RESTRICTED'}

export enum ReservationState {RESERVED = 'RESERVED', WON = 'WON', LOST = 'LOST', CANCELED = 'CANCELED'}

export enum FinancialState {UNCONFIRMED = 'UNCONFIRMED', RESERVED = 'RESERVED', SETTLED = 'SETTLED', REFUNDED = 'REFUNDED'}

export enum FinancialOutcomeState {COMPLETED = 'COMPLETED', REJECTED = 'REJECTED'}

export enum WalletStatus {ACTIVE = 'ACTIVE', CLOSED = 'CLOSED'}

export enum SettlementDecision {WIN = 'WIN', LOSS = 'LOSS', VOID = 'VOID'}

export enum SettlementState {PENDING = 'PENDING', APPLIED = 'APPLIED'}

export enum SweepState {PENDING = 'PENDING', COMPLETE = 'COMPLETE'}

export enum ReconciliationStatus {PASS = 'PASS', FAIL = 'FAIL'}

export enum PlaceOutcome {ACCEPTED = 'ACCEPTED', REJECTED = 'REJECTED', PENDING = 'PENDING'}

export enum CancelOutcome {CANCELED = 'CANCELED', PENDING = 'PENDING'}

export enum SettleOutcome {SETTLED = 'SETTLED', PENDING = 'PENDING'}

export enum CommandState {IN_PROGRESS = 'IN_PROGRESS', COMPLETED = 'COMPLETED', FAILED_FINAL = 'FAILED_FINAL'}

export enum ClaimKind {NEW = 'NEW', REPLAY = 'REPLAY', IN_PROGRESS = 'IN_PROGRESS'}

export enum EventSource {EVENTS = 'EVENTS', BETTING = 'BETTING'}

export enum EventType {EVENT_RESULT = 'EVENT_RESULT', BET_STATE_CHANGED = 'BET_STATE_CHANGED'}

export enum RecoveryKind {RESERVATION = 'RESERVATION', CANCELLATION = 'CANCELLATION'}

export enum CancellationReason {VOID = 'VOID', CANCELED = 'CANCELED', ACCEPTANCE_FAILED = 'ACCEPTANCE_FAILED'}

export enum MarketPeriod {NORMAL_TIME = 'NORMAL_TIME'}

export enum ErrorCode {INVALID_INPUT = 'INVALID_INPUT', AMOUNT_OUT_OF_RANGE = 'AMOUNT_OUT_OF_RANGE', CURRENCY_MISMATCH = 'CURRENCY_MISMATCH', UNAUTHENTICATED = 'UNAUTHENTICATED', PERMISSION_DENIED = 'PERMISSION_DENIED', NOT_FOUND = 'NOT_FOUND', IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT', VERSION_CONFLICT = 'VERSION_CONFLICT', INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS', INELIGIBLE = 'INELIGIBLE', STALE_QUOTE = 'STALE_QUOTE', MARKET_CLOSED = 'MARKET_CLOSED', INVALID_STATE = 'INVALID_STATE', IN_PROGRESS = 'IN_PROGRESS', OVERLOADED = 'OVERLOADED', DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED', DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE', ADAPTER_CONTRACT_VIOLATION = 'ADAPTER_CONTRACT_VIOLATION', INVARIANT_VIOLATION = 'INVARIANT_VIOLATION'}

export interface IError {code:ErrorCode;message:string;correlationId:UUID;retryable:boolean;outcomeUnknown:boolean;}

export type IResult<T> = {ok:true;value:T} | {ok:false;error:IError};

export interface ICallContext {operatorId: UUID; actorId: UUID; actorKind: ActorKind; playerId?: UUID; capabilities: Capability[]; correlationId: UUID; deadlineAt: Instant;}

export interface IMoney {amountMinor: bigint; currency: CurrencyCode;}

export interface IPageInput {limit: number; cursor?: OpaqueCursor; from?: Instant; to?: Instant;}

export interface IWalletView {walletId: UUID; playerId: UUID; currency: CurrencyCode; status: WalletStatus; availableMinor: bigint; reservedMinor: bigint; withdrawalHoldMinor: bigint; version: bigint; observedAt: Instant;}

export interface IFinancialOutcome {requestId: UUID; state: FinancialOutcomeState; transactionId?: UUID; businessRef: UUID; wallet: IWalletView; reasonCode?: ErrorCode; replayed: boolean;}

export interface ILedgerGetWalletOutput {wallet:IWalletView;}

export interface IReservationView {betId: UUID; walletId: UUID; stake: IMoney; state: ReservationState; reservationTransactionId: UUID; settlementTransactionId?: UUID; settlementSeq?: bigint; grossPayoutMinor?: bigint;}

export interface IReconciliationReport {runId: UUID; snapshotAt: Instant; status: ReconciliationStatus; counts: {transactions:bigint;entries:bigint;violations:bigint}; violations: {code:string;businessRef?:UUID}[]; nextCursor?: OpaqueCursor;}

export interface IEligibility {allowed: boolean; reasonCode: EligibilityReason; policyVersion: string; evaluatedAt: Instant; validUntil?: Instant; playerVersion: bigint;}

export interface IEvent {eventId: UUID; runId: UUID; sport: Sport; homeTeam: string; awayTeam: string; startsAt: Instant; phase: EventPhase; phaseSeq: bigint; simulatedAt: Instant; resultRef?: UUID;}

export interface IQuote {quoteId: UUID; quoteVersion: bigint; eventId: UUID; marketId: UUID; selectionId: UUID; selection: Selection; odds: ExactDecimal; validUntil: Instant; state: MarketState;}

export interface IEventResult {resultId: UUID; eventId: UUID; runId: UUID; resultSeq: bigint; homeGoals: number; awayGoals: number; outcome: ResultOutcome; occurredAt: Instant;}

export interface IBetLeg {legId: UUID; legNo: number; eventId: UUID; marketId: UUID; selectionId: UUID; quote?: IQuote; state: BetLegState; resultRef?: UUID;}

export interface IBetView {betId: UUID; playerId: UUID; type: BetType; status: BetStatus; stake: IMoney; potentialPayoutMinor: bigint; actualPayoutMinor?: bigint; legs: IBetLeg[]; createdAt: Instant; acceptedAt?: Instant; settledAt?: Instant; reasonCode?: ErrorCode; version: bigint;}

export interface IBatchReport {selected: number; applied: number; replayed: number; rejected: number; pending: number; failed: number; nextCursor?: OpaqueCursor;}

export interface ILedgerGetBetFinancialStatusOutput {reservation?: IReservationView; observedAt: Instant;}

export interface ILedgerReserveStakeOutput {reservation: IReservationView; outcome: IFinancialOutcome;}

export interface ILedgerSettleWinOutput {reservation: IReservationView; outcome: IFinancialOutcome;}

export interface ILedgerSettleLossOutput {reservation: IReservationView; outcome: IFinancialOutcome;}

export interface ILedgerCancelBetOutput {reservation: IReservationView; outcome: IFinancialOutcome;}

export interface IPlayerCheckEligibilityOutput {eligibility: IEligibility;}

export interface IEventsGetEventOutput {event: IEvent;}

export interface IEventsValidateSelectionQuoteOutput {acceptedQuote: IQuote; evaluatedAt: Instant;}

export interface IBettingPlaceBetInput {context: ICallContext; requestId: UUID; playerId: UUID; stake: IMoney; type: BetType; selection: {eventId:UUID;marketId:UUID;selectionId:UUID;quoteId:UUID;quoteVersion:bigint};}

export interface IBettingPlaceBetOutput {bet: IBetView; outcome: PlaceOutcome;}

export interface IBettingGetBetInput {context: ICallContext; betId: UUID; playerId: UUID;}

export interface IBettingGetBetOutput {bet: IBetView;}

export interface IBettingListPlayerBetsInput {context: ICallContext; playerId: UUID; page: IPageInput; status?: BetStatus;}

export interface IBettingListPlayerBetsOutput {bets: IBetView[]; nextCursor?: OpaqueCursor; observedAt: Instant;}

export interface IBettingGetBetStatusInput {context: ICallContext; playerId: UUID; betId: UUID;}

export interface IBettingGetBetStatusOutput {betId: UUID; status: BetStatus; financialState: FinancialState; version: bigint; observedAt: Instant;}

export interface IBettingCancelBetInput {context: ICallContext; requestId: UUID; playerId: UUID; betId: UUID; expectedVersion: bigint;}

export interface IBettingCancelBetOutput {bet: IBetView; outcome: CancelOutcome;}

export interface IBettingRecordEventResultInput {context: ICallContext; envelope: IEventEnvelope; result: IEventResult;}

export interface IBettingRecordEventResultOutput {accepted:boolean; duplicate:boolean; sweepId:UUID;}

export interface IBettingSettleBetInput {context: ICallContext; requestId: UUID; betId: UUID; resultId: UUID; settlementSeq: bigint;}

export interface IBettingSettleBetOutput {bet: IBetView; outcome: SettleOutcome;}

export interface IBettingRetryPendingReservationInput {context: ICallContext; batchId: UUID; page: IPageInput; pendingBefore: Instant;}

export interface IBettingRetryPendingReservationOutput {report: IBatchReport;}

export interface IBettingRetryPendingSettlementInput {context: ICallContext; batchId: UUID; page: IPageInput; pendingBefore: Instant;}

export interface IBettingRetryPendingSettlementOutput {report: IBatchReport;}

export interface IBettingReconcileBetWithLedgerInput {context: ICallContext; requestId: UUID; runId: UUID; page: IPageInput; cutoff: Instant;}

export interface IBettingReconcileBetWithLedgerOutput {report: IReconciliationReport;}

export interface ISettlementIntent {intentId:UUID; betId:UUID; resultId:UUID; settlementSeq:bigint; decision:SettlementDecision; payout:IMoney; ledgerCommandId:UUID; state:SettlementState; createdAt:Instant;}

export interface IWorkerBatchInput {context:ICallContext; batchId:UUID; limit:number; cutoff:Instant;}

export interface IBettingPublishOutboxBatchInput {input: IWorkerBatchInput;}

export interface IBettingPublishOutboxBatchOutput {report: IBatchReport;}

export interface IBettingRetryPendingCancellationInput {context: ICallContext; batchId:UUID; page:IPageInput; pendingBefore:Instant;}

export interface IBettingRetryPendingCancellationOutput {report:IBatchReport;}

export interface IBetSelection {eventId:UUID; marketId:UUID; selectionId:UUID; quoteId:UUID; quoteVersion:bigint;}

export interface ISettlementSweep {sweepId:UUID; eventId:UUID; resultId:UUID; cursor?:OpaqueCursor; state:SweepState; version:bigint;}

export interface IBettingScheduleEventSettlementsInput {context: ICallContext; sweepId:UUID; page:IPageInput;}

export interface IBettingScheduleEventSettlementsOutput {report:IBatchReport;}

export type RegisteredInput = IBettingPlaceBetInput | IBettingGetBetInput | IBettingListPlayerBetsInput | IBettingGetBetStatusInput | IBettingCancelBetInput | IBettingRecordEventResultInput | IBettingSettleBetInput | IBettingRetryPendingReservationInput | IBettingRetryPendingSettlementInput | IBettingReconcileBetWithLedgerInput | IBettingPublishOutboxBatchInput | IBettingRetryPendingCancellationInput | IBettingScheduleEventSettlementsInput;

export type RegisteredOutput = IBettingPlaceBetOutput | IBettingGetBetOutput | IBettingListPlayerBetsOutput | IBettingGetBetStatusOutput | IBettingCancelBetOutput | IBettingRecordEventResultOutput | IBettingSettleBetOutput | IBettingRetryPendingReservationOutput | IBettingRetryPendingSettlementOutput | IBettingReconcileBetWithLedgerOutput | IBettingPublishOutboxBatchOutput | IBettingRetryPendingCancellationOutput | IBettingScheduleEventSettlementsOutput;

export interface IStableChildId {purpose:string;id:UUID;}

export interface IStoredCommand {requestId:UUID;operation:string;payloadHash:Sha256;state:CommandState;outcome?:IResult<RegisteredOutput>;actorId:UUID;updatedAt:Instant;semanticInput:RegisteredInput;stableChildIds:IStableChildId[];}

export interface IClaimResult {kind:ClaimKind;command:IStoredCommand;}

export enum BetCommandOperation {PLACE_BET = 'PlaceBet', CANCEL_BET = 'CancelBet'}

export interface IBetStateChangedEvent {betId:UUID;playerId:UUID;status:BetStatus;version:bigint;financialState:FinancialState;}

export interface IEventEnvelope {messageId:UUID;source:EventSource;eventType:EventType;schemaVersion:number;operatorId:UUID;correlationId:UUID;occurredAt:Instant;payload:IEventResult | IBetStateChangedEvent;}

export interface IOutboxLease {leaseId:UUID;message:IEventEnvelope;attemptNo:number;leaseUntil:Instant;}

export interface IPublicationReceipt {messageId:UUID;acceptedAt:Instant;durable:boolean;}

export interface IBettingOperatorSettings {operatorId:UUID;currencies:readonly CurrencyCode[];marketPeriod:MarketPeriod;trustedActors:readonly {actorId:UUID;actorKind:ActorKind;capabilities:readonly Capability[]}[];}
