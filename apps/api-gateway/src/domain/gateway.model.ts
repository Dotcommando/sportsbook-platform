export type UUID = string;

export type Instant = string;

export type LocalDate = string;

export type CountryCode = string;

export type Locale = string;

export type IanaZone = string;

export type CurrencyCode = string;

export type Sha256 = string;

export type ExactDecimal = string;

export type OpaqueCursor = string;

export enum ActorKind {PLAYER = 'PLAYER', SERVICE = 'SERVICE', SYSTEM = 'SYSTEM'}

export enum Capability {REGISTER_PLAYER = 'REGISTER_PLAYER', PROFILE_READ = 'PROFILE_READ', PROFILE_WRITE = 'PROFILE_WRITE', EVALUATE_ELIGIBILITY = 'EVALUATE_ELIGIBILITY', READ_WALLET = 'READ_WALLET', READ_JOURNAL = 'READ_JOURNAL', FUND_SYNTHETIC = 'FUND_SYNTHETIC', WITHDRAW = 'WITHDRAW', PLACE_BET = 'PLACE_BET', BET_READ = 'BET_READ', CANCEL_BET = 'CANCEL_BET', EVENT_READ = 'EVENT_READ'}

export enum PlayerStatus {REGISTERED = 'REGISTERED', ACTIVE = 'ACTIVE', SUSPENDED = 'SUSPENDED', CLOSED = 'CLOSED'}

export enum ContactKind {EMAIL = 'EMAIL', PHONE = 'PHONE'}

export enum PlayerCapability {PLACE_BET = 'PLACE_BET', DEPOSIT = 'DEPOSIT', WITHDRAW = 'WITHDRAW'}

export enum EligibilityReason {ELIGIBLE = 'ELIGIBLE', PLAYER_INACTIVE = 'PLAYER_INACTIVE', KYC_REQUIRED = 'KYC_REQUIRED', KYC_EXPIRED = 'KYC_EXPIRED', CAPABILITY_RESTRICTED = 'CAPABILITY_RESTRICTED'}

export enum WalletStatus {ACTIVE = 'ACTIVE', CLOSED = 'CLOSED'}

export enum JournalStatus {POSTED = 'POSTED', REJECTED = 'REJECTED'}

export enum Side {DEBIT = 'DEBIT', CREDIT = 'CREDIT'}

export enum TransactionType {DEPOSIT = 'DEPOSIT', RESERVE_STAKE = 'RESERVE_STAKE', SETTLE_WIN = 'SETTLE_WIN', SETTLE_LOSS = 'SETTLE_LOSS', CANCEL_RESERVATION = 'CANCEL_RESERVATION', WITHDRAWAL_HOLD = 'WITHDRAWAL_HOLD', WITHDRAWAL_COMPLETE = 'WITHDRAWAL_COMPLETE', WITHDRAWAL_REJECT = 'WITHDRAWAL_REJECT'}

export enum FinancialOutcomeState {COMPLETED = 'COMPLETED', REJECTED = 'REJECTED'}

export enum WithdrawalState {HELD = 'HELD', COMPLETED = 'COMPLETED', REJECTED = 'REJECTED'}

export enum BetType {SINGLE = 'SINGLE'}

export enum BetStatus {PENDING_RESERVATION = 'PENDING_RESERVATION', ACCEPTED = 'ACCEPTED', REJECTED = 'REJECTED', SETTLEMENT_PENDING = 'SETTLEMENT_PENDING', WON = 'WON', LOST = 'LOST', VOID = 'VOID', CANCELED = 'CANCELED'}

export enum BetLegState {PENDING = 'PENDING', WON = 'WON', LOST = 'LOST', VOID = 'VOID'}

export enum PlaceOutcome {ACCEPTED = 'ACCEPTED', REJECTED = 'REJECTED', PENDING = 'PENDING'}

export enum CancelOutcome {CANCELED = 'CANCELED', PENDING = 'PENDING'}

