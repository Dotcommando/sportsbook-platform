import type { IShape } from '@sportsbook/service-transport';
import { decodeShape, matchesShape, ShapeKind, StringFormat } from '@sportsbook/service-transport';

import type {
  IEventsAdvanceMatchPhaseInput,
  IEventsAdvanceMatchPhaseOutput,
  IEventsCompleteEventInput,
  IEventsCompleteEventOutput,
  IEventsGetEventInput,
  IEventsGetEventOutput,
  IEventsGetEventResultInput,
  IEventsGetEventResultOutput,
  IEventsGetMarketsInput,
  IEventsGetMarketsOutput,
  IEventsListEventsInput,
  IEventsListEventsOutput,
  IEventsValidateSelectionQuoteInput,
  IEventsValidateSelectionQuoteOutput,
} from '../../../domain/events.model.js';

const shapes: Record<string, IShape> = {
  'IError': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'code': {
        'kind': ShapeKind.ENUM,
        'values': [
          'INVALID_INPUT',
          'AMOUNT_OUT_OF_RANGE',
          'CURRENCY_MISMATCH',
          'UNAUTHENTICATED',
          'PERMISSION_DENIED',
          'NOT_FOUND',
          'IDEMPOTENCY_CONFLICT',
          'VERSION_CONFLICT',
          'INSUFFICIENT_FUNDS',
          'INELIGIBLE',
          'STALE_QUOTE',
          'MARKET_CLOSED',
          'INVALID_STATE',
          'IN_PROGRESS',
          'OVERLOADED',
          'DEADLINE_EXCEEDED',
          'DEPENDENCY_UNAVAILABLE',
          'ADAPTER_CONTRACT_VIOLATION',
          'INVARIANT_VIOLATION',
        ],
      },
      'message': {
        'kind': ShapeKind.STRING,
      },
      'correlationId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'retryable': {
        'kind': ShapeKind.BOOLEAN,
      },
      'outcomeUnknown': {
        'kind': ShapeKind.BOOLEAN,
      },
    },
  },
  'ICallContext': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'operatorId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'actorId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'actorKind': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PLAYER',
          'SERVICE',
          'SYSTEM',
        ],
      },
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
      'capabilities': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.ENUM,
          'values': [
            'EVENT_READ',
            'QUOTE_VALIDATE',
            'EVENT_RESULT_READ',
            'MATCH_CONTROL',
            'PUBLISH_EVENTS',
          ],
        },
      },
      'correlationId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'deadlineAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IPageInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'limit': {
        'kind': ShapeKind.NUMBER,
      },
      'cursor': {
        'kind': ShapeKind.REFERENCE,
        'name': 'OpaqueCursor',
        'optional': true,
      },
      'from': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
      'to': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
    },
  },
  'IEvent': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'runId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'sport': {
        'kind': ShapeKind.ENUM,
        'values': [
          'FOOTBALL',
        ],
      },
      'homeTeam': {
        'kind': ShapeKind.STRING,
      },
      'awayTeam': {
        'kind': ShapeKind.STRING,
      },
      'startsAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'phase': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PRE_MATCH',
          'LIVE',
          'HALF_TIME',
          'SUSPENDED',
          'FINISHED',
        ],
      },
      'phaseSeq': {
        'kind': ShapeKind.BIGINT,
      },
      'simulatedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'resultRef': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
    },
  },
  'IMarket': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'marketId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'type': {
        'kind': ShapeKind.ENUM,
        'values': [
          'MATCH_RESULT',
        ],
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'OPEN',
          'SUSPENDED',
          'CLOSED',
        ],
      },
      'selections': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IQuote',
        },
      },
    },
  },
  'IQuote': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'quoteId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'quoteVersion': {
        'kind': ShapeKind.BIGINT,
      },
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'marketId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'selectionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'selection': {
        'kind': ShapeKind.ENUM,
        'values': [
          'HOME',
          'DRAW',
          'AWAY',
        ],
      },
      'odds': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ExactDecimal',
      },
      'validUntil': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'OPEN',
          'SUSPENDED',
          'CLOSED',
        ],
      },
    },
  },
  'IEventResult': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'resultId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'runId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'resultSeq': {
        'kind': ShapeKind.BIGINT,
      },
      'homeGoals': {
        'kind': ShapeKind.NUMBER,
      },
      'awayGoals': {
        'kind': ShapeKind.NUMBER,
      },
      'outcome': {
        'kind': ShapeKind.ENUM,
        'values': [
          'HOME',
          'DRAW',
          'AWAY',
          'VOID',
        ],
      },
      'occurredAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IBatchReport': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'selected': {
        'kind': ShapeKind.NUMBER,
      },
      'applied': {
        'kind': ShapeKind.NUMBER,
      },
      'replayed': {
        'kind': ShapeKind.NUMBER,
      },
      'rejected': {
        'kind': ShapeKind.NUMBER,
      },
      'pending': {
        'kind': ShapeKind.NUMBER,
      },
      'failed': {
        'kind': ShapeKind.NUMBER,
      },
      'nextCursor': {
        'kind': ShapeKind.REFERENCE,
        'name': 'OpaqueCursor',
        'optional': true,
      },
    },
  },
  'IEventsListEventsInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'page': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPageInput',
      },
      'phase': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PRE_MATCH',
          'LIVE',
          'HALF_TIME',
          'SUSPENDED',
          'FINISHED',
        ],
        'optional': true,
      },
    },
  },
  'IEventsListEventsOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'events': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IEvent',
        },
      },
      'nextCursor': {
        'kind': ShapeKind.REFERENCE,
        'name': 'OpaqueCursor',
        'optional': true,
      },
      'observedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IEventsGetEventInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
    },
  },
  'IEventsGetEventOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'event': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEvent',
      },
    },
  },
  'IEventsGetMarketsInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
    },
  },
  'IEventsGetMarketsOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'markets': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IMarket',
        },
      },
      'observedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IEventsValidateSelectionQuoteInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'marketId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'selectionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'quoteId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'quoteVersion': {
        'kind': ShapeKind.BIGINT,
      },
    },
  },
  'IEventsValidateSelectionQuoteOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'acceptedQuote': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IQuote',
      },
      'evaluatedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IEventsGetEventResultInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
    },
  },
  'IEventsGetEventResultOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'result': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventResult',
        'optional': true,
      },
      'ready': {
        'kind': ShapeKind.BOOLEAN,
      },
    },
  },
  'IEventsAdvanceMatchPhaseInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'requestId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'expectedPhaseSeq': {
        'kind': ShapeKind.BIGINT,
      },
      'nextPhase': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PRE_MATCH',
          'LIVE',
          'HALF_TIME',
          'SUSPENDED',
          'FINISHED',
        ],
      },
      'simulatedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IEventsAdvanceMatchPhaseOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'event': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEvent',
      },
    },
  },
  'IEventsCompleteEventInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'requestId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'expectedPhaseSeq': {
        'kind': ShapeKind.BIGINT,
      },
      'result': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventResult',
      },
    },
  },
  'IEventsCompleteEventOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'event': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEvent',
      },
      'result': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventResult',
      },
      'delivery': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PENDING',
          'ACKNOWLEDGED',
        ],
      },
    },
  },
  'IWorkerBatchInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'batchId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'limit': {
        'kind': ShapeKind.NUMBER,
      },
      'cutoff': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IEventsPublishOutboxBatchInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'input': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWorkerBatchInput',
      },
    },
  },
  'IEventsPublishOutboxBatchOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'report': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBatchReport',
      },
    },
  },
  'IStableChildId': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'purpose': {
        'kind': ShapeKind.STRING,
      },
      'id': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
    },
  },
  'IStoredCommand': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'requestId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'operation': {
        'kind': ShapeKind.STRING,
      },
      'payloadHash': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Sha256',
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'IN_PROGRESS',
          'COMPLETED',
          'FAILED_FINAL',
        ],
      },
      'outcome': {
        'kind': ShapeKind.UNION,
        'members': [
          {
            'kind': ShapeKind.OBJECT,
            'fields': {
              'ok': {
                'kind': ShapeKind.BOOLEAN,
                'literal': true,
              },
              'value': {
                'kind': ShapeKind.REFERENCE,
                'name': 'RegisteredOutput',
              },
            },
          },
          {
            'kind': ShapeKind.OBJECT,
            'fields': {
              'ok': {
                'kind': ShapeKind.BOOLEAN,
                'literal': false,
              },
              'error': {
                'kind': ShapeKind.REFERENCE,
                'name': 'IError',
              },
            },
          },
        ],
        'optional': true,
      },
      'actorId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'updatedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'semanticInput': {
        'kind': ShapeKind.REFERENCE,
        'name': 'RegisteredInput',
      },
      'stableChildIds': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IStableChildId',
        },
      },
    },
  },
  'IClaimResult': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'kind': {
        'kind': ShapeKind.ENUM,
        'values': [
          'NEW',
          'REPLAY',
          'IN_PROGRESS',
        ],
      },
      'command': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IStoredCommand',
      },
    },
  },
  'IMatchPhaseChangedEvent': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'runId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'phase': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PRE_MATCH',
          'LIVE',
          'HALF_TIME',
          'SUSPENDED',
          'FINISHED',
        ],
      },
      'phaseSeq': {
        'kind': ShapeKind.BIGINT,
      },
      'simulatedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IEventEnvelope': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'messageId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'source': {
        'kind': ShapeKind.ENUM,
        'values': [
          'EVENTS',
        ],
      },
      'eventType': {
        'kind': ShapeKind.ENUM,
        'values': [
          'MATCH_PHASE_CHANGED',
          'EVENT_RESULT',
        ],
      },
      'schemaVersion': {
        'kind': ShapeKind.NUMBER,
      },
      'operatorId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'correlationId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'occurredAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'payload': {
        'kind': ShapeKind.UNION,
        'members': [
          {
            'kind': ShapeKind.REFERENCE,
            'name': 'IEventResult',
          },
          {
            'kind': ShapeKind.REFERENCE,
            'name': 'IMatchPhaseChangedEvent',
          },
        ],
      },
    },
  },
  'IOutboxLease': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'leaseId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'message': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventEnvelope',
      },
      'attemptNo': {
        'kind': ShapeKind.NUMBER,
      },
      'leaseUntil': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IPublicationReceipt': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'messageId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'acceptedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'durable': {
        'kind': ShapeKind.BOOLEAN,
      },
    },
  },
  'IEventsOperatorSettings': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'operatorId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'trustedActors': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.OBJECT,
          'fields': {
            'actorId': {
              'kind': ShapeKind.REFERENCE,
              'name': 'UUID',
            },
            'actorKind': {
              'kind': ShapeKind.ENUM,
              'values': [
                'PLAYER',
                'SERVICE',
                'SYSTEM',
              ],
            },
            'capabilities': {
              'kind': ShapeKind.ARRAY,
              'items': {
                'kind': ShapeKind.ENUM,
                'values': [
                  'EVENT_READ',
                  'QUOTE_VALIDATE',
                  'EVENT_RESULT_READ',
                  'MATCH_CONTROL',
                  'PUBLISH_EVENTS',
                ],
              },
            },
          },
        },
      },
    },
  },
  'UUID': {
    'kind': ShapeKind.STRING, 'format': StringFormat.UUID,
  },
  'Instant': {
    'kind': ShapeKind.STRING, 'format': StringFormat.INSTANT,
  },
  'Sha256': {
    'kind': ShapeKind.STRING,
  },
  'ExactDecimal': {
    'kind': ShapeKind.STRING,
  },
  'OpaqueCursor': {
    'kind': ShapeKind.STRING,
  },
  'IResult': {
    'kind': ShapeKind.UNION,
    'members': [
      {
        'kind': ShapeKind.OBJECT,
        'fields': {
          'ok': {
            'kind': ShapeKind.BOOLEAN,
            'literal': true,
          },
          'value': {
            'kind': ShapeKind.REFERENCE,
            'name': 'T',
          },
        },
      },
      {
        'kind': ShapeKind.OBJECT,
        'fields': {
          'ok': {
            'kind': ShapeKind.BOOLEAN,
            'literal': false,
          },
          'error': {
            'kind': ShapeKind.REFERENCE,
            'name': 'IError',
          },
        },
      },
    ],
  },
  'RegisteredInput': {
    'kind': ShapeKind.UNION,
    'members': [
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsListEventsInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsGetEventInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsGetMarketsInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsValidateSelectionQuoteInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsGetEventResultInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsAdvanceMatchPhaseInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsCompleteEventInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsPublishOutboxBatchInput',
      },
    ],
  },
  'RegisteredOutput': {
    'kind': ShapeKind.UNION,
    'members': [
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsListEventsOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsGetEventOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsGetMarketsOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsValidateSelectionQuoteOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsGetEventResultOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsAdvanceMatchPhaseOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsCompleteEventOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventsPublishOutboxBatchOutput',
      },
    ],
  },
};

