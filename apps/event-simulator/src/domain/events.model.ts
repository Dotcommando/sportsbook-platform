export type UUID = string;

export type Instant = string;

export type Sha256 = string;

export type ExactDecimal = string;

export type OpaqueCursor = string;

export enum ActorKind { PLAYER = 'PLAYER', SERVICE = 'SERVICE', SYSTEM = 'SYSTEM' }

export enum Capability {
  EVENT_READ = 'EVENT_READ'
  ,
  QUOTE_VALIDATE = 'QUOTE_VALIDATE'
  ,
  EVENT_RESULT_READ = 'EVENT_RESULT_READ'
  ,
  MATCH_CONTROL = 'MATCH_CONTROL'
  ,
  PUBLISH_EVENTS = 'PUBLISH_EVENTS',
}

export enum EventPhase {
  PRE_MATCH = 'PRE_MATCH'
  ,
  LIVE = 'LIVE'
  ,
  HALF_TIME = 'HALF_TIME'
  ,
  SUSPENDED = 'SUSPENDED'
  ,
  FINISHED = 'FINISHED',
}

export enum Sport { FOOTBALL = 'FOOTBALL' }

export enum MarketType { MATCH_RESULT = 'MATCH_RESULT' }

export enum MarketState { OPEN = 'OPEN', SUSPENDED = 'SUSPENDED', CLOSED = 'CLOSED' }

export enum Selection { HOME = 'HOME', DRAW = 'DRAW', AWAY = 'AWAY' }

export enum ResultOutcome { HOME = 'HOME', DRAW = 'DRAW', AWAY = 'AWAY', VOID = 'VOID' }

export enum DeliveryState { PENDING = 'PENDING', ACKNOWLEDGED = 'ACKNOWLEDGED' }

export enum CommandState {
  IN_PROGRESS = 'IN_PROGRESS'
  ,
  COMPLETED = 'COMPLETED'
  ,
  FAILED_FINAL = 'FAILED_FINAL',
}

export enum ClaimKind { NEW = 'NEW', REPLAY = 'REPLAY', IN_PROGRESS = 'IN_PROGRESS' }

export enum EventSource { EVENTS = 'EVENTS' }

export enum EventType { MATCH_PHASE_CHANGED = 'MATCH_PHASE_CHANGED', EVENT_RESULT = 'EVENT_RESULT' }

export enum MarketPeriod { NORMAL_TIME = 'NORMAL_TIME' }

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
  INVARIANT_VIOLATION = 'INVARIANT_VIOLATION',
}

