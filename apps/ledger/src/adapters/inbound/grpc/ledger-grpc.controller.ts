import type { Metadata } from '@grpc/grpc-js';
import { status } from '@grpc/grpc-js';
import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { BoundaryError, objectValue } from '@sportsbook/service-transport';

import {LEDGER_BOUNDARY} from '../../../infra/ledger-transport.tokens.js';
import {LedgerBoundary, transportError} from '../shared/ledger-boundary.js';
import {protobufOutput} from './ledger-wire.js';

@Controller()
export class LedgerGrpcController {constructor(@Inject(LEDGER_BOUNDARY) private readonly boundary:LedgerBoundary) {}

@GrpcMethod('LedgerService', 'CreateWallet')
async createWallet(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('CreateWallet', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'CreateWalletResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'GetBalance')
async getBalance(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('GetBalance', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'GetBalanceResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'GetTransaction')
async getTransaction(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('GetTransaction', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'GetTransactionResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'GetLedgerEntries')
async getLedgerEntries(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('GetLedgerEntries', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'GetLedgerEntriesResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'GetWalletTransactions')
async getWalletTransactions(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('GetWalletTransactions', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'GetWalletTransactionsResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'GetBetFinancialStatus')
async getBetFinancialStatus(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('GetBetFinancialStatus', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'GetBetFinancialStatusResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'GetWithdrawal')
async getWithdrawal(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('GetWithdrawal', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'GetWithdrawalResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'GetCommandOutcome')
async getCommandOutcome(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('GetCommandOutcome', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'GetCommandOutcomeResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'DepositTestFunds')
async depositTestFunds(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('DepositTestFunds', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'DepositTestFundsResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'RequestWithdrawal')
async requestWithdrawal(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('RequestWithdrawal', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'RequestWithdrawalResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'CompleteWithdrawal')
async completeWithdrawal(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('CompleteWithdrawal', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'CompleteWithdrawalResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'RejectWithdrawal')
async rejectWithdrawal(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('RejectWithdrawal', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'RejectWithdrawalResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'ReserveStake')
async reserveStake(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('ReserveStake', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'ReserveStakeResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'SettleWin')
async settleWin(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('SettleWin', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'SettleWinResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'SettleLoss')
async settleLoss(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('SettleLoss', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'SettleLossResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'CancelBet')
async cancelBet(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('CancelBet', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'CancelBetResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'ReconcileLedger')
async reconcileLedger(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('ReconcileLedger', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'ReconcileLedgerResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}

@GrpcMethod('LedgerService', 'GetWallet')
async getWallet(payload:unknown, metadata:Metadata):Promise<unknown> {try {const request = objectValue(payload);const headers = this.boundary.grpcHeaders(metadata, request.context);

this.boundary.validateDelegation(request.context, headers);const {context:_context, ...body} = request;

void _context;const result = await this.boundary.execute('GetWallet', body, headers, true);

if (!result.ok && result.error.code !== 'IN_PROGRESS') throw new RpcException({code:grpcCode(result.error.code), message:JSON.stringify(result.error)});

return protobufOutput(result, 'GetWalletResponse');} catch(error) {if (error instanceof RpcException) throw error;

const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

throw new RpcException({code:grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'), message:JSON.stringify(result.ok ? {} : result.error)});}}
}

function grpcCode(code:string):number {return ({INVALID_INPUT:status.INVALID_ARGUMENT, AMOUNT_OUT_OF_RANGE:status.INVALID_ARGUMENT, CURRENCY_MISMATCH:status.INVALID_ARGUMENT, UNAUTHENTICATED:status.UNAUTHENTICATED, PERMISSION_DENIED:status.PERMISSION_DENIED, NOT_FOUND:status.NOT_FOUND, IDEMPOTENCY_CONFLICT:status.ALREADY_EXISTS, VERSION_CONFLICT:status.ABORTED, OVERLOADED:status.RESOURCE_EXHAUSTED, DEADLINE_EXCEEDED:status.DEADLINE_EXCEEDED, DEPENDENCY_UNAVAILABLE:status.UNAVAILABLE, ADAPTER_CONTRACT_VIOLATION:status.INTERNAL, INVARIANT_VIOLATION:status.INTERNAL}[code] ?? status.FAILED_PRECONDITION);}
