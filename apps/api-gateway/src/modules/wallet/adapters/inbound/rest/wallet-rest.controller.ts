import { Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import {
  AdmissionError,
  BoundaryError,
  camelWire,
  jsonWire,
  objectValue,
  observeOperation,
  SignedIdentity,
} from '@sportsbook/service-transport';

import * as M from '../../../../../domain/gateway.model.js';
import type { IGatewayOperationPorts } from '../../../../../ports/inbound/gateway-application.port.js';
import { WALLET_IDENTITY, WALLET_OPERATIONS } from '../../../infra/wallet.tokens.js';
import * as Dto from './wallet.dto.js';

export interface IRestRequest {
  body?: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
}

export interface IRestResponse {
  status(code: number): IRestResponse;
  json(value: unknown): unknown;
  setHeader(key: string, value: string): void;
}

export type IWalletOperations = Pick<IGatewayOperationPorts, 'getMyBalance'
  | 'topUpTestWallet'
  | 'requestMyWithdrawal'
  | 'getMyWithdrawal'
  | 'getMyTransactions'>;

@Controller()
export class WalletRestController {
  constructor(
    @Inject(WALLET_OPERATIONS)
    private readonly operations: IWalletOperations,
    @Inject(WALLET_IDENTITY)
    private readonly identity: SignedIdentity,
  ) { }

  @Get('/v1/wallet')
  async getMyBalance(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('GetMyBalance', request, response);
  }

  @Post('/v1/wallet/deposits')
  async topUpTestWallet(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('TopUpTestWallet', request, response);
  }

  @Post('/v1/wallet/withdrawals')
  async requestMyWithdrawal(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('RequestMyWithdrawal', request, response);
  }

  @Get('/v1/wallet/withdrawals/:withdrawal_id')
  async getMyWithdrawal(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('GetMyWithdrawal', request, response);
  }

  @Get('/v1/wallet/transactions')
  async getMyTransactions(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('GetMyTransactions', request, response);
  }

  private async execute(operation: string, request: IRestRequest, response: IRestResponse): Promise<unknown> {
    let correlationId = '00000000-0000-4000-8000-000000000001';

    try {
      const claims = this.identity.authenticate(
        request.headers.authorization,
        request.headers['x-correlation-id'],
        request.headers['x-deadline-at'],
      );

      correlationId = claims.correlationId;
      const actorKind = Object.values(M.ActorKind).find(k => k === claims.actorKind);

      if (!actorKind) {
        throw new BoundaryError('UNAUTHENTICATED', correlationId);
      }

      const context: M.ICallContext = {
        ...claims,
        actorKind,
        capabilities: Object.values(M.Capability).filter(c => claims.capabilities.includes(c)),
      };
      const raw = objectValue(
        {
          'GetMyBalance': 'GET',
          'TopUpTestWallet': 'POST',
          'RequestMyWithdrawal': 'POST',
          'GetMyWithdrawal': 'GET',
          'GetMyTransactions': 'GET',
        }[operation]
          === 'GET'
          ? request.query
          : request.body ?? {},
      );

      canonicalFields(raw);
      const body = objectValue(camelWire(raw));

      if ('context' in body || 'operatorId' in body || 'playerId' in body) {
        throw new BoundaryError('INVALID_INPUT', correlationId);
      }

      let result: M.IResult<M.RegisteredOutput>;

      switch (operation) {
        case 'GetMyBalance': {
          const input = Dto.decodeInput('IGatewayGetMyBalanceInput', { ...body, context });

          if (!Dto.isIGatewayGetMyBalanceInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.getMyBalance.execute(input),
          );

          if (value.ok && !Dto.isIGatewayGetMyBalanceOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'TopUpTestWallet': {
          const input = Dto.decodeInput('IGatewayTopUpTestWalletInput', { ...body, context });

          if (!Dto.isIGatewayTopUpTestWalletInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.topUpTestWallet.execute(input),
          );

          if (value.ok && !Dto.isIGatewayTopUpTestWalletOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'RequestMyWithdrawal': {
          const input = Dto.decodeInput('IGatewayRequestMyWithdrawalInput', { ...body, context });

          if (!Dto.isIGatewayRequestMyWithdrawalInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.requestMyWithdrawal.execute(input),
          );

          if (value.ok && !Dto.isIGatewayRequestMyWithdrawalOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'GetMyWithdrawal': {
          if ('withdrawalId' in body) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          body.withdrawalId = request.params.withdrawal_id;
          const input = Dto.decodeInput('IGatewayGetMyWithdrawalInput', { ...body, context });

          if (!Dto.isIGatewayGetMyWithdrawalInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.getMyWithdrawal.execute(input),
          );

          if (value.ok && !Dto.isIGatewayGetMyWithdrawalOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'GetMyTransactions': {
          body.page =
            {
              limit: integer(body.limit, 50),
              ...(body.cursor === undefined ? {} : { cursor: body.cursor }),
              ...(body.from === undefined ? {} : { from: body.from }),
              ...(body.to === undefined ? {} : { to: body.to }),
            };

          for (const key of ['limit', 'cursor', 'from', 'to']) {
            delete body[key];
          }
          const input = Dto.decodeInput('IGatewayGetMyTransactionsInput', { ...body, context });

          if (!Dto.isIGatewayGetMyTransactionsInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.getMyTransactions.execute(input),
          );

          if (value.ok && !Dto.isIGatewayGetMyTransactionsOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        default: throw new BoundaryError('INVALID_INPUT', correlationId);
      }
      response.setHeader('x-correlation-id', correlationId);

      if (!result.ok) {
        if (!Dto.isIError(result.error)) {
          throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
        }

        return response.status(httpCode(result.error.code)).json(
          jsonWire({ ...result.error, correlationId, message: result.error.code }, true),
        );
      }

      const fields = objectValue(result.value);

      return response.status(
        fields.outcome === 'PENDING'
          ? 202
          : ['RegisterPlayer', 'RequestMyWithdrawal', 'PlaceBet'].includes(operation)
            && fields.outcome !== 'REJECTED'
            ? 201
            : 200,
      ).json(
        jsonWire(result.value, true),
      );
    } catch (error) {
      const code = error instanceof BoundaryError || error instanceof AdmissionError
        ? error.code
        : 'INVALID_INPUT';

      return response.status(httpCode(code)).json(
        {
          code,
          message: code,
          correlation_id: correlationId,
          retryable: error instanceof AdmissionError,
          outcome_unknown: false,
        },
      );
    }
  }
}

function canonicalFields(value: unknown): void {
  if (Array.isArray(value)) {
    for (const v of value) {
      canonicalFields(v);
    }

    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(key)) {
        throw new BoundaryError('INVALID_INPUT');
      }
      canonicalFields(v);
    }
  }
}

function integer(v: unknown, fallback: number): number {
  if (v === undefined) {
    return fallback;
  }
  if (typeof v !== 'string' || !/^([1-9]\d*)$/.test(v)) {
    throw new BoundaryError('INVALID_INPUT');
  }

  const n = Number(v);

  if (!Number.isSafeInteger(n)) {
    throw new BoundaryError('INVALID_INPUT');
  }

  return n;
}

function httpCode(code: string): number {
  return ({
    INVALID_INPUT: 400,
    AMOUNT_OUT_OF_RANGE: 400,
    CURRENCY_MISMATCH: 400,
    UNAUTHENTICATED: 401,
    PERMISSION_DENIED: 403,
    NOT_FOUND: 404,
    IDEMPOTENCY_CONFLICT: 409,
    VERSION_CONFLICT: 409,
    IN_PROGRESS: 202,
    OVERLOADED: 429,
    DEADLINE_EXCEEDED: 504,
    DEPENDENCY_UNAVAILABLE: 503,
    ADAPTER_CONTRACT_VIOLATION: 500,
    INVARIANT_VIOLATION: 500,
  }[code]
    ?? 422);
}
