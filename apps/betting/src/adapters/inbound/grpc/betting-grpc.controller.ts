import type { Metadata } from '@grpc/grpc-js';
import { status } from '@grpc/grpc-js';
import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { BoundaryError, objectValue } from '@sportsbook/service-transport';

import { BETTING_BOUNDARY } from '../../../infra/betting-transport.tokens.js';
import { BettingBoundary, transportError } from '../shared/betting-boundary.js';
import { protobufOutput } from './betting-wire.js';

@Controller()
export class BettingGrpcController {
  constructor(@Inject(BETTING_BOUNDARY) private readonly boundary: BettingBoundary) { }

  @GrpcMethod('BettingService', 'PlaceBet')
  async placeBet(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('PlaceBet', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'PlaceBetResponse');
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

  @GrpcMethod('BettingService', 'GetBet')
  async getBet(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('GetBet', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'GetBetResponse');
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

  @GrpcMethod('BettingService', 'ListPlayerBets')
  async listPlayerBets(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('ListPlayerBets', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'ListPlayerBetsResponse');
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

  @GrpcMethod('BettingService', 'GetBetStatus')
  async getBetStatus(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('GetBetStatus', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'GetBetStatusResponse');
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

  @GrpcMethod('BettingService', 'CancelBet')
  async cancelBet(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('CancelBet', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'CancelBetResponse');
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

  @GrpcMethod('BettingService', 'RecordEventResult')
  async recordEventResult(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('RecordEventResult', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'RecordEventResultResponse');
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

  @GrpcMethod('BettingService', 'SettleBet')
  async settleBet(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('SettleBet', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'SettleBetResponse');
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

  @GrpcMethod('BettingService', 'RetryPendingReservation')
  async retryPendingReservation(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('RetryPendingReservation', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'RetryPendingReservationResponse');
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

  @GrpcMethod('BettingService', 'RetryPendingSettlement')
  async retryPendingSettlement(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('RetryPendingSettlement', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'RetryPendingSettlementResponse');
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

  @GrpcMethod('BettingService', 'ReconcileBetWithLedger')
  async reconcileBetWithLedger(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('ReconcileBetWithLedger', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'ReconcileBetWithLedgerResponse');
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

  @GrpcMethod('BettingService', 'RetryPendingCancellation')
  async retryPendingCancellation(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('RetryPendingCancellation', body, headers, true);

      if (!result.ok) {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'RetryPendingCancellationResponse');
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
