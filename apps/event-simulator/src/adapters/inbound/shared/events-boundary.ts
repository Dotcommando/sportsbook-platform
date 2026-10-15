import type { Metadata } from '@grpc/grpc-js';
import { Inject, Injectable } from '@nestjs/common';
import {
  AdmissionError,
  BoundaryError,
  decodeShape,
  objectValue,
  observeOperation,
  ShapeKind,
  SignedIdentity,
} from '@sportsbook/service-transport';

import type { ICallContext, IResult, RegisteredOutput } from '../../../domain/events.model.js';
import { ActorKind, Capability } from '../../../domain/events.model.js';
import { EVENTS_IDENTITY, EVENTS_OPERATIONS } from '../../../infra/events-transport.tokens.js';
import type { IEventsOperationPorts } from '../../../ports/inbound/events-application.port.js';
import * as Dto from './events.dto.js';

export interface ITransportHeaders {
  authorization?: unknown;
  correlationId?: unknown;
  deadlineAt?: unknown;
  traceparent?: unknown;
  tracestate?: unknown;
}

@Injectable()
export class EventsBoundary {
  constructor(
    @Inject(EVENTS_OPERATIONS)
    private readonly operations: IEventsOperationPorts,
    @Inject(EVENTS_IDENTITY)
    private readonly identity: SignedIdentity,
  ) { }

  context(headers: ITransportHeaders): ICallContext {
    const claims = this.identity.authenticate(headers.authorization, headers.correlationId, headers.deadlineAt);
    const actorKind = Object.values(ActorKind).find(kind => kind === claims.actorKind);

    if (!actorKind) {
      throw new BoundaryError('UNAUTHENTICATED');
    }

    const capabilities = Object.values(Capability).filter(capability => claims.capabilities.includes(capability));

    return { ...claims, actorKind, capabilities };
  }

  async execute(
    operation: string,
    body: unknown,
    headers: ITransportHeaders,
    protobuf = false,
  ): Promise<
    IResult<
      RegisteredOutput
    >
  > {
    let dispatched = false;
    let correlationId = '00000000-0000-4000-8000-000000000001';

    try {
      const context = this.context(headers);

      correlationId = context.correlationId;
      const args = objectValue(body);

      if ('context' in args || 'operatorId' in args) {
        throw new BoundaryError('INVALID_INPUT', correlationId);
      }

      const input = Dto.decodeInput('IEvents' + operation + 'Input', { ...args, context }, protobuf);

      switch (operation) {
        case 'ListEvents': {
          if (!Dto.isIEventsListEventsInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'event-simulator',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.listEvents.execute(input),
          );

          if (result.ok && !Dto.isIEventsListEventsOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetEvent': {
          if (!Dto.isIEventsGetEventInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'event-simulator',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getEvent.execute(input),
          );

          if (result.ok && !Dto.isIEventsGetEventOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetMarkets': {
          if (!Dto.isIEventsGetMarketsInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'event-simulator',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getMarkets.execute(input),
          );

          if (result.ok && !Dto.isIEventsGetMarketsOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'ValidateSelectionQuote': {
          if (!Dto.isIEventsValidateSelectionQuoteInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'event-simulator',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.validateSelectionQuote.execute(input),
          );

          if (result.ok && !Dto.isIEventsValidateSelectionQuoteOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetEventResult': {
          if (!Dto.isIEventsGetEventResultInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'event-simulator',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getEventResult.execute(input),
          );

          if (result.ok && !Dto.isIEventsGetEventResultOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'AdvanceMatchPhase': {
          if (!Dto.isIEventsAdvanceMatchPhaseInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'event-simulator',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.advanceMatchPhase.execute(input),
          );

          if (result.ok && !Dto.isIEventsAdvanceMatchPhaseOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'CompleteEvent': {
          if (!Dto.isIEventsCompleteEventInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'event-simulator',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.completeEvent.execute(input),
          );

          if (result.ok && !Dto.isIEventsCompleteEventOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        default: throw new BoundaryError('INVALID_INPUT', correlationId);
      }
    } catch (error) {
      const code = error instanceof BoundaryError || error instanceof AdmissionError
        ? error.code
        : dispatched ? 'ADAPTER_CONTRACT_VIOLATION' : 'INVALID_INPUT';

      return {
        ok: false,
        error: {
          code: codeValue(code),
          message: code,
          correlationId,
          retryable: error instanceof AdmissionError,
          outcomeUnknown: !(error instanceof AdmissionError) && dispatched
            && ['AdvanceMatchPhase', 'CompleteEvent'].includes(operation),
        },
      };
    }
  }

  grpcHeaders(metadata: Metadata, context: unknown): ITransportHeaders {
    const claimed = objectValue(context);

    return {
      traceparent: metadata.get('traceparent')[0],
      tracestate: metadata.get('tracestate')[0],
      authorization: metadata.get('authorization')[0],
      correlationId: metadata.get('x-correlation-id')[0] ?? claimed.correlationId,
      deadlineAt: metadata.get('x-deadline-at')[0] ?? claimed.deadlineAt,
    };
  }

  validateDelegation(context: unknown, headers: ITransportHeaders): void {
    const claimed = objectValue(context);
    const trusted = this.context(headers);

    for (const key of ['operatorId', 'actorId', 'actorKind', 'playerId']) {
      if (key in claimed && claimed[key] !== objectValue(trusted)[key]) {
        if (key === 'actorKind' && typeof claimed[key] === 'string'
          && claimed[key].endsWith('_' + trusted.actorKind)) {
          continue;
        }
        throw new BoundaryError('PERMISSION_DENIED', trusted.correlationId);
      }
    }

    if (Array.isArray(claimed.capabilities)) {
      const values = decodeShape(
        claimed.capabilities,
        { kind: ShapeKind.ARRAY, items: { kind: ShapeKind.ENUM, values: Object.values(Capability) } },
        true,
      );

      if (Array.isArray(values)
        && values.some(value => !trusted.capabilities.some(capability => capability === value))) {
        throw new BoundaryError('PERMISSION_DENIED', trusted.correlationId);
      }
    }
  }
}

import { ErrorCode } from '../../../domain/events.model.js';

function codeValue(code: string): ErrorCode {
  return Object.values(ErrorCode).find(value => value === code) ?? ErrorCode.INVALID_INPUT;
}

export function transportError(code: string): IResult<RegisteredOutput> {
  return {
    ok: false,
    error: {
      code: codeValue(code),
      message: code,
      correlationId: '00000000-0000-4000-8000-000000000001',
      retryable: false,
      outcomeUnknown: false,
    },
  };
}
