import type { Metadata } from '@grpc/grpc-js';
import { status } from '@grpc/grpc-js';
import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { BoundaryError, objectValue } from '@sportsbook/service-transport';

import { PLAYER_BOUNDARY } from '../../../infra/player-transport.tokens.js';
import { PlayerBoundary, transportError } from '../shared/player-boundary.js';
import { protobufOutput } from './player-wire.js';

@Controller()
export class PlayerGrpcController {
  constructor(@Inject(PLAYER_BOUNDARY) private readonly boundary: PlayerBoundary) { }

  @GrpcMethod('PlayerService', 'RegisterPlayer')
  async registerPlayer(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('RegisterPlayer', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'RegisterPlayerResponse');
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

  @GrpcMethod('PlayerService', 'GetPlayer')
  async getPlayer(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('GetPlayer', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'GetPlayerResponse');
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

  @GrpcMethod('PlayerService', 'UpdatePlayerProfile')
  async updatePlayerProfile(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('UpdatePlayerProfile', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'UpdatePlayerProfileResponse');
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

  @GrpcMethod('PlayerService', 'AddContact')
  async addContact(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('AddContact', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'AddContactResponse');
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

  @GrpcMethod('PlayerService', 'VerifyContact')
  async verifyContact(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('VerifyContact', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'VerifyContactResponse');
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

  @GrpcMethod('PlayerService', 'ChangePlayerStatus')
  async changePlayerStatus(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('ChangePlayerStatus', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'ChangePlayerStatusResponse');
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

  @GrpcMethod('PlayerService', 'OpenKycCase')
  async openKycCase(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('OpenKycCase', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'OpenKycCaseResponse');
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

  @GrpcMethod('PlayerService', 'RecordKycCheck')
  async recordKycCheck(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('RecordKycCheck', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'RecordKycCheckResponse');
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

  @GrpcMethod('PlayerService', 'DecideKycCase')
  async decideKycCase(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('DecideKycCase', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'DecideKycCaseResponse');
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

  @GrpcMethod('PlayerService', 'GetKycStatus')
  async getKycStatus(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('GetKycStatus', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'GetKycStatusResponse');
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

  @GrpcMethod('PlayerService', 'ApplyRestriction')
  async applyRestriction(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('ApplyRestriction', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'ApplyRestrictionResponse');
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

  @GrpcMethod('PlayerService', 'ClearRestriction')
  async clearRestriction(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('ClearRestriction', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'ClearRestrictionResponse');
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

  @GrpcMethod('PlayerService', 'GetRestrictions')
  async getRestrictions(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('GetRestrictions', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'GetRestrictionsResponse');
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

  @GrpcMethod('PlayerService', 'CheckEligibility')
  async checkEligibility(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('CheckEligibility', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'CheckEligibilityResponse');
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

  @GrpcMethod('PlayerService', 'GetPlayerReference')
  async getPlayerReference(payload: unknown, metadata: Metadata): Promise<unknown> {
    try {
      const request = objectValue(payload);
      const headers = this.boundary.grpcHeaders(metadata, request.context);

      this.boundary.validateDelegation(request.context, headers);
      const { context: _context, ...body } = request;

      void _context;
      const result = await this.boundary.execute('GetPlayerReference', body, headers, true);

      if (!result.ok && result.error.code !== 'IN_PROGRESS') {
        throw new RpcException({ code: grpcCode(result.error.code), message: JSON.stringify(result.error) });
      }

      return protobufOutput(result, 'GetPlayerReferenceResponse');
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
