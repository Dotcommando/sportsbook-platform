import type { Metadata } from '@grpc/grpc-js';
import { status } from '@grpc/grpc-js';
import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { BoundaryError, objectValue } from '@sportsbook/service-transport';

import { EVENTS_BOUNDARY } from '../../../infra/events-transport.tokens.js';
import { EventsBoundary, transportError } from '../shared/events-boundary.js';
import { protobufOutput } from './events-wire.js';

@Controller()
export class EventsGrpcController {
  constructor(@Inject(EVENTS_BOUNDARY) private readonly boundary: EventsBoundary) { }

  @GrpcMethod('EventsService', 'ListEvents')
  async listEvents(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('ListEvents', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'ListEventsResponse');
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

      throw new RpcException(
        {
          code: grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'),
          message: JSON.stringify(result.ok ? {} : result.error),
        },
      );
    }
  }

  @GrpcMethod('EventsService', 'GetEvent')
  async getEvent(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('GetEvent', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'GetEventResponse');
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

      throw new RpcException(
        {
          code: grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'),
          message: JSON.stringify(result.ok ? {} : result.error),
        },
      );
    }
  }

  @GrpcMethod('EventsService', 'GetMarkets')
  async getMarkets(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('GetMarkets', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'GetMarketsResponse');
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

      throw new RpcException(
        {
          code: grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'),
          message: JSON.stringify(result.ok ? {} : result.error),
        },
      );
    }
  }

  @GrpcMethod('EventsService', 'ValidateSelectionQuote')
  async validateSelectionQuote(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('ValidateSelectionQuote', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'ValidateSelectionQuoteResponse');
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

      throw new RpcException(
        {
          code: grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'),
          message: JSON.stringify(result.ok ? {} : result.error),
        },
      );
    }
  }

  @GrpcMethod('EventsService', 'GetEventResult')
  async getEventResult(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('GetEventResult', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'GetEventResultResponse');
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

      throw new RpcException(
        {
          code: grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'),
          message: JSON.stringify(result.ok ? {} : result.error),
        },
      );
    }
  }

  @GrpcMethod('EventsService', 'AdvanceMatchPhase')
  async advanceMatchPhase(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('AdvanceMatchPhase', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'AdvanceMatchPhaseResponse');
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

      throw new RpcException(
        {
          code: grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'),
          message: JSON.stringify(result.ok ? {} : result.error),
        },
      );
    }
  }

  @GrpcMethod('EventsService', 'CompleteEvent')
  async completeEvent(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('CompleteEvent', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'CompleteEventResponse');
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      const result = transportError(error instanceof BoundaryError ? error.code : 'INVALID_INPUT');

      throw new RpcException(
        {
          code: grpcCode(error instanceof BoundaryError ? error.code : 'INVALID_INPUT'),
          message: JSON.stringify(result.ok ? {} : result.error),
        },
      );
    }
  }
}

function grpcCode(code: string): number {
  return ({
    INVALID_INPUT: status.INVALID_ARGUMENT,
    AMOUNT_OUT_OF_RANGE: status.INVALID_ARGUMENT,
    CURRENCY_MISMATCH: status.INVALID_ARGUMENT,
    UNAUTHENTICATED: status.UNAUTHENTICATED,
    PERMISSION_DENIED: status.PERMISSION_DENIED,
    NOT_FOUND: status.NOT_FOUND,
    IDEMPOTENCY_CONFLICT: status.ALREADY_EXISTS,
    VERSION_CONFLICT: status.ABORTED,
    OVERLOADED: status.RESOURCE_EXHAUSTED,
    DEADLINE_EXCEEDED: status.DEADLINE_EXCEEDED,
    DEPENDENCY_UNAVAILABLE: status.UNAVAILABLE,
    ADAPTER_CONTRACT_VIOLATION: status.INTERNAL,
    INVARIANT_VIOLATION: status.INTERNAL,
  }[code]
    ?? status.FAILED_PRECONDITION);
}
