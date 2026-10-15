import { Controller, Get, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { camelWire, jsonWire, objectValue } from '@sportsbook/service-transport';

import { PLAYER_BOUNDARY } from '../../../infra/player-transport.tokens.js';
import { PlayerBoundary } from '../shared/player-boundary.js';

export interface IRestRequest {
  body: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
}

export interface IRestResponse {
  status(code: number): IRestResponse;
  json(value: unknown): unknown;
  setHeader(key: string, value: string): void;
}

@Controller()
export class PlayerRestController {
  constructor(@Inject(PLAYER_BOUNDARY) private readonly boundary: PlayerBoundary) { }

  @Post('/internal/v1/players')
  async registerPlayer(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));
    const result = await this.boundary.execute(
      'RegisterPlayer',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(201).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/players/:player_id')
  async getPlayer(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;
    const result = await this.boundary.execute(
      'GetPlayer',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Patch('/internal/v1/players/:player_id/profile')
  async updatePlayerProfile(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;
    const result = await this.boundary.execute(
      'UpdatePlayerProfile',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/players/:player_id/contacts')
  async addContact(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;
    const result = await this.boundary.execute(
      'AddContact',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(201).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/players/:player_id/contacts/:contact_id/verify')
  async verifyContact(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;

    if ('contactId' in body && body.contactId !== request.params.contact_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.contactId = request.params.contact_id;
    const result = await this.boundary.execute(
      'VerifyContact',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/players/:player_id/status-changes')
  async changePlayerStatus(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;
    const result = await this.boundary.execute(
      'ChangePlayerStatus',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/players/:player_id/kyc-cases')
  async openKycCase(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;
    const result = await this.boundary.execute(
      'OpenKycCase',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(201).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/players/:player_id/kyc-cases/:case_id/checks')
  async recordKycCheck(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;

    if ('caseId' in body && body.caseId !== request.params.case_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.caseId = request.params.case_id;
    const result = await this.boundary.execute(
      'RecordKycCheck',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/players/:player_id/kyc-cases/:case_id/decisions')
  async decideKycCase(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;

    if ('caseId' in body && body.caseId !== request.params.case_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.caseId = request.params.case_id;
    const result = await this.boundary.execute(
      'DecideKycCase',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/players/:player_id/kyc-status')
  async getKycStatus(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;
    const result = await this.boundary.execute(
      'GetKycStatus',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/players/:player_id/restrictions')
  async applyRestriction(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;
    const result = await this.boundary.execute(
      'ApplyRestriction',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(201).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/players/:player_id/restrictions/:restriction_id/clear')
  async clearRestriction(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;

    if ('restrictionId' in body && body.restrictionId !== request.params.restriction_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.restrictionId = request.params.restriction_id;
    const result = await this.boundary.execute(
      'ClearRestriction',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/players/:player_id/restrictions')
  async getRestrictions(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;
    const page = {
      limit: body.limit === undefined ? 50 : Number(body.limit),
      ...(body.cursor === undefined ? {} : { cursor: body.cursor }),
      ...(body.from === undefined ? {} : { from: body.from }),
      ...(body.to === undefined ? {} : { to: body.to }),
    };

    for (const key of ['limit', 'cursor', 'from', 'to']) {
      delete body[key];
    }
    body.page = page;
    const result = await this.boundary.execute(
      'GetRestrictions',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/players/:player_id/eligibility-checks')
  async checkEligibility(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;
    const result = await this.boundary.execute(
      'CheckEligibility',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/players/:player_id/reference')
  async getPlayerReference(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;
    const result = await this.boundary.execute(
      'GetPlayerReference',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }
}

export function httpCode(code: string): number {
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
  }[code] ?? 422);
}
