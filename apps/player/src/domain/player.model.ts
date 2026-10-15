export type UUID = string;

export type Instant = string;

export type LocalDate = string;

export type CountryCode = string;

export type Locale = string;

export type IanaZone = string;

export type Sha256 = string;

export type OpaqueCursor = string;

export enum ActorKind {PLAYER = 'PLAYER', SERVICE = 'SERVICE', SYSTEM = 'SYSTEM'}

export enum PlayerStatus {REGISTERED = 'REGISTERED', ACTIVE = 'ACTIVE', SUSPENDED = 'SUSPENDED', CLOSED = 'CLOSED'}

export enum PlayerStatusTarget {ACTIVE = 'ACTIVE', SUSPENDED = 'SUSPENDED', CLOSED = 'CLOSED'}

export enum ContactKind {EMAIL = 'EMAIL', PHONE = 'PHONE'}

export enum KycLevel {BASIC = 'BASIC', ENHANCED = 'ENHANCED'}

export enum KycCaseStatus {OPEN = 'OPEN', IN_REVIEW = 'IN_REVIEW', APPROVED = 'APPROVED', REJECTED = 'REJECTED', EXPIRED = 'EXPIRED'}

export enum KycDecision {APPROVED = 'APPROVED', REJECTED = 'REJECTED'}

export enum KycCheckType {IDENTITY = 'IDENTITY', AGE = 'AGE', RESIDENCE = 'RESIDENCE'}

export enum KycCheckStatus {PASSED = 'PASSED', FAILED = 'FAILED'}

export enum KycProvider {SYNTHETIC = 'SYNTHETIC'}

export enum RestrictionType {BETTING_BLOCK = 'BETTING_BLOCK', DEPOSIT_BLOCK = 'DEPOSIT_BLOCK', WITHDRAWAL_REVIEW = 'WITHDRAWAL_REVIEW'}

export enum RestrictionState {ACTIVE = 'ACTIVE', CLEARED = 'CLEARED', EXPIRED = 'EXPIRED'}

export enum PlayerCapability {PLACE_BET = 'PLACE_BET', DEPOSIT = 'DEPOSIT', WITHDRAW = 'WITHDRAW'}

export enum EligibilityReason {ELIGIBLE = 'ELIGIBLE', PLAYER_INACTIVE = 'PLAYER_INACTIVE', KYC_REQUIRED = 'KYC_REQUIRED', KYC_EXPIRED = 'KYC_EXPIRED', CAPABILITY_RESTRICTED = 'CAPABILITY_RESTRICTED'}

export enum CommandState {IN_PROGRESS = 'IN_PROGRESS', COMPLETED = 'COMPLETED', FAILED_FINAL = 'FAILED_FINAL'}

export enum ClaimKind {NEW = 'NEW', REPLAY = 'REPLAY', IN_PROGRESS = 'IN_PROGRESS'}

export enum EventSource {PLAYER = 'PLAYER'}

export enum EventType {PLAYER_REGISTERED = 'PLAYER_REGISTERED', PLAYER_PROFILE_CHANGED = 'PLAYER_PROFILE_CHANGED', PLAYER_ELIGIBILITY_CHANGED = 'PLAYER_ELIGIBILITY_CHANGED'}

export enum Capability {REGISTER_PLAYER = 'REGISTER_PLAYER', PROFILE_READ = 'PROFILE_READ', PROFILE_WRITE = 'PROFILE_WRITE', CONTACT_WRITE = 'CONTACT_WRITE', CONTACT_VERIFY = 'CONTACT_VERIFY', MANAGE_PLAYER = 'MANAGE_PLAYER', MANAGE_KYC = 'MANAGE_KYC', DECIDE_KYC = 'DECIDE_KYC', KYC_STATUS = 'KYC_STATUS', MANAGE_RESTRICTIONS = 'MANAGE_RESTRICTIONS', RESTRICTION_READ = 'RESTRICTION_READ', EVALUATE_ELIGIBILITY = 'EVALUATE_ELIGIBILITY', SYNTHETIC_KYC = 'SYNTHETIC_KYC', READ_PLAYER_REFERENCE = 'READ_PLAYER_REFERENCE', PUBLISH_EVENTS = 'PUBLISH_EVENTS'}

export enum ErrorCode {INVALID_INPUT = 'INVALID_INPUT', AMOUNT_OUT_OF_RANGE = 'AMOUNT_OUT_OF_RANGE', CURRENCY_MISMATCH = 'CURRENCY_MISMATCH', UNAUTHENTICATED = 'UNAUTHENTICATED', PERMISSION_DENIED = 'PERMISSION_DENIED', NOT_FOUND = 'NOT_FOUND', IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT', VERSION_CONFLICT = 'VERSION_CONFLICT', INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS', INELIGIBLE = 'INELIGIBLE', STALE_QUOTE = 'STALE_QUOTE', MARKET_CLOSED = 'MARKET_CLOSED', INVALID_STATE = 'INVALID_STATE', IN_PROGRESS = 'IN_PROGRESS', OVERLOADED = 'OVERLOADED', DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED', DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE', ADAPTER_CONTRACT_VIOLATION = 'ADAPTER_CONTRACT_VIOLATION', INVARIANT_VIOLATION = 'INVARIANT_VIOLATION'}

