import type { IShape } from '@sportsbook/service-transport';
import { decodeGraphqlShape, decodeShape, matchesShape, ShapeKind, StringFormat } from '@sportsbook/service-transport';

import type * as M from '../../../../../domain/gateway.model.js';

const shapes: Record<string, IShape> = {
  'IBettingPlaceBetInput': {
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
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'stake': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IMoney',
      },
      'type': {
        'kind': ShapeKind.ENUM,
        'values': [
          'SINGLE',
        ],
      },
      'selection': {
        'kind': ShapeKind.OBJECT,
        'fields': {
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
  'IMoney': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'amountMinor': {
        'kind': ShapeKind.BIGINT,
      },
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
      },
    },
  },
  'CurrencyCode': {
    'kind': ShapeKind.STRING,
    'format': StringFormat.CURRENCY,
  },
  'IBettingPlaceBetOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'bet': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBetView',
      },
      'outcome': {
        'kind': ShapeKind.ENUM,
        'values': [
          'ACCEPTED',
          'REJECTED',
          'PENDING',
        ],
      },
    },
  },
  'IBetView': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'betId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'type': {
        'kind': ShapeKind.ENUM,
        'values': [
          'SINGLE',
        ],
      },
      'status': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PENDING_RESERVATION',
          'ACCEPTED',
          'REJECTED',
          'SETTLEMENT_PENDING',
          'WON',
          'LOST',
          'VOID',
          'CANCELED',
        ],
      },
      'stake': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IMoney',
      },
      'potentialPayoutMinor': {
        'kind': ShapeKind.BIGINT,
      },
      'actualPayoutMinor': {
        'kind': ShapeKind.BIGINT,
        'optional': true,
      },
      'legs': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IBetLeg',
        },
      },
      'createdAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'acceptedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
      'settledAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
      'reasonCode': {
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
        'optional': true,
      },
      'version': {
        'kind': ShapeKind.BIGINT,
      },
    },
  },
  'IBetLeg': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'legId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'legNo': {
        'kind': ShapeKind.NUMBER,
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
      'quote': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IQuote',
        'optional': true,
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PENDING',
          'WON',
          'LOST',
          'VOID',
        ],
      },
      'resultRef': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
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
  'IBettingCancelBetInput': {
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
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'betId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'expectedVersion': {
        'kind': ShapeKind.BIGINT,
      },
    },
  },
  'IBettingCancelBetOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'bet': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBetView',
      },
      'outcome': {
        'kind': ShapeKind.ENUM,
        'values': [
          'CANCELED',
          'PENDING',
        ],
      },
    },
  },
  'IBettingGetBetInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'betId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
    },
  },
  'IBettingGetBetOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'bet': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBetView',
      },
    },
  },
  'IBettingGetBetStatusInput': {
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
      'betId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
    },
  },
  'IBettingGetBetStatusOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'betId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'status': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PENDING_RESERVATION',
          'ACCEPTED',
          'REJECTED',
          'SETTLEMENT_PENDING',
          'WON',
          'LOST',
          'VOID',
          'CANCELED',
        ],
      },
      'financialState': {
        'kind': ShapeKind.ENUM,
        'values': [
          'UNCONFIRMED',
          'RESERVED',
          'SETTLED',
          'REFUNDED',
        ],
      },
      'version': {
        'kind': ShapeKind.BIGINT,
      },
      'observedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IBettingListPlayerBetsInput': {
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
      'page': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPageInput',
      },
      'status': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PENDING_RESERVATION',
          'ACCEPTED',
          'REJECTED',
          'SETTLEMENT_PENDING',
          'WON',
          'LOST',
          'VOID',
          'CANCELED',
        ],
        'optional': true,
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
  'OpaqueCursor': {
    'kind': ShapeKind.STRING,
  },
  'IBettingListPlayerBetsOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'bets': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IBetView',
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

export function isIBettingPlaceBetInput(v: unknown): v is M.IBettingPlaceBetInput {
  const schema = shapes['IBettingPlaceBetInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIBettingPlaceBetOutput(v: unknown): v is M.IBettingPlaceBetOutput {
  const schema = shapes['IBettingPlaceBetOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIBettingCancelBetInput(v: unknown): v is M.IBettingCancelBetInput {
  const schema = shapes['IBettingCancelBetInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIBettingCancelBetOutput(v: unknown): v is M.IBettingCancelBetOutput {
  const schema = shapes['IBettingCancelBetOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIBettingGetBetInput(v: unknown): v is M.IBettingGetBetInput {
  const schema = shapes['IBettingGetBetInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIBettingGetBetOutput(v: unknown): v is M.IBettingGetBetOutput {
  const schema = shapes['IBettingGetBetOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIBettingGetBetStatusInput(v: unknown): v is M.IBettingGetBetStatusInput {
  const schema = shapes['IBettingGetBetStatusInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIBettingGetBetStatusOutput(v: unknown): v is M.IBettingGetBetStatusOutput {
  const schema = shapes['IBettingGetBetStatusOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIBettingListPlayerBetsInput(v: unknown): v is M.IBettingListPlayerBetsInput {
  const schema = shapes['IBettingListPlayerBetsInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIBettingListPlayerBetsOutput(v: unknown): v is M.IBettingListPlayerBetsOutput {
  const schema = shapes['IBettingListPlayerBetsOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIError(v: unknown): v is M.IError {
  const schema = shapes['IError'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}