export enum FinancialState {UNCONFIRMED = 'UNCONFIRMED', RESERVED = 'RESERVED', SETTLED = 'SETTLED', REFUNDED = 'REFUNDED'}

export enum EventPhase {PRE_MATCH = 'PRE_MATCH', LIVE = 'LIVE', HALF_TIME = 'HALF_TIME', SUSPENDED = 'SUSPENDED', FINISHED = 'FINISHED'}

export enum Sport {FOOTBALL = 'FOOTBALL'}

export enum MarketType {MATCH_RESULT = 'MATCH_RESULT'}

export enum MarketState {OPEN = 'OPEN', SUSPENDED = 'SUSPENDED', CLOSED = 'CLOSED'}

export enum Selection {HOME = 'HOME', DRAW = 'DRAW', AWAY = 'AWAY'}

export enum ErrorCode {INVALID_INPUT = 'INVALID_INPUT', AMOUNT_OUT_OF_RANGE = 'AMOUNT_OUT_OF_RANGE', CURRENCY_MISMATCH = 'CURRENCY_MISMATCH', UNAUTHENTICATED = 'UNAUTHENTICATED', PERMISSION_DENIED = 'PERMISSION_DENIED', NOT_FOUND = 'NOT_FOUND', IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT', VERSION_CONFLICT = 'VERSION_CONFLICT', INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS', INELIGIBLE = 'INELIGIBLE', STALE_QUOTE = 'STALE_QUOTE', MARKET_CLOSED = 'MARKET_CLOSED', INVALID_STATE = 'INVALID_STATE', IN_PROGRESS = 'IN_PROGRESS', OVERLOADED = 'OVERLOADED', DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED', DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE', ADAPTER_CONTRACT_VIOLATION = 'ADAPTER_CONTRACT_VIOLATION', INVARIANT_VIOLATION = 'INVARIANT_VIOLATION'}

export type IResult<T> = {ok:true;value:T} | {ok:false;error:IError};

export interface ICallContext {operatorId: UUID; actorId: UUID; actorKind: ActorKind; playerId?: UUID; capabilities: Capability[]; correlationId: UUID; deadlineAt: Instant;}

export interface IPageInput {limit: number; cursor?: OpaqueCursor; from?: Instant; to?: Instant;}

export interface IError {code: ErrorCode; message: string; correlationId: UUID; fields?: {path:string;code:string}[]; retryable: boolean; outcomeUnknown: boolean; retryAfterMs?: number;}

export interface IGatewayRegisterPlayerInput {context: ICallContext; requestId: UUID; externalRef?: string; locale: Locale; timeZone: IanaZone;}

export interface IGatewayRegisterPlayerOutput {profile: IProfile;}

export interface IGatewayGetMyProfileInput {context: ICallContext;}

export interface IGatewayGetMyProfileOutput {profile: IProfile; contacts: IContact[];}

export interface IGatewayUpdateMyProfileInput {context: ICallContext; requestId: UUID; expectedVersion: bigint; patch: IPlayerProfilePatch;}

export interface IGatewayUpdateMyProfileOutput {profile: IProfile;}

export interface IGatewayGetMyEligibilityInput {context: ICallContext; capability: PlayerCapability;}

export interface IGatewayGetMyEligibilityOutput {eligibility: IEligibility;}

export interface IGatewayGetMyBalanceInput {context: ICallContext; currency: CurrencyCode;}

export interface IGatewayGetMyBalanceOutput {wallet: IWalletView;}

export interface IGatewayTopUpTestWalletInput {context: ICallContext; requestId: UUID; amount: IMoney; providerRef: string;}

export interface IGatewayTopUpTestWalletOutput {outcome: IFinancialOutcome;}

export interface IGatewayRequestMyWithdrawalInput {context: ICallContext; requestId: UUID; amount: IMoney;}

export interface IGatewayRequestMyWithdrawalOutput {withdrawal: IWithdrawalView; outcome: IFinancialOutcome;}

