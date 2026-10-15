import type {IEventsAdvanceMatchPhaseInput, IEventsAdvanceMatchPhaseOutput, IEventsCompleteEventInput, IEventsCompleteEventOutput, IEventsGetEventInput, IEventsGetEventOutput, IEventsGetEventResultInput, IEventsGetEventResultOutput, IEventsGetMarketsInput, IEventsGetMarketsOutput, IEventsListEventsInput, IEventsListEventsOutput, IEventsPublishOutboxBatchInput, IEventsPublishOutboxBatchOutput, IEventsValidateSelectionQuoteInput, IEventsValidateSelectionQuoteOutput, IResult} from '../../domain/events.model.js';

export interface ListEventsPort {execute(input:IEventsListEventsInput):Promise<IResult<IEventsListEventsOutput>>;}

export interface GetEventPort {execute(input:IEventsGetEventInput):Promise<IResult<IEventsGetEventOutput>>;}

export interface GetMarketsPort {execute(input:IEventsGetMarketsInput):Promise<IResult<IEventsGetMarketsOutput>>;}

export interface ValidateSelectionQuotePort {execute(input:IEventsValidateSelectionQuoteInput):Promise<IResult<IEventsValidateSelectionQuoteOutput>>;}

export interface GetEventResultPort {execute(input:IEventsGetEventResultInput):Promise<IResult<IEventsGetEventResultOutput>>;}

export interface AdvanceMatchPhasePort {execute(input:IEventsAdvanceMatchPhaseInput):Promise<IResult<IEventsAdvanceMatchPhaseOutput>>;}

export interface CompleteEventPort {execute(input:IEventsCompleteEventInput):Promise<IResult<IEventsCompleteEventOutput>>;}

export interface PublishOutboxBatchPort {execute(input:IEventsPublishOutboxBatchInput):Promise<IResult<IEventsPublishOutboxBatchOutput>>;}
