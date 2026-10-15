import { Controller, Get, Inject, Patch, Post, Req, Res } from '@nestjs/common';
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
import { PLAYERS_IDENTITY, PLAYERS_OPERATIONS } from '../../../infra/players.tokens.js';
import * as Dto from './players.dto.js';

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

export type IPlayersOperations = Pick<
  IGatewayOperationPorts,
  'registerPlayer' | 'getMyProfile' | 'updateMyProfile' | 'getMyEligibility'
>;

@Controller()
export class PlayersRestController {
  constructor(
    @Inject(PLAYERS_OPERATIONS)
    private readonly operations: IPlayersOperations,
    @Inject(PLAYERS_IDENTITY)
    private readonly identity: SignedIdentity,
  ) { }

  @Post('/v1/players')
  async registerPlayer(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('RegisterPlayer', request, response);
  }

  @Get('/v1/me/profile')
  async getMyProfile(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('GetMyProfile', request, response);
  }

  @Patch('/v1/me/profile')
  async updateMyProfile(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('UpdateMyProfile', request, response);
  }

  @Get('/v1/me/eligibility')
  async getMyEligibility(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    return this.execute('GetMyEligibility', request, response);
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
          'RegisterPlayer': 'POST',
          'GetMyProfile': 'GET',
          'UpdateMyProfile': 'PATCH',
          'GetMyEligibility': 'GET',
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
        case 'RegisterPlayer': {
          const input = Dto.decodeInput('IGatewayRegisterPlayerInput', { ...body, context });

          if (!Dto.isIGatewayRegisterPlayerInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.registerPlayer.execute(input),
          );

          if (value.ok && !Dto.isIGatewayRegisterPlayerOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'GetMyProfile': {
          const input = Dto.decodeInput('IGatewayGetMyProfileInput', { ...body, context });

          if (!Dto.isIGatewayGetMyProfileInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.getMyProfile.execute(input),
          );

          if (value.ok && !Dto.isIGatewayGetMyProfileOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'UpdateMyProfile': {
          const input = Dto.decodeInput('IGatewayUpdateMyProfileInput', { ...body, context });

          if (!Dto.isIGatewayUpdateMyProfileInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.updateMyProfile.execute(input),
          );

          if (value.ok && !Dto.isIGatewayUpdateMyProfileOutput(value.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }
          result = value;
          break;
        }
        case 'GetMyEligibility': {
          const input = Dto.decodeInput('IGatewayGetMyEligibilityInput', { ...body, context });

          if (!Dto.isIGatewayGetMyEligibilityInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }

          const value = await observeOperation(
            'api-gateway',
            operation,
            request.headers,
            context.deadlineAt,
            () => this.operations.getMyEligibility.execute(input),
          );

          if (value.ok && !Dto.isIGatewayGetMyEligibilityOutput(value.value)) {
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