export interface IGatewayGetMyWithdrawalInput {context: ICallContext; withdrawalId: UUID;}

export interface IGatewayGetMyWithdrawalOutput {withdrawal: IWithdrawalView;}

export interface IGatewayGetMyTransactionsInput {context: ICallContext; currency: CurrencyCode; page: IPageInput;}

export interface IGatewayGetMyTransactionsOutput {transactions: IJournalView[]; nextCursor?: OpaqueCursor; observedAt: Instant;}

export interface IGatewayPlaceBetInput {context: ICallContext; requestId: UUID; type: BetType; stake: IMoney; selection: {eventId:UUID;marketId:UUID;selectionId:UUID;quoteId:UUID;quoteVersion:bigint};}

export interface IGatewayPlaceBetOutput {bet: IBetView; outcome: PlaceOutcome;}

export interface IGatewayGetMyBetInput {context: ICallContext; betId: UUID;}

export interface IGatewayGetMyBetOutput {bet: IBetView;}

export interface IGatewayGetMyBetStatusInput {context: ICallContext; betId: UUID;}

export interface IGatewayGetMyBetStatusOutput {betId: UUID; status: BetStatus; financialState: FinancialState; version: bigint; observedAt: Instant;}

export interface IGatewayListMyBetsInput {context: ICallContext; page: IPageInput; status?: BetStatus;}

export interface IGatewayListMyBetsOutput {bets: IBetView[]; nextCursor?: OpaqueCursor; observedAt: Instant;}

export interface IGatewayCancelMyBetInput {context: ICallContext; requestId: UUID; betId: UUID; expectedVersion: bigint;}

export interface IGatewayCancelMyBetOutput {bet: IBetView; outcome: CancelOutcome;}

export interface IGatewayListEventsInput {context: ICallContext; page: IPageInput; phase?: EventPhase;}

export interface IGatewayListEventsOutput {events: IEvent[]; nextCursor?: OpaqueCursor; observedAt: Instant;}

export interface IGatewayGetEventInput {context: ICallContext; eventId: UUID;}

export interface IGatewayGetEventOutput {event: IEvent;}

export interface IGatewayListMarketsInput {context: ICallContext; eventId: UUID;}

export interface IGatewayListMarketsOutput {markets: IMarket[]; observedAt: Instant;}

export interface IGatewayGetMyDashboardInput {context: ICallContext; currency: CurrencyCode; recentBetLimit: number;}

export interface IGatewayGetMyDashboardOutput {profile: IProfile; wallet: IWalletView; recentBets: IBetView[]; events: IEvent[]; sectionObservedAt: {profile:Instant;wallet:Instant;bets:Instant;events:Instant};}

export interface IPlayerRegisterPlayerInput {context: ICallContext; requestId: UUID; externalRef?: string; locale: Locale; timeZone: IanaZone;}

export interface IPlayerRegisterPlayerOutput {profile: IProfile; created: boolean;}

export interface IPlayerUpdatePlayerProfileInput {context: ICallContext; requestId: UUID; playerId: UUID; expectedVersion: bigint; patch: {firstName?:string;lastName?:string;birthDate?:LocalDate;residenceCountry?:CountryCode;nationalityCountry?:CountryCode;locale?:Locale;timeZone?:IanaZone};}

export interface IPlayerUpdatePlayerProfileOutput {profile: IProfile;}

export interface IPlayerGetPlayerInput {context: ICallContext; playerId: UUID;}

export interface IPlayerGetPlayerOutput {profile: IProfile; contacts: IContact[];}

export interface IPlayerCheckEligibilityInput {context: ICallContext; playerId: UUID; capability: PlayerCapability;}

export interface IPlayerCheckEligibilityOutput {eligibility: IEligibility;}

export interface ILedgerDepositTestFundsInput {context: ICallContext; requestId: UUID; walletId: UUID; amount: IMoney; providerRef: string;}