export interface IError {code:ErrorCode;message:string;correlationId:UUID;retryable:boolean;outcomeUnknown:boolean;}

export type IResult<T> = {ok:true;value:T} | {ok:false;error:IError};

export interface ICallContext {operatorId: UUID; actorId: UUID; actorKind: ActorKind; playerId?: UUID; capabilities: Capability[]; correlationId: UUID; deadlineAt: Instant;}

export interface IPageInput {limit: number; cursor?: OpaqueCursor; from?: Instant; to?: Instant;}

export interface IProfile {playerId: UUID; status: PlayerStatus; firstName?: string; lastName?: string; birthDate?: LocalDate; residenceCountry?: CountryCode; nationalityCountry?: CountryCode; locale: Locale; timeZone: IanaZone; version: bigint; createdAt: Instant; updatedAt: Instant;}

export interface IContact {contactId: UUID; kind: ContactKind; displayValue: string; isPrimary: boolean; verifiedAt?: Instant;}

export interface IKycCase {caseId: UUID; playerId: UUID; requiredLevel: KycLevel; status: KycCaseStatus; policyVersion: string; decisionCode?: string; validUntil?: Instant; version: bigint;}

export interface IKycCheck {checkId: UUID; caseId: UUID; checkType: KycCheckType; attemptNo: number; provider: KycProvider; providerCheckRef: string; status: KycCheckStatus; resultCode: string; completedAt: Instant;}

export interface IRestriction {restrictionId: UUID; playerId: UUID; type: RestrictionType; state: RestrictionState; reasonCode: string; startsAt: Instant; endsAt?: Instant; clearedAt?: Instant;}

export interface IEligibility {allowed: boolean; reasonCode: EligibilityReason; policyVersion: string; evaluatedAt: Instant; validUntil?: Instant; playerVersion: bigint;}

export interface IBatchReport {selected: number; applied: number; replayed: number; rejected: number; pending: number; failed: number; nextCursor?: OpaqueCursor;}

export interface IPlayerRegisterPlayerInput {context: ICallContext; requestId: UUID; externalRef?: string; locale: Locale; timeZone: IanaZone;}

export interface IPlayerRegisterPlayerOutput {profile: IProfile; created: boolean;}

export interface IPlayerGetPlayerInput {context: ICallContext; playerId: UUID;}

export interface IPlayerGetPlayerOutput {profile: IProfile; contacts: IContact[];}

export interface IPlayerUpdatePlayerProfileInput {context: ICallContext; requestId: UUID; playerId: UUID; expectedVersion: bigint; patch: {firstName?:string;lastName?:string;birthDate?:LocalDate;residenceCountry?:CountryCode;nationalityCountry?:CountryCode;locale?:Locale;timeZone?:IanaZone};}

export interface IPlayerUpdatePlayerProfileOutput {profile: IProfile;}

export interface IPlayerAddContactInput {context: ICallContext; requestId: UUID; playerId: UUID; kind: ContactKind; value: string; isPrimary: boolean;}

export interface IPlayerAddContactOutput {contact: IContact;}

export interface IPlayerVerifyContactInput {context: ICallContext; requestId: UUID; playerId: UUID; contactId: UUID; proofRef: string;}

export interface IPlayerVerifyContactOutput {contact: IContact;}

export interface IPlayerChangePlayerStatusInput {context: ICallContext; requestId: UUID; playerId: UUID; expectedVersion: bigint; status: PlayerStatusTarget; reasonCode: string;}

export interface IPlayerChangePlayerStatusOutput {profile: IProfile;}

export interface IPlayerOpenKycCaseInput {context: ICallContext; requestId: UUID; playerId: UUID; requiredLevel: KycLevel;}

export interface IPlayerOpenKycCaseOutput {kycCase: IKycCase;}

export interface IPlayerRecordKycCheckInput {context: ICallContext; requestId: UUID; playerId: UUID; caseId: UUID; check: IKycCheck;}

export interface IPlayerRecordKycCheckOutput {check: IKycCheck; kycCase: IKycCase;}

export interface IPlayerDecideKycCaseInput {context: ICallContext; requestId: UUID; playerId: UUID; caseId: UUID; expectedVersion: bigint; decision: KycDecision; decisionCode: string; validUntil?: Instant;}

export interface IPlayerDecideKycCaseOutput {kycCase: IKycCase;}

export interface IPlayerGetKycStatusInput {context: ICallContext; playerId: UUID;}

export interface IPlayerGetKycStatusOutput {cases: IKycCase[]; evaluatedAt: Instant;}

export interface IPlayerApplyRestrictionInput {context: ICallContext; requestId: UUID; playerId: UUID; type: RestrictionType; reasonCode: string; startsAt: Instant; endsAt?: Instant;}

