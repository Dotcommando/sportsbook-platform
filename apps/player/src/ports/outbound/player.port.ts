import type {ContactKind, ICallContext, IClaimResult, IContact, IEventEnvelope, IKycCase, IKycCheck, Instant, IOperatorEligibilityPolicy, IOutboxLease, IPageInput, IPlayerProfilePatch, IProfile, IPublicationReceipt, IRestriction, IResult, IStableChildId, IStoredCommand, IWorkerBatchInput, KycCheckType, OpaqueCursor, PlayerCapability, PlayerStatus, RegisteredInput, RegisteredOutput, RestrictionState, Sha256, UUID} from '../../domain/player.model.js';

export interface PlayerUnitOfWorkPort {run<T>(context: ICallContext, work: (ports:IPlayerTransactionPorts)=>Promise<IResult<T>>):Promise<IResult<T>>;}

export interface PlayerStorePort {find(context: ICallContext, playerId:UUID):Promise<IProfile | undefined>;
create(context: ICallContext, profile:IProfile, externalRef?:string):Promise<IProfile>;
transition(context: ICallContext, playerId:UUID, expectedVersion:bigint, nextStatus:PlayerStatus, reasonCode:string):Promise<IProfile>;}

export interface ProfileStorePort {find(context: ICallContext, playerId:UUID):Promise<IProfile | undefined>;
create(context: ICallContext, profile:IProfile):Promise<void>;
patch(context: ICallContext, playerId:UUID, expectedVersion:bigint, patch:IPlayerProfilePatch):Promise<IProfile>;}

export interface ContactStorePort {list(context: ICallContext, playerId:UUID):Promise<IContact[]>;
add(context: ICallContext, playerId:UUID, contactId:UUID, kind:ContactKind, value:string, isPrimary:boolean):Promise<IContact>;
verify(context: ICallContext, playerId:UUID, contactId:UUID, verifiedAt:Instant):Promise<IContact>;}

export interface KycCaseStorePort {get(context: ICallContext, playerId:UUID, caseId:UUID):Promise<IKycCase | undefined>;
list(context: ICallContext, playerId:UUID):Promise<IKycCase[]>;
open(context: ICallContext, kycCase:IKycCase):Promise<IKycCase>;
decide(context: ICallContext, caseId:UUID, expectedVersion:bigint, next:IKycCase):Promise<IKycCase>;
transition(context: ICallContext, caseId:UUID, expectedVersion:bigint, next:IKycCase):Promise<IKycCase>;}

export interface KycCheckStorePort {record(context: ICallContext, playerId:UUID, check:IKycCheck):Promise<IKycCheck>;
list(context: ICallContext, caseId:UUID):Promise<IKycCheck[]>;}

export interface RestrictionStorePort {list(context: ICallContext, playerId:UUID, page:IPageInput, state?:RestrictionState):Promise<{items:IRestriction[];nextCursor?:OpaqueCursor}>;
add(context: ICallContext, restriction:IRestriction):Promise<IRestriction>;
clear(context: ICallContext, playerId:UUID, restrictionId:UUID, clearedAt:Instant, reasonCode:string):Promise<IRestriction>;}

export interface OperatorEligibilityPolicyPort {get(context: ICallContext, capability:PlayerCapability):Promise<IOperatorEligibilityPolicy>;}

export interface SyntheticVerificationPort {verify(context: ICallContext, contactId:UUID, proofRef:string):Promise<boolean>;}

export interface KycProviderPort {requestCheck(context: ICallContext, caseId:UUID, checkType:KycCheckType, attemptNo:number, commandId:UUID):Promise<IKycCheck>;}

export interface PlayerIdempotencyPort {find(context: ICallContext, requestId: UUID):Promise<IStoredCommand | undefined>;
claim(context: ICallContext, requestId: UUID, operation: string, payloadHash: Sha256, semanticInput: RegisteredInput, stableChildIds: IStableChildId[]):Promise<IClaimResult>;
complete(context: ICallContext, requestId: UUID, outcome: IResult<RegisteredOutput>):Promise<void>;}

export interface PlayerOutboxPort {append(context: ICallContext, event:IEventEnvelope):Promise<void>;}

export interface ClockPort {now():Instant;}

export interface IdGeneratorPort {next(purpose:string):UUID;
derive(operatorId:UUID, requestId:UUID, purpose:string):UUID;}

export interface OutboxDeliveryPort {claim(input:IWorkerBatchInput):Promise<IOutboxLease[]>;
markDelivered(context: ICallContext, leaseId:UUID, receipt:IPublicationReceipt):Promise<void>;
release(context: ICallContext, leaseId:UUID, nextAttemptAt:Instant, reasonCode:string):Promise<void>;}

export interface MessagePublicationPort {publish(context: ICallContext, event:IEventEnvelope):Promise<IPublicationReceipt>;}

export interface IPlayerTransactionPorts {players:PlayerStorePort;profiles:ProfileStorePort;contacts:ContactStorePort;cases:KycCaseStorePort;checks:KycCheckStorePort;restrictions:RestrictionStorePort;commands:PlayerIdempotencyPort;outbox:PlayerOutboxPort;}

export interface CommandFingerprintPort {hash(operation:string, input:RegisteredInput):Sha256;}