export interface ILedgerDepositTestFundsOutput {outcome: IFinancialOutcome;}

export interface ILedgerRequestWithdrawalInput {context: ICallContext; requestId: UUID; walletId: UUID; withdrawalId: UUID; amount: IMoney;}

export interface ILedgerRequestWithdrawalOutput {withdrawal: IWithdrawalView; outcome: IFinancialOutcome;}

export interface ILedgerGetWalletInput {context: ICallContext; playerId: UUID; currency: CurrencyCode;}

export interface ILedgerGetWalletOutput {wallet: IWalletView;}

export interface ILedgerGetWithdrawalInput {context: ICallContext; withdrawalId: UUID;}

export interface ILedgerGetWithdrawalOutput {withdrawal: IWithdrawalView;}

export interface ILedgerGetWalletTransactionsInput {context: ICallContext; walletId: UUID; page: IPageInput;}

export interface ILedgerGetWalletTransactionsOutput {transactions: IJournalView[]; nextCursor?: OpaqueCursor; observedAt: Instant;}

export interface IBettingPlaceBetInput {context: ICallContext; requestId: UUID; playerId: UUID; stake: IMoney; type: BetType; selection: {eventId:UUID;marketId:UUID;selectionId:UUID;quoteId:UUID;quoteVersion:bigint};}

export interface IBettingPlaceBetOutput {bet: IBetView; outcome: PlaceOutcome;}

export interface IBettingCancelBetInput {context: ICallContext; requestId: UUID; playerId: UUID; betId: UUID; expectedVersion: bigint;}

export interface IBettingCancelBetOutput {bet: IBetView; outcome: CancelOutcome;}

export interface IBettingGetBetInput {context: ICallContext; betId: UUID; playerId: UUID;}

export interface IBettingGetBetOutput {bet: IBetView;}

export interface IBettingGetBetStatusInput {context: ICallContext; playerId: UUID; betId: UUID;}

export interface IBettingGetBetStatusOutput {betId: UUID; status: BetStatus; financialState: FinancialState; version: bigint; observedAt: Instant;}

export interface IBettingListPlayerBetsInput {context: ICallContext; playerId: UUID; page: IPageInput; status?: BetStatus;}

export interface IBettingListPlayerBetsOutput {bets: IBetView[]; nextCursor?: OpaqueCursor; observedAt: Instant;}

export interface IEventsListEventsInput {context: ICallContext; page: IPageInput; phase?: EventPhase;}

export interface IEventsListEventsOutput {events: IEvent[]; nextCursor?: OpaqueCursor; observedAt: Instant;}

export interface IEventsGetEventInput {context: ICallContext; eventId: UUID;}

export interface IEventsGetEventOutput {event: IEvent;}

export interface IEventsGetMarketsInput {context: ICallContext; eventId: UUID;}

export interface IEventsGetMarketsOutput {markets: IMarket[]; observedAt: Instant;}

export interface IProfile {playerId: UUID; status: PlayerStatus; firstName?: string; lastName?: string; birthDate?: LocalDate; residenceCountry?: CountryCode; nationalityCountry?: CountryCode; locale: Locale; timeZone: IanaZone; version: bigint; createdAt: Instant; updatedAt: Instant;}

export interface IContact {contactId: UUID; kind: ContactKind; displayValue: string; isPrimary: boolean; verifiedAt?: Instant;}

export interface IPlayerProfilePatch {firstName?:string; lastName?:string; birthDate?:LocalDate; residenceCountry?:CountryCode; nationalityCountry?:CountryCode; locale?:Locale; timeZone?:IanaZone;}

export interface IEligibility {allowed: boolean; reasonCode: EligibilityReason; policyVersion: string; evaluatedAt: Instant; validUntil?: Instant; playerVersion: bigint;}

export interface IWalletView {walletId: UUID; playerId: UUID; currency: CurrencyCode; status: WalletStatus; availableMinor: bigint; reservedMinor: bigint; withdrawalHoldMinor: bigint; version: bigint; observedAt: Instant;}