export function decodeInput(name: string, value: unknown, protobuf: boolean): unknown {
  const schema = shapes[name];

  if (!schema) {
    throw new Error('Unregistered input');
  }

  return decodeShape(value, schema, protobuf, shapes);
}

export function isIEventsListEventsInput(value: unknown): value is IEventsListEventsInput {
  const schema = shapes['IEventsListEventsInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsListEventsOutput(value: unknown): value is IEventsListEventsOutput {
  const schema = shapes['IEventsListEventsOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsGetEventInput(value: unknown): value is IEventsGetEventInput {
  const schema = shapes['IEventsGetEventInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsGetEventOutput(value: unknown): value is IEventsGetEventOutput {
  const schema = shapes['IEventsGetEventOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsGetMarketsInput(value: unknown): value is IEventsGetMarketsInput {
  const schema = shapes['IEventsGetMarketsInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsGetMarketsOutput(value: unknown): value is IEventsGetMarketsOutput {
  const schema = shapes['IEventsGetMarketsOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsValidateSelectionQuoteInput(value: unknown): value is IEventsValidateSelectionQuoteInput {
  const schema = shapes['IEventsValidateSelectionQuoteInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsValidateSelectionQuoteOutput(value: unknown): value is IEventsValidateSelectionQuoteOutput {
  const schema = shapes['IEventsValidateSelectionQuoteOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsGetEventResultInput(value: unknown): value is IEventsGetEventResultInput {
  const schema = shapes['IEventsGetEventResultInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsGetEventResultOutput(value: unknown): value is IEventsGetEventResultOutput {
  const schema = shapes['IEventsGetEventResultOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsAdvanceMatchPhaseInput(value: unknown): value is IEventsAdvanceMatchPhaseInput {
  const schema = shapes['IEventsAdvanceMatchPhaseInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsAdvanceMatchPhaseOutput(value: unknown): value is IEventsAdvanceMatchPhaseOutput {
  const schema = shapes['IEventsAdvanceMatchPhaseOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsCompleteEventInput(value: unknown): value is IEventsCompleteEventInput {
  const schema = shapes['IEventsCompleteEventInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isIEventsCompleteEventOutput(value: unknown): value is IEventsCompleteEventOutput {
  const schema = shapes['IEventsCompleteEventOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}
