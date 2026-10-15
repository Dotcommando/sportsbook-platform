import * as Wire from '@sportsbook/events-client';

import * as M from '../../../domain/betting.model.js';
import {requireRule} from '../../../domain/betting.policy.js';
import * as Output from '../../../domain/betting-output.policy.js';
import type {ClockPort, MarketQuotePort} from '../../../ports/outbound/betting.port.js';
import {decodeInput} from './betting-client.dto.js';
import {protobufOutput} from './events-wire.js';
import type {IPrivateGrpcSettings} from './private-grpc.js';
import {PrivateGrpc} from './private-grpc.js';

export class EventsGrpcClient implements MarketQuotePort {
private readonly connection:PrivateGrpc;private readonly client:Wire.EventsServiceClient;

constructor(settings:IPrivateGrpcSettings, clock:ClockPort) {this.connection = new PrivateGrpc(settings, clock);this.client = new Wire.EventsServiceClient(settings.endpoint, this.connection.credentials);}

close():void {this.client.close();}

private async validateSelectionQuoteCall(context:M.ICallContext, body:Record<string, unknown>):Promise<M.IEventsValidateSelectionQuoteOutput> {const request = Wire.ValidateSelectionQuoteRequest.fromJSON(protobufOutput({...body, context:this.connection.delegated(context)}, 'ValidateSelectionQuoteRequest'));const raw = await this.connection.call(context, false, (metadata, options, done)=>this.client.validateSelectionQuote(request, metadata, options, done), Wire.ValidateSelectionQuoteResponse.toJSON);const result = decodeInput('IEventsValidateSelectionQuoteOutput', raw, true);

requireRule(Output.isIEventsValidateSelectionQuoteOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

if (!Output.isIEventsValidateSelectionQuoteOutput(result)) throw new Error('Malformed dependency output');

return result;}

private async getEventCall(context:M.ICallContext, body:Record<string, unknown>):Promise<M.IEventsGetEventOutput> {const request = Wire.GetEventRequest.fromJSON(protobufOutput({...body, context:this.connection.delegated(context)}, 'GetEventRequest'));const raw = await this.connection.call(context, false, (metadata, options, done)=>this.client.getEvent(request, metadata, options, done), Wire.GetEventResponse.toJSON);const result = decodeInput('IEventsGetEventOutput', raw, true);

requireRule(Output.isIEventsGetEventOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

if (!Output.isIEventsGetEventOutput(result)) throw new Error('Malformed dependency output');

return result;}

validateSelection(context:M.ICallContext, playerId:string, eventId:string, marketId:string, selectionId:string, quoteId:string, quoteVersion:bigint):Promise<M.IEventsValidateSelectionQuoteOutput> {return this.validateSelectionQuoteCall(context, {playerId, eventId, marketId, selectionId, quoteId, quoteVersion});}

getEvent(context:M.ICallContext, eventId:string):Promise<M.IEventsGetEventOutput> {return this.getEventCall(context, {eventId});}
}
