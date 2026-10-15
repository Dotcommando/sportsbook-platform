import type { IShape } from '@sportsbook/service-transport';
import { decodeGraphqlShape, decodeShape, matchesShape, ShapeKind, StringFormat } from '@sportsbook/service-transport';

import type * as M from '../../../../../domain/gateway.model.js';

const shapes: Record<string, IShape> = {
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
            'REGISTER_PLAYER',
            'PROFILE_READ',
            'PROFILE_WRITE',
            'EVALUATE_ELIGIBILITY',
            'READ_WALLET',
            'READ_JOURNAL',
            'FUND_SYNTHETIC',
            'WITHDRAW',
            'PLACE_BET',
            'BET_READ',
            'CANCEL_BET',
            'EVENT_READ',
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
  'UUID': {
    'kind': ShapeKind.STRING,
    'format': StringFormat.UUID,
  },
  'Instant': {
    'kind': ShapeKind.STRING,
    'format': StringFormat.INSTANT,
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
  'OpaqueCursor': {
    'kind': ShapeKind.STRING,
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
  'ExactDecimal': {
    'kind': ShapeKind.STRING,
  },
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
      'fields': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.OBJECT,
          'fields': {
            'path': {
              'kind': ShapeKind.STRING,
            },
            'code': {
              'kind': ShapeKind.STRING,
            },
          },
        },
        'optional': true,
      },
      'retryable': {
        'kind': ShapeKind.BOOLEAN,
      },
      'outcomeUnknown': {
        'kind': ShapeKind.BOOLEAN,
      },
      'retryAfterMs': {
        'kind': ShapeKind.NUMBER,
        'optional': true,
      },
    },
  },
};

export function decodeInput(name: string, value: unknown, protobuf = false, graphql = false): unknown {
  const schema = shapes[name];

  if (!schema) {
    throw new Error('Unregistered shape');
  }

  return graphql ? decodeGraphqlShape(value, schema, shapes) : decodeShape(value, schema, protobuf, shapes);
}

export function isIEventsListEventsInput(v: unknown): v is M.IEventsListEventsInput {
  const schema = shapes['IEventsListEventsInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIEventsListEventsOutput(v: unknown): v is M.IEventsListEventsOutput {
  const schema = shapes['IEventsListEventsOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIEventsGetEventInput(v: unknown): v is M.IEventsGetEventInput {
  const schema = shapes['IEventsGetEventInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIEventsGetEventOutput(v: unknown): v is M.IEventsGetEventOutput {
  const schema = shapes['IEventsGetEventOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIEventsGetMarketsInput(v: unknown): v is M.IEventsGetMarketsInput {
  const schema = shapes['IEventsGetMarketsInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIEventsGetMarketsOutput(v: unknown): v is M.IEventsGetMarketsOutput {
  const schema = shapes['IEventsGetMarketsOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIError(v: unknown): v is M.IError {
  const schema = shapes['IError'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}