export interface IError {
  code: ErrorCode;
  message: string;
  correlationId: UUID;
  retryable: boolean;
  outcomeUnknown: boolean;
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

export interface IPageInput { limit: number; cursor?: OpaqueCursor; from?: Instant; to?: Instant; }

export interface IEvent {
  eventId: UUID;
  runId: UUID;
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  startsAt: Instant;
  phase: EventPhase;
  phaseSeq: bigint;
  simulatedAt: Instant;
  resultRef?: UUID;
}

export interface IMarket {
  marketId: UUID;
  eventId: UUID;
  type: MarketType;
  state: MarketState;
  selections: IQuote[];
}

export interface IQuote {
  quoteId: UUID;
  quoteVersion: bigint;
  eventId: UUID;
  marketId: UUID;
  selectionId: UUID;
  selection: Selection;
  odds: ExactDecimal;
  validUntil: Instant;
  state: MarketState;
}

export interface IEventResult {
  resultId: UUID;
  eventId: UUID;
  runId: UUID;
  resultSeq: bigint;
  homeGoals: number;
  awayGoals: number;
  outcome: ResultOutcome;
  occurredAt: Instant;
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

export interface IEventsListEventsInput {
  context: ICallContext;
  page: IPageInput;
  phase?: EventPhase;
}

export interface IEventsListEventsOutput {
  events: IEvent[];
  nextCursor?: OpaqueCursor;
  observedAt: Instant;
}

export interface IEventsGetEventInput { context: ICallContext; eventId: UUID; }

export interface IEventsGetEventOutput { event: IEvent; }

export interface IEventsGetMarketsInput { context: ICallContext; eventId: UUID; }

export interface IEventsGetMarketsOutput { markets: IMarket[]; observedAt: Instant; }

export interface IEventsValidateSelectionQuoteInput {
  context: ICallContext;
  playerId: UUID;
  eventId: UUID;
  marketId: UUID;
  selectionId: UUID;
  quoteId: UUID;
  quoteVersion: bigint;
}

export interface IEventsValidateSelectionQuoteOutput {
  acceptedQuote: IQuote;
  evaluatedAt: Instant;
}

export interface IEventsGetEventResultInput { context: ICallContext; eventId: UUID; }

export interface IEventsGetEventResultOutput { result?: IEventResult; ready: boolean; }

export interface IEventsAdvanceMatchPhaseInput {
  context: ICallContext;
  requestId: UUID;
  eventId: UUID;
  expectedPhaseSeq: bigint;
  nextPhase: EventPhase;
  simulatedAt: Instant;
}

export interface IEventsAdvanceMatchPhaseOutput { event: IEvent; }

export interface IEventsCompleteEventInput {
  context: ICallContext;
  requestId: UUID;
  eventId: UUID;
  expectedPhaseSeq: bigint;
  result: IEventResult;
}

export interface IEventsCompleteEventOutput {
  event: IEvent;
  result: IEventResult;
  delivery: DeliveryState;
}

export interface IWorkerBatchInput {
  context: ICallContext;
  batchId: UUID;
  limit: number;
  cutoff: Instant;
}

export interface IEventsPublishOutboxBatchInput { input: IWorkerBatchInput; }

export interface IEventsPublishOutboxBatchOutput { report: IBatchReport; }

export type RegisteredInput = IEventsListEventsInput
  | IEventsGetEventInput
  | IEventsGetMarketsInput
  | IEventsValidateSelectionQuoteInput
  | IEventsGetEventResultInput
  | IEventsAdvanceMatchPhaseInput
  | IEventsCompleteEventInput
  | IEventsPublishOutboxBatchInput;

export type RegisteredOutput = IEventsListEventsOutput
  | IEventsGetEventOutput
  | IEventsGetMarketsOutput
  | IEventsValidateSelectionQuoteOutput
  | IEventsGetEventResultOutput
  | IEventsAdvanceMatchPhaseOutput
  | IEventsCompleteEventOutput
  | IEventsPublishOutboxBatchOutput;

export interface IStableChildId { purpose: string; id: UUID; }

export interface IStoredCommand {
  requestId: UUID;
  operation: string;
  payloadHash: Sha256;
  state: CommandState;
  outcome?: IResult<RegisteredOutput>;
  actorId: UUID;
  updatedAt: Instant;
  semanticInput: RegisteredInput;
  stableChildIds: IStableChildId[];
}

export interface IClaimResult { kind: ClaimKind; command: IStoredCommand; }

export interface IMatchPhaseChangedEvent {
  eventId: UUID;
  runId: UUID;
  phase: EventPhase;
  phaseSeq: bigint;
  simulatedAt: Instant;
}

export interface IEventEnvelope {
  messageId: UUID;
  source: EventSource;
  eventType: EventType;
  schemaVersion: number;
  operatorId: UUID;
  correlationId: UUID;
  occurredAt: Instant;
  payload: IEventResult | IMatchPhaseChangedEvent;
}

export interface IOutboxLease {
  leaseId: UUID;
  message: IEventEnvelope;
  attemptNo: number;
  leaseUntil: Instant;
}

export interface IPublicationReceipt { messageId: UUID; acceptedAt: Instant; durable: boolean; }

export interface IEventsOperatorSettings {
  operatorId: UUID;
  trustedActors: readonly { actorId: UUID; actorKind: ActorKind; capabilities: readonly Capability[] }[];
}