export interface IMoney {amountMinor: bigint; currency: CurrencyCode;}

export interface IFinancialOutcome {requestId: UUID; state: FinancialOutcomeState; transactionId?: UUID; businessRef: UUID; wallet: IWalletView; reasonCode?: ErrorCode; replayed: boolean;}

export interface IWithdrawalView {withdrawalId: UUID; walletId: UUID; amount: IMoney; state: WithdrawalState; holdTransactionId: UUID; resolutionTransactionId?: UUID; providerRef?: string; reasonCode?: string; createdAt: Instant; resolvedAt?: Instant;}

export interface IJournalView {transactionId: UUID; requestId: UUID; transactionType: TransactionType; businessRef: string; currency: CurrencyCode; status: JournalStatus; postedAt?: Instant; entries: IEntry[];}

export interface IBetView {betId: UUID; playerId: UUID; type: BetType; status: BetStatus; stake: IMoney; potentialPayoutMinor: bigint; actualPayoutMinor?: bigint; legs: IBetLeg[]; createdAt: Instant; acceptedAt?: Instant; settledAt?: Instant; reasonCode?: ErrorCode; version: bigint;}

export interface IEvent {eventId: UUID; runId: UUID; sport: Sport; homeTeam: string; awayTeam: string; startsAt: Instant; phase: EventPhase; phaseSeq: bigint; simulatedAt: Instant; resultRef?: UUID;}

export interface IMarket {marketId: UUID; eventId: UUID; type: MarketType; state: MarketState; selections: IQuote[];}

export interface IEntry {entryId: UUID; accountId: UUID; transactionId: UUID; entryNo: number; side: Side; amountMinor: bigint; currency: CurrencyCode; postedAt: Instant;}

export interface IBetLeg {legId: UUID; legNo: number; eventId: UUID; marketId: UUID; selectionId: UUID; quote?: IQuote; state: BetLegState; resultRef?: UUID;}

export interface IQuote {quoteId: UUID; quoteVersion: bigint; eventId: UUID; marketId: UUID; selectionId: UUID; selection: Selection; odds: ExactDecimal; validUntil: Instant; state: MarketState;}

export type RegisteredInput = IGatewayRegisterPlayerInput | IGatewayGetMyProfileInput | IGatewayUpdateMyProfileInput | IGatewayGetMyEligibilityInput | IGatewayGetMyBalanceInput | IGatewayTopUpTestWalletInput | IGatewayRequestMyWithdrawalInput | IGatewayGetMyWithdrawalInput | IGatewayGetMyTransactionsInput | IGatewayPlaceBetInput | IGatewayGetMyBetInput | IGatewayGetMyBetStatusInput | IGatewayListMyBetsInput | IGatewayCancelMyBetInput | IGatewayListEventsInput | IGatewayGetEventInput | IGatewayListMarketsInput | IGatewayGetMyDashboardInput;

export type RegisteredOutput = IGatewayRegisterPlayerOutput | IGatewayGetMyProfileOutput | IGatewayUpdateMyProfileOutput | IGatewayGetMyEligibilityOutput | IGatewayGetMyBalanceOutput | IGatewayTopUpTestWalletOutput | IGatewayRequestMyWithdrawalOutput | IGatewayGetMyWithdrawalOutput | IGatewayGetMyTransactionsOutput | IGatewayPlaceBetOutput | IGatewayGetMyBetOutput | IGatewayGetMyBetStatusOutput | IGatewayListMyBetsOutput | IGatewayCancelMyBetOutput | IGatewayListEventsOutput | IGatewayGetEventOutput | IGatewayListMarketsOutput | IGatewayGetMyDashboardOutput;

export interface IGatewayOperatorSettings {operatorId:UUID;currencies:readonly CurrencyCode[];syntheticProvider:string;trustedRegistrationActors:readonly {actorId:UUID;actorKind:ActorKind}[];}
