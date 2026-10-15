import type {BetCommandOperation, BetStatus, CancellationReason, IBetLeg, IBettingGetBetOutput, IBettingGetBetStatusOutput, IBettingListPlayerBetsOutput, IBetView, ICallContext, IClaimResult, IEventEnvelope, IEventResult, IEventsGetEventOutput, IEventsValidateSelectionQuoteOutput, ILedgerCancelBetOutput, ILedgerGetBetFinancialStatusOutput, ILedgerReserveStakeOutput, ILedgerSettleLossOutput, ILedgerSettleWinOutput, IMoney, Instant, IOutboxLease, IPageInput, IPlayerCheckEligibilityOutput, IPublicationReceipt, IReconciliationReport, IReservationView, IResult, ISettlementIntent, ISettlementSweep, IStableChildId, IStoredCommand, IWorkerBatchInput, OpaqueCursor, PlayerCapability, RecoveryKind, RegisteredInput, RegisteredOutput, Sha256, UUID} from '../../domain/betting.model.js';

export interface BetUnitOfWorkPort {run<T>(context: ICallContext, work: (ports:IBetTransactionPorts)=>Promise<IResult<T>>):Promise<IResult<T>>;}

export interface BetStorePort {find(context: ICallContext, betId:UUID):Promise<IBetView | undefined>;
createPending(context: ICallContext, bet:IBetView, reservationCommandId:UUID):Promise<IBetView>;
transition(context: ICallContext, betId:UUID, expectedVersion:bigint, next:IBetView):Promise<IBetView>;
listPending(context: ICallContext, kind:RecoveryKind, pendingBefore:Instant, page:IPageInput):Promise<IBetView[]>;
listByEvent(context: ICallContext, eventId:UUID, page:IPageInput):Promise<IBetView[]>;}

export interface BetLegStorePort {insert(context: ICallContext, betId:UUID, legs:IBetLeg[]):Promise<void>;
list(context: ICallContext, betId:UUID):Promise<IBetLeg[]>;
resolve(context: ICallContext, betId:UUID, legId:UUID, result:IEventResult):Promise<IBetLeg>;}

export interface SettlementStorePort {find(context: ICallContext, betId:UUID, settlementSeq:bigint):Promise<ISettlementIntent | undefined>;
create(context: ICallContext, intent:ISettlementIntent):Promise<ISettlementIntent>;
markApplied(context: ICallContext, intentId:UUID, financial:IReservationView):Promise<void>;
listPending(context: ICallContext, pendingBefore:Instant, page:IPageInput):Promise<ISettlementIntent[]>;
recordEventResult(context: ICallContext, result:IEventResult):Promise<void>;
findEventResult(context: ICallContext, resultId:UUID):Promise<IEventResult | undefined>;}

export interface BetStateHistoryPort {append(context: ICallContext, betId:UUID, from:BetStatus, to:BetStatus, reasonCode:string | undefined, occurredAt:Instant):Promise<void>;}

export interface BetIdempotencyPort {find(context: ICallContext, requestId: UUID):Promise<IStoredCommand | undefined>;
findForBet(context:ICallContext, betId:UUID, operation:BetCommandOperation):Promise<IStoredCommand | undefined>;
claim(context: ICallContext, requestId: UUID, operation: string, payloadHash: Sha256, semanticInput: RegisteredInput, stableChildIds: IStableChildId[]):Promise<IClaimResult>;
complete(context: ICallContext, requestId: UUID, outcome: IResult<RegisteredOutput>):Promise<void>;}

export interface BetOutboxPort {append(context: ICallContext, event:IEventEnvelope):Promise<void>;}

export interface BetInboxPort {claim(context: ICallContext, envelope:IEventEnvelope, payloadHash:Sha256):Promise<{isNew:boolean}>;
markProcessed(context: ICallContext, messageId:UUID):Promise<void>;}

export interface PlayerEligibilityPort {check(context: ICallContext, playerId: UUID, capability: PlayerCapability):Promise<IPlayerCheckEligibilityOutput>;}

export interface MarketQuotePort {validateSelection(context: ICallContext, playerId: UUID, eventId: UUID, marketId: UUID, selectionId: UUID, quoteId: UUID, quoteVersion: bigint):Promise<IEventsValidateSelectionQuoteOutput>;
getEvent(context: ICallContext, eventId: UUID):Promise<IEventsGetEventOutput>;}

export interface LedgerReservationPort {reserve(context: ICallContext, requestId: UUID, betId: UUID, playerId: UUID, stake: IMoney):Promise<ILedgerReserveStakeOutput>;
getStatus(context: ICallContext, betId: UUID):Promise<ILedgerGetBetFinancialStatusOutput>;
cancel(context: ICallContext, requestId: UUID, betId: UUID, reasonCode: CancellationReason):Promise<ILedgerCancelBetOutput>;}

export interface LedgerSettlementPort {settleWin(context: ICallContext, requestId: UUID, betId: UUID, settlementSeq: bigint, grossPayout: IMoney):Promise<ILedgerSettleWinOutput>;
settleLoss(context: ICallContext, requestId: UUID, betId: UUID, settlementSeq: bigint):Promise<ILedgerSettleLossOutput>;
void(context: ICallContext, requestId: UUID, betId: UUID, reasonCode: CancellationReason):Promise<ILedgerCancelBetOutput>;
getStatus(context: ICallContext, betId: UUID):Promise<ILedgerGetBetFinancialStatusOutput>;}

export interface BetQueryPort {get(context: ICallContext, betId: UUID, playerId: UUID):Promise<IBettingGetBetOutput>;
list(context: ICallContext, playerId: UUID, page: IPageInput, status?: BetStatus):Promise<IBettingListPlayerBetsOutput>;
status(context: ICallContext, playerId: UUID, betId: UUID):Promise<IBettingGetBetStatusOutput>;
listAuditCandidates(context: ICallContext, cutoff:Instant, page:IPageInput):Promise<{items:IBetView[];nextCursor?:OpaqueCursor}>;}

export interface BetAuditStorePort {record(context: ICallContext, report:IReconciliationReport):Promise<void>;}

export interface ClockPort {now():Instant;}

export interface IdGeneratorPort {next(purpose:string):UUID;
derive(operatorId:UUID, requestId:UUID, purpose:string):UUID;}

export interface OutboxDeliveryPort {claim(input:IWorkerBatchInput):Promise<IOutboxLease[]>;
markDelivered(context: ICallContext, leaseId:UUID, receipt:IPublicationReceipt):Promise<void>;
release(context: ICallContext, leaseId:UUID, nextAttemptAt:Instant, reasonCode:string):Promise<void>;}

export interface MessagePublicationPort {publish(context: ICallContext, event:IEventEnvelope):Promise<IPublicationReceipt>;}

export interface SettlementSweepStorePort {create(context: ICallContext, sweep:ISettlementSweep):Promise<void>;
findDue(context: ICallContext, page:IPageInput):Promise<ISettlementSweep[]>;
checkpoint(context: ICallContext, sweepId:UUID, expectedVersion:bigint, cursor:OpaqueCursor | undefined, complete:boolean):Promise<void>;}

export interface IBetTransactionPorts {bets:BetStorePort;legs:BetLegStorePort;settlements:SettlementStorePort;commands:BetIdempotencyPort;inbox:BetInboxPort;outbox:BetOutboxPort;history:BetStateHistoryPort;sweeps:SettlementSweepStorePort;}

export interface CommandFingerprintPort {hash(operation:string, input:RegisteredInput):Sha256;}
