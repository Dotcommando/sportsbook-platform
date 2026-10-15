import type { Metadata } from '@grpc/grpc-js';
import { Inject, Injectable } from '@nestjs/common';
import { BoundaryError, decodeShape, objectValue, ShapeKind, SignedIdentity } from '@sportsbook/service-transport';

import type { ICallContext, IResult, RegisteredOutput } from '../../../domain/betting.model.js';
import { ActorKind, Capability } from '../../../domain/betting.model.js';
import {BETTING_IDENTITY, BETTING_OPERATIONS} from '../../../infra/betting-transport.tokens.js';
import type { IBettingOperationPorts } from '../../../ports/inbound/betting-application.port.js';
import * as Dto from './betting.dto.js';

export interface ITransportHeaders {authorization?:unknown;correlationId?:unknown;deadlineAt?:unknown;}

@Injectable()
export class BettingBoundary {
 constructor(@Inject(BETTING_OPERATIONS) private readonly operations:IBettingOperationPorts, @Inject(BETTING_IDENTITY) private readonly identity:SignedIdentity) {}

 context(headers:ITransportHeaders):ICallContext {const claims = this.identity.authenticate(headers.authorization, headers.correlationId, headers.deadlineAt);const actorKind = Object.values(ActorKind).find(kind=>kind === claims.actorKind);

if (!actorKind) throw new BoundaryError('UNAUTHENTICATED');

const capabilities = Object.values(Capability).filter(capability=>claims.capabilities.includes(capability));

return {...claims, actorKind, capabilities};}

 async execute(operation:string, body:unknown, headers:ITransportHeaders, protobuf = false):Promise<IResult<RegisteredOutput>> {let dispatched = false;let correlationId = '00000000-0000-4000-8000-000000000001';

try {const context = this.context(headers);

correlationId = context.correlationId;const args = objectValue(body);

if ('context' in args || 'operatorId' in args) throw new BoundaryError('INVALID_INPUT', correlationId);

const input = Dto.decodeInput('IBetting' + operation + 'Input', {...args, context}, protobuf);

switch (operation) {
case 'PlaceBet': {if (!Dto.isIBettingPlaceBetInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.placeBet.execute(input);

if (result.ok && !Dto.isIBettingPlaceBetOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'GetBet': {if (!Dto.isIBettingGetBetInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.getBet.execute(input);

if (result.ok && !Dto.isIBettingGetBetOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'ListPlayerBets': {if (!Dto.isIBettingListPlayerBetsInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.listPlayerBets.execute(input);

if (result.ok && !Dto.isIBettingListPlayerBetsOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'GetBetStatus': {if (!Dto.isIBettingGetBetStatusInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.getBetStatus.execute(input);

if (result.ok && !Dto.isIBettingGetBetStatusOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'CancelBet': {if (!Dto.isIBettingCancelBetInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.cancelBet.execute(input);

if (result.ok && !Dto.isIBettingCancelBetOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'RecordEventResult': {if (!Dto.isIBettingRecordEventResultInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.recordEventResult.execute(input);

if (result.ok && !Dto.isIBettingRecordEventResultOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'SettleBet': {if (!Dto.isIBettingSettleBetInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.settleBet.execute(input);

if (result.ok && !Dto.isIBettingSettleBetOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'RetryPendingReservation': {if (!Dto.isIBettingRetryPendingReservationInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.retryPendingReservation.execute(input);

if (result.ok && !Dto.isIBettingRetryPendingReservationOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'RetryPendingSettlement': {if (!Dto.isIBettingRetryPendingSettlementInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.retryPendingSettlement.execute(input);

if (result.ok && !Dto.isIBettingRetryPendingSettlementOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'ReconcileBetWithLedger': {if (!Dto.isIBettingReconcileBetWithLedgerInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.reconcileBetWithLedger.execute(input);

if (result.ok && !Dto.isIBettingReconcileBetWithLedgerOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'RetryPendingCancellation': {if (!Dto.isIBettingRetryPendingCancellationInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.retryPendingCancellation.execute(input);

if (result.ok && !Dto.isIBettingRetryPendingCancellationOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
default:throw new BoundaryError('INVALID_INPUT', correlationId);}} catch(error) {const code = error instanceof BoundaryError ? error.code : dispatched ? 'ADAPTER_CONTRACT_VIOLATION' : 'INVALID_INPUT';

return {ok:false, error:{code:codeValue(code), message:code, correlationId, retryable:false, outcomeUnknown:dispatched && !['GetBet', 'GetBetStatus', 'ListPlayerBets'].includes(operation)}};}}

 grpcHeaders(metadata:Metadata, context:unknown):ITransportHeaders {const claimed = objectValue(context);

return {authorization:metadata.get('authorization')[0], correlationId:metadata.get('x-correlation-id')[0] ?? claimed.correlationId, deadlineAt:metadata.get('x-deadline-at')[0] ?? claimed.deadlineAt};}

 validateDelegation(context:unknown, headers:ITransportHeaders):void {const claimed = objectValue(context);const trusted = this.context(headers);

for (const key of ['operatorId', 'actorId', 'actorKind', 'playerId']) if (key in claimed && claimed[key] !== objectValue(trusted)[key]) {if (key === 'actorKind' && typeof claimed[key] === 'string' && claimed[key].endsWith('_' + trusted.actorKind)) continue;throw new BoundaryError('PERMISSION_DENIED', trusted.correlationId);}

 if (Array.isArray(claimed.capabilities)) {const values = decodeShape(claimed.capabilities, {kind:ShapeKind.ARRAY, items:{kind:ShapeKind.ENUM, values:Object.values(Capability)}}, true);

if (Array.isArray(values) && values.some(value=>!trusted.capabilities.some(capability=>capability === value))) throw new BoundaryError('PERMISSION_DENIED', trusted.correlationId);}}
}

import { ErrorCode } from '../../../domain/betting.model.js';

function codeValue(code:string):ErrorCode {return Object.values(ErrorCode).find(value=>value === code) ?? ErrorCode.INVALID_INPUT;}

export function transportError(code:string):IResult<RegisteredOutput> {return {ok:false, error:{code:codeValue(code), message:code, correlationId:'00000000-0000-4000-8000-000000000001', retryable:false, outcomeUnknown:false}};}