export interface IPlayerApplyRestrictionOutput {restriction: IRestriction;}

export interface IPlayerClearRestrictionInput {context: ICallContext; requestId: UUID; playerId: UUID; restrictionId: UUID; reasonCode: string;}

export interface IPlayerClearRestrictionOutput {restriction: IRestriction;}

export interface IPlayerGetRestrictionsInput {context: ICallContext; playerId: UUID; page: IPageInput; state?: RestrictionState;}

export interface IPlayerGetRestrictionsOutput {restrictions: IRestriction[]; nextCursor?: OpaqueCursor; evaluatedAt: Instant;}

export interface IPlayerCheckEligibilityInput {context: ICallContext; playerId: UUID; capability: PlayerCapability;}

export interface IPlayerCheckEligibilityOutput {eligibility: IEligibility;}

export interface IPlayerProfilePatch {firstName?:string; lastName?:string; birthDate?:LocalDate; residenceCountry?:CountryCode; nationalityCountry?:CountryCode; locale?:Locale; timeZone?:IanaZone;}

export interface IOperatorEligibilityPolicy {policyVersion:string; capability:PlayerCapability; allowedStatuses:PlayerStatus[]; requiredLevel:KycLevel; requiredChecks:KycCheckType[]; minimumAge?:number; maxValidityDays:number; blockingRestrictions:RestrictionType[];}

export interface IWorkerBatchInput {context:ICallContext; batchId:UUID; limit:number; cutoff:Instant;}

export interface IPlayerPublishOutboxBatchInput {input: IWorkerBatchInput;}

export interface IPlayerPublishOutboxBatchOutput {report: IBatchReport;}

export interface IPlayerRunSyntheticKycCheckInput {context: ICallContext; requestId: UUID; playerId:UUID; caseId:UUID; checkType:KycCheckType; attemptNo:number;}

export interface IPlayerRunSyntheticKycCheckOutput {check:IKycCheck; kycCase:IKycCase;}

export interface IPlayerGetPlayerReferenceInput {context: ICallContext; playerId:UUID;}

export interface IPlayerGetPlayerReferenceOutput {operatorId:UUID; playerId:UUID; exists:boolean;}

export type RegisteredInput = IPlayerRegisterPlayerInput | IPlayerGetPlayerInput | IPlayerUpdatePlayerProfileInput | IPlayerAddContactInput | IPlayerVerifyContactInput | IPlayerChangePlayerStatusInput | IPlayerOpenKycCaseInput | IPlayerRecordKycCheckInput | IPlayerDecideKycCaseInput | IPlayerGetKycStatusInput | IPlayerApplyRestrictionInput | IPlayerClearRestrictionInput | IPlayerGetRestrictionsInput | IPlayerCheckEligibilityInput | IPlayerPublishOutboxBatchInput | IPlayerRunSyntheticKycCheckInput | IPlayerGetPlayerReferenceInput;

export type RegisteredOutput = IPlayerRegisterPlayerOutput | IPlayerGetPlayerOutput | IPlayerUpdatePlayerProfileOutput | IPlayerAddContactOutput | IPlayerVerifyContactOutput | IPlayerChangePlayerStatusOutput | IPlayerOpenKycCaseOutput | IPlayerRecordKycCheckOutput | IPlayerDecideKycCaseOutput | IPlayerGetKycStatusOutput | IPlayerApplyRestrictionOutput | IPlayerClearRestrictionOutput | IPlayerGetRestrictionsOutput | IPlayerCheckEligibilityOutput | IPlayerPublishOutboxBatchOutput | IPlayerRunSyntheticKycCheckOutput | IPlayerGetPlayerReferenceOutput;

export interface IStableChildId {purpose:string;id:UUID;}

export interface IStoredCommand {requestId:UUID;operation:string;payloadHash:Sha256;state:CommandState;outcome?:IResult<RegisteredOutput>;actorId:UUID;updatedAt:Instant;semanticInput:RegisteredInput;stableChildIds:IStableChildId[];}

export interface IClaimResult {kind:ClaimKind;command:IStoredCommand;}

export interface IEventEnvelope {messageId:UUID;source:EventSource;eventType:EventType;schemaVersion:number;operatorId:UUID;correlationId:UUID;occurredAt:Instant;payload:{playerId:UUID;registeredAt?:Instant;version?:bigint;};}

export interface IOutboxLease {leaseId:UUID;message:IEventEnvelope;attemptNo:number;leaseUntil:Instant;}

export interface IPublicationReceipt {messageId:UUID;acceptedAt:Instant;durable:boolean;}

export interface IPlayerOperatorSettings {operatorId:UUID;businessTimeZone:IanaZone;countries:readonly CountryCode[];reasonCodes:readonly string[];policies:readonly IOperatorEligibilityPolicy[];casePolicyCapabilities:readonly {level:KycLevel;capability:PlayerCapability}[];trustedActors:readonly {actorId:UUID;actorKind:ActorKind;capabilities:readonly Capability[]}[];}
