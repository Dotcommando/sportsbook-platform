import type { Metadata } from '@grpc/grpc-js';
import { Inject, Injectable } from '@nestjs/common';
import { BoundaryError, decodeShape, objectValue, ShapeKind, SignedIdentity } from '@sportsbook/service-transport';

import type { ICallContext, IResult, RegisteredOutput } from '../../../domain/player.model.js';
import { ActorKind, Capability } from '../../../domain/player.model.js';
import {PLAYER_IDENTITY, PLAYER_OPERATIONS} from '../../../infra/player-transport.tokens.js';
import type { IPlayerOperationPorts } from '../../../ports/inbound/player-application.port.js';
import * as Dto from './player.dto.js';

export interface ITransportHeaders {authorization?:unknown;correlationId?:unknown;deadlineAt?:unknown;}

@Injectable()
export class PlayerBoundary {
 constructor(@Inject(PLAYER_OPERATIONS) private readonly operations:IPlayerOperationPorts, @Inject(PLAYER_IDENTITY) private readonly identity:SignedIdentity) {}

 context(headers:ITransportHeaders):ICallContext {const claims = this.identity.authenticate(headers.authorization, headers.correlationId, headers.deadlineAt);const actorKind = Object.values(ActorKind).find(kind=>kind === claims.actorKind);

if (!actorKind) throw new BoundaryError('UNAUTHENTICATED');

const capabilities = Object.values(Capability).filter(capability=>claims.capabilities.includes(capability));

return {...claims, actorKind, capabilities};}

 async execute(operation:string, body:unknown, headers:ITransportHeaders, protobuf = false):Promise<IResult<RegisteredOutput>> {let dispatched = false;let correlationId = '00000000-0000-4000-8000-000000000001';

try {const context = this.context(headers);

correlationId = context.correlationId;const args = objectValue(body);

if ('context' in args || 'operatorId' in args) throw new BoundaryError('INVALID_INPUT', correlationId);

const input = Dto.decodeInput('IPlayer' + operation + 'Input', {...args, context}, protobuf);

switch (operation) {
case 'RegisterPlayer': {if (!Dto.isIPlayerRegisterPlayerInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.registerPlayer.execute(input);

if (result.ok && !Dto.isIPlayerRegisterPlayerOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'GetPlayer': {if (!Dto.isIPlayerGetPlayerInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.getPlayer.execute(input);

if (result.ok && !Dto.isIPlayerGetPlayerOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'UpdatePlayerProfile': {if (!Dto.isIPlayerUpdatePlayerProfileInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.updatePlayerProfile.execute(input);

if (result.ok && !Dto.isIPlayerUpdatePlayerProfileOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'AddContact': {if (!Dto.isIPlayerAddContactInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.addContact.execute(input);

if (result.ok && !Dto.isIPlayerAddContactOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'VerifyContact': {if (!Dto.isIPlayerVerifyContactInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.verifyContact.execute(input);

if (result.ok && !Dto.isIPlayerVerifyContactOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'ChangePlayerStatus': {if (!Dto.isIPlayerChangePlayerStatusInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.changePlayerStatus.execute(input);

if (result.ok && !Dto.isIPlayerChangePlayerStatusOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'OpenKycCase': {if (!Dto.isIPlayerOpenKycCaseInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.openKycCase.execute(input);

if (result.ok && !Dto.isIPlayerOpenKycCaseOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'RecordKycCheck': {if (!Dto.isIPlayerRecordKycCheckInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.recordKycCheck.execute(input);

if (result.ok && !Dto.isIPlayerRecordKycCheckOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'DecideKycCase': {if (!Dto.isIPlayerDecideKycCaseInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.decideKycCase.execute(input);

if (result.ok && !Dto.isIPlayerDecideKycCaseOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'GetKycStatus': {if (!Dto.isIPlayerGetKycStatusInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.getKycStatus.execute(input);

if (result.ok && !Dto.isIPlayerGetKycStatusOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'ApplyRestriction': {if (!Dto.isIPlayerApplyRestrictionInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.applyRestriction.execute(input);

if (result.ok && !Dto.isIPlayerApplyRestrictionOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'ClearRestriction': {if (!Dto.isIPlayerClearRestrictionInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.clearRestriction.execute(input);

if (result.ok && !Dto.isIPlayerClearRestrictionOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'GetRestrictions': {if (!Dto.isIPlayerGetRestrictionsInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.getRestrictions.execute(input);

if (result.ok && !Dto.isIPlayerGetRestrictionsOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'CheckEligibility': {if (!Dto.isIPlayerCheckEligibilityInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.checkEligibility.execute(input);

if (result.ok && !Dto.isIPlayerCheckEligibilityOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
case 'GetPlayerReference': {if (!Dto.isIPlayerGetPlayerReferenceInput(input)) throw new BoundaryError('INVALID_INPUT', correlationId);dispatched = true;const result = await this.operations.getPlayerReference.execute(input);

if (result.ok && !Dto.isIPlayerGetPlayerReferenceOutput(result.value)) throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);

return result;}
default:throw new BoundaryError('INVALID_INPUT', correlationId);}} catch(error) {const code = error instanceof BoundaryError ? error.code : dispatched ? 'ADAPTER_CONTRACT_VIOLATION' : 'INVALID_INPUT';

return {ok:false, error:{code:codeValue(code), message:code, correlationId, retryable:false, outcomeUnknown:dispatched && !operation.startsWith('Get') && operation !== 'CheckEligibility'}};}}

 grpcHeaders(metadata:Metadata, context:unknown):ITransportHeaders {const claimed = objectValue(context);

return {authorization:metadata.get('authorization')[0], correlationId:metadata.get('x-correlation-id')[0] ?? claimed.correlationId, deadlineAt:metadata.get('x-deadline-at')[0] ?? claimed.deadlineAt};}

 validateDelegation(context:unknown, headers:ITransportHeaders):void {const claimed = objectValue(context);const trusted = this.context(headers);

for (const key of ['operatorId', 'actorId', 'actorKind', 'playerId']) if (key in claimed && claimed[key] !== objectValue(trusted)[key]) {if (key === 'actorKind' && typeof claimed[key] === 'string' && claimed[key].endsWith('_' + trusted.actorKind)) continue;throw new BoundaryError('PERMISSION_DENIED', trusted.correlationId);}

 if (Array.isArray(claimed.capabilities)) {const values = decodeShape(claimed.capabilities, {kind:ShapeKind.ARRAY, items:{kind:ShapeKind.ENUM, values:Object.values(Capability)}}, true);

if (Array.isArray(values) && values.some(value=>!trusted.capabilities.some(capability=>capability === value))) throw new BoundaryError('PERMISSION_DENIED', trusted.correlationId);}}
}

import { ErrorCode } from '../../../domain/player.model.js';

function codeValue(code:string):ErrorCode {return Object.values(ErrorCode).find(value=>value === code) ?? ErrorCode.INVALID_INPUT;}

export function transportError(code:string):IResult<RegisteredOutput> {return {ok:false, error:{code:codeValue(code), message:code, correlationId:'00000000-0000-4000-8000-000000000001', retryable:false, outcomeUnknown:false}};}
