import type {IBettingCancelBetInput, IBettingCancelBetOutput, IBettingGetBetInput, IBettingGetBetOutput, IBettingGetBetStatusInput, IBettingGetBetStatusOutput, IBettingListPlayerBetsInput, IBettingListPlayerBetsOutput, IBettingPlaceBetInput, IBettingPlaceBetOutput, IBettingPublishOutboxBatchInput, IBettingPublishOutboxBatchOutput, IBettingReconcileBetWithLedgerInput, IBettingReconcileBetWithLedgerOutput, IBettingRecordEventResultInput, IBettingRecordEventResultOutput, IBettingRetryPendingCancellationInput, IBettingRetryPendingCancellationOutput, IBettingRetryPendingReservationInput, IBettingRetryPendingReservationOutput, IBettingRetryPendingSettlementInput, IBettingRetryPendingSettlementOutput, IBettingScheduleEventSettlementsInput, IBettingScheduleEventSettlementsOutput, IBettingSettleBetInput, IBettingSettleBetOutput, IResult} from '../../domain/betting.model.js';

export interface PlaceBetPort {execute(input:IBettingPlaceBetInput):Promise<IResult<IBettingPlaceBetOutput>>;}

export interface GetBetPort {execute(input:IBettingGetBetInput):Promise<IResult<IBettingGetBetOutput>>;}

export interface ListPlayerBetsPort {execute(input:IBettingListPlayerBetsInput):Promise<IResult<IBettingListPlayerBetsOutput>>;}

export interface GetBetStatusPort {execute(input:IBettingGetBetStatusInput):Promise<IResult<IBettingGetBetStatusOutput>>;}

export interface CancelBetPort {execute(input:IBettingCancelBetInput):Promise<IResult<IBettingCancelBetOutput>>;}

export interface RecordEventResultPort {execute(input:IBettingRecordEventResultInput):Promise<IResult<IBettingRecordEventResultOutput>>;}

export interface SettleBetPort {execute(input:IBettingSettleBetInput):Promise<IResult<IBettingSettleBetOutput>>;}

export interface RetryPendingReservationPort {execute(input:IBettingRetryPendingReservationInput):Promise<IResult<IBettingRetryPendingReservationOutput>>;}

export interface RetryPendingSettlementPort {execute(input:IBettingRetryPendingSettlementInput):Promise<IResult<IBettingRetryPendingSettlementOutput>>;}

export interface ReconcileBetWithLedgerPort {execute(input:IBettingReconcileBetWithLedgerInput):Promise<IResult<IBettingReconcileBetWithLedgerOutput>>;}

export interface PublishOutboxBatchPort {execute(input:IBettingPublishOutboxBatchInput):Promise<IResult<IBettingPublishOutboxBatchOutput>>;}

export interface RetryPendingCancellationPort {execute(input:IBettingRetryPendingCancellationInput):Promise<IResult<IBettingRetryPendingCancellationOutput>>;}

export interface ScheduleEventSettlementsPort {execute(input:IBettingScheduleEventSettlementsInput):Promise<IResult<IBettingScheduleEventSettlementsOutput>>;}
