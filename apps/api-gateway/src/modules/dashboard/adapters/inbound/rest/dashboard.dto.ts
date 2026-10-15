import type { IShape } from '@sportsbook/service-transport';
import { decodeShape, matchesShape, ShapeKind, StringFormat } from '@sportsbook/service-transport';

import type * as M from '../../../../../domain/gateway.model.js';

const shapes: Record<string, IShape> = {
  'IGatewayGetMyDashboardInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
      },
      'recentBetLimit': {
        'kind': ShapeKind.NUMBER,
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
  'CurrencyCode': {
    'kind': ShapeKind.STRING,
    'format': StringFormat.CURRENCY,
  },
  'IGatewayGetMyDashboardOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'profile': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IProfile',
      },
      'wallet': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWalletView',
      },
      'recentBets': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IBetView',
        },
      },
      'events': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IEvent',
        },
      },
      'sectionObservedAt': {
        'kind': ShapeKind.OBJECT,
        'fields': {
          'profile': {
            'kind': ShapeKind.REFERENCE,
            'name': 'Instant',
          },
          'wallet': {
            'kind': ShapeKind.REFERENCE,
            'name': 'Instant',
          },
          'bets': {
            'kind': ShapeKind.REFERENCE,
            'name': 'Instant',
          },
          'events': {
            'kind': ShapeKind.REFERENCE,
            'name': 'Instant',
          },
        },
      },
    },
  },
  'IProfile': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'status': {
        'kind': ShapeKind.ENUM,
        'values': [
          'REGISTERED',
          'ACTIVE',
          'SUSPENDED',
          'CLOSED',
        ],
      },
      'firstName': {
        'kind': ShapeKind.STRING,
        'optional': true,
      },
      'lastName': {
        'kind': ShapeKind.STRING,
        'optional': true,
      },
      'birthDate': {
        'kind': ShapeKind.REFERENCE,
        'name': 'LocalDate',
        'optional': true,
      },
      'residenceCountry': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CountryCode',
        'optional': true,
      },
      'nationalityCountry': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CountryCode',
        'optional': true,
      },
      'locale': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Locale',
      },
      'timeZone': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IanaZone',
      },
      'version': {
        'kind': ShapeKind.BIGINT,
      },
      'createdAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'updatedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'LocalDate': {
    'kind': ShapeKind.STRING,
  },
  'CountryCode': {
    'kind': ShapeKind.STRING,
  },
  'Locale': {
    'kind': ShapeKind.STRING,
  },
  'IanaZone': {
    'kind': ShapeKind.STRING,
  },
  'IWalletView': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'walletId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
      },
      'status': {
        'kind': ShapeKind.ENUM,
        'values': [
          'ACTIVE',
          'CLOSED',
        ],
      },
      'availableMinor': {
        'kind': ShapeKind.BIGINT,
      },
      'reservedMinor': {
        'kind': ShapeKind.BIGINT,
      },
      'withdrawalHoldMinor': {
        'kind': ShapeKind.BIGINT,
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

export function decodeInput(name: string, value: unknown, protobuf = false): unknown {
  const schema = shapes[name];

  if (!schema) {
    throw new Error('Unregistered shape');
  }

  return decodeShape(value, schema, protobuf, shapes);
}

export function isIGatewayGetMyDashboardInput(v: unknown): v is M.IGatewayGetMyDashboardInput {
  const schema = shapes['IGatewayGetMyDashboardInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayGetMyDashboardOutput(v: unknown): v is M.IGatewayGetMyDashboardOutput {
  const schema = shapes['IGatewayGetMyDashboardOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIError(v: unknown): v is M.IError {
  const schema = shapes['IError'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}
