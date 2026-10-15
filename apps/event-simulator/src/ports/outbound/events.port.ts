import type {EventPhase, ICallContext, IClaimResult, IEvent, IEventEnvelope, IEventResult, IMarket, Instant, IOutboxLease, IPageInput, IPublicationReceipt, IQuote, IResult, IStableChildId, IStoredCommand, IWorkerBatchInput, OpaqueCursor, RegisteredInput, RegisteredOutput, Sha256, UUID} from '../../domain/events.model.js';

export interface EventUnitOfWorkPort {run<T>(context: ICallContext, work: (ports:IEventTransactionPorts)=>Promise<IResult<T>>):Promise<IResult<T>>;}

export interface EventCatalogStorePort {list(context: ICallContext, page:IPageInput, phase?:EventPhase):Promise<{items:IEvent[];nextCursor?:OpaqueCursor}>;
find(context: ICallContext, eventId:UUID):Promise<IEvent | undefined>;
changePhase(context: ICallContext, eventId:UUID, expectedPhaseSeq:bigint, nextPhase:EventPhase, simulatedAt:Instant):Promise<IEvent>;}

export interface QuoteStorePort {list(context: ICallContext, eventId:UUID):Promise<IMarket[]>;
find(context: ICallContext, quoteId:UUID, quoteVersion:bigint):Promise<IQuote | undefined>;
changeMarketStates(context: ICallContext, eventId:UUID, phase:EventPhase, phaseSeq:bigint):Promise<void>;}

export interface EventResultStorePort {find(context: ICallContext, eventId:UUID):Promise<IEventResult | undefined>;
complete(context: ICallContext, result:IEventResult):Promise<IEventResult>;}

export interface MatchClockPort {read(context: ICallContext, runId:UUID):Promise<{simulatedAt:Instant;phaseSeq:bigint}>;
advance(context: ICallContext, runId:UUID, expectedSeq:bigint, simulatedAt:Instant):Promise<void>;}

export interface ResultEventPublisherPort {storeIntent(context: ICallContext, result:IEventResult, envelope:IEventEnvelope):Promise<void>;
storePhaseIntent(context: ICallContext, event:IEvent, envelope:IEventEnvelope):Promise<void>;}

export interface EventCommandStorePort {find(context: ICallContext, requestId: UUID):Promise<IStoredCommand | undefined>;
claim(context: ICallContext, requestId: UUID, operation: string, payloadHash: Sha256, semanticInput: RegisteredInput, stableChildIds: IStableChildId[]):Promise<IClaimResult>;
complete(context: ICallContext, requestId: UUID, outcome: IResult<RegisteredOutput>):Promise<void>;}

export interface ClockPort {now():Instant;}

export interface IdGeneratorPort {next(purpose:string):UUID;
derive(operatorId:UUID, requestId:UUID, purpose:string):UUID;}

export interface OutboxDeliveryPort {claim(input:IWorkerBatchInput):Promise<IOutboxLease[]>;
markDelivered(context: ICallContext, leaseId:UUID, receipt:IPublicationReceipt):Promise<void>;
release(context: ICallContext, leaseId:UUID, nextAttemptAt:Instant, reasonCode:string):Promise<void>;}

export interface MessagePublicationPort {publish(context: ICallContext, event:IEventEnvelope):Promise<IPublicationReceipt>;}

export interface IEventTransactionPorts {catalog:EventCatalogStorePort;quotes:QuoteStorePort;results:EventResultStorePort;commands:EventCommandStorePort;resultIntent:ResultEventPublisherPort;}

export interface CommandFingerprintPort {hash(operation:string, input:RegisteredInput):Sha256;}
