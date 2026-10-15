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
import { BETS_IDENTITY, BETS_OPERATIONS } from '../../../infra/bets.tokens.js';
import * as Dto from './bets.dto.js';

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

export type IBetsOperations = Pick<
  IGatewayOperationPorts,
  'placeBet' | 'getMyBet' | 'getMyBetStatus' | 'listMyBets' | 'cancelMyBet'
>;

@Controller()
export class BetsRestController {
  constructor(
    @Inject(BETS_OPERATIONS)
    private readonly operations: IBetsOperations,
    @Inject(BETS_IDENTITY)
    private readonly identity: SignedIdentity,
  ) { }

  @Post('/v1/bets')
  async placeBet(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('PlaceBet', request, response);
  }

  @Get('/v1/bets/:bet_id')
  async getMyBet(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('GetMyBet', request, response);
  }

  @Get('/v1/bets/:bet_id/status')
  async getMyBetStatus(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('GetMyBetStatus', request, response);
  }

  @Get('/v1/bets')
  async listMyBets(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('ListMyBets', request, response);
  }

  @Post('/v1/bets/:bet_id/cancel')
  async cancelMyBet(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('CancelMyBet', request, response);
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
          'PlaceBet': 'POST',
          'GetMyBet': 'GET',
          'GetMyBetStatus': 'GET',
          'ListMyBets': 'GET',
          'CancelMyBet': 'POST',
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
        case 'PlaceBet': {
          const input = Dto.decodeInput('IGatewayPlaceBetInput', { ...body, context });

          if (!Dto.isIGatewayPlaceBetInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.placeBet.execute(input),
          );

          if (value.ok && !Dto.isIGatewayPlaceBetOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'GetMyBet': {
          if ('betId' in body) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          body.betId = request.params.bet_id;
          const input = Dto.decodeInput('IGatewayGetMyBetInput', { ...body, context });

          if (!Dto.isIGatewayGetMyBetInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.getMyBet.execute(input),
          );

          if (value.ok && !Dto.isIGatewayGetMyBetOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'GetMyBetStatus': {
          if ('betId' in body) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          body.betId = request.params.bet_id;
          const input = Dto.decodeInput('IGatewayGetMyBetStatusInput', { ...body, context });

          if (!Dto.isIGatewayGetMyBetStatusInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.getMyBetStatus.execute(input),
          );

          if (value.ok && !Dto.isIGatewayGetMyBetStatusOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'ListMyBets': {
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
          const input = Dto.decodeInput('IGatewayListMyBetsInput', { ...body, context });

          if (!Dto.isIGatewayListMyBetsInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.listMyBets.execute(input),
          );

          if (value.ok && !Dto.isIGatewayListMyBetsOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'CancelMyBet': {
          if ('betId' in body) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          body.betId = request.params.bet_id;
          const input = Dto.decodeInput('IGatewayCancelMyBetInput', { ...body, context });

          if (!Dto.isIGatewayCancelMyBetInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.cancelMyBet.execute(input),
          );

          if (value.ok && !Dto.isIGatewayCancelMyBetOutput(value.value)) {
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
