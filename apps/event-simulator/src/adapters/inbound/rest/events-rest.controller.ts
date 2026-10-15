import { Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import { camelWire, jsonWire, objectValue } from '@sportsbook/service-transport';

import { EVENTS_BOUNDARY } from '../../../infra/events-transport.tokens.js';
import { EventsBoundary } from '../shared/events-boundary.js';

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
export class EventsRestController {
  constructor(@Inject(EVENTS_BOUNDARY) private readonly boundary: EventsBoundary) { }

  @Get('/internal/v1/events')
  async listEvents(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));
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
      'ListEvents',
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

  @Get('/internal/v1/events/:event_id')
  async getEvent(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('eventId' in body && body.eventId !== request.params.event_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.eventId = request.params.event_id;
    const result = await this.boundary.execute(
      'GetEvent',
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

  @Get('/internal/v1/events/:event_id/markets')
  async getMarkets(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('eventId' in body && body.eventId !== request.params.event_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.eventId = request.params.event_id;
    const result = await this.boundary.execute(
      'GetMarkets',
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

  @Post('/internal/v1/quote-validations')
  async validateSelectionQuote(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));
    const result = await this.boundary.execute(
      'ValidateSelectionQuote',
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

  @Get('/internal/v1/events/:event_id/result')
  async getEventResult(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('eventId' in body && body.eventId !== request.params.event_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.eventId = request.params.event_id;
    const result = await this.boundary.execute(
      'GetEventResult',
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

  @Post('/internal/v1/events/:event_id/phase-advances')
  async advanceMatchPhase(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('eventId' in body && body.eventId !== request.params.event_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.eventId = request.params.event_id;
    const result = await this.boundary.execute(
      'AdvanceMatchPhase',
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

  @Post('/internal/v1/events/:event_id/completions')
  async completeEvent(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('eventId' in body && body.eventId !== request.params.event_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.eventId = request.params.event_id;
    const result = await this.boundary.execute(
      'CompleteEvent',
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
