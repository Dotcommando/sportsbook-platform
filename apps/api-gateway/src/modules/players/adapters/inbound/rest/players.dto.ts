import type { IShape } from '@sportsbook/service-transport';
import { decodeShape, matchesShape, ShapeKind, StringFormat } from '@sportsbook/service-transport';

import type * as M from '../../../../../domain/gateway.model.js';

const shapes: Record<string, IShape> = {
  'IGatewayRegisterPlayerInput': {
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
      'externalRef': {
        'kind': ShapeKind.STRING,
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
  'Locale': {
    'kind': ShapeKind.STRING,
  },
  'IanaZone': {
    'kind': ShapeKind.STRING,
  },
  'IGatewayRegisterPlayerOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'profile': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IProfile',
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
  'IGatewayGetMyProfileInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
    },
  },
  'IGatewayGetMyProfileOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'profile': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IProfile',
      },
      'contacts': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IContact',
        },
      },
    },
  },
  'IContact': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'contactId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'kind': {
        'kind': ShapeKind.ENUM,
        'values': [
          'EMAIL',
          'PHONE',
        ],
      },
      'displayValue': {
        'kind': ShapeKind.STRING,
      },
      'isPrimary': {
        'kind': ShapeKind.BOOLEAN,
      },
      'verifiedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
    },
  },
  'IGatewayUpdateMyProfileInput': {
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
      'expectedVersion': {
        'kind': ShapeKind.BIGINT,
      },
      'patch': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerProfilePatch',
      },
    },
  },
  'IPlayerProfilePatch': {
    'kind': ShapeKind.OBJECT,
    'fields': {
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
        'optional': true,
      },
      'timeZone': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IanaZone',
        'optional': true,
      },
    },
  },
  'IGatewayUpdateMyProfileOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'profile': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IProfile',
      },
    },
  },
  'IGatewayGetMyEligibilityInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'capability': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PLACE_BET',
          'DEPOSIT',
          'WITHDRAW',
        ],
      },
    },
  },
  'IGatewayGetMyEligibilityOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'eligibility': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEligibility',
      },
    },
  },
  'IEligibility': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'allowed': {
        'kind': ShapeKind.BOOLEAN,
      },
      'reasonCode': {
        'kind': ShapeKind.ENUM,
        'values': [
          'ELIGIBLE',
          'PLAYER_INACTIVE',
          'KYC_REQUIRED',
          'KYC_EXPIRED',
          'CAPABILITY_RESTRICTED',
        ],
      },
      'policyVersion': {
        'kind': ShapeKind.STRING,
      },
      'evaluatedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'validUntil': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
      'playerVersion': {
        'kind': ShapeKind.BIGINT,
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

export function isIGatewayRegisterPlayerInput(v: unknown): v is M.IGatewayRegisterPlayerInput {
  const schema = shapes['IGatewayRegisterPlayerInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayRegisterPlayerOutput(v: unknown): v is M.IGatewayRegisterPlayerOutput {
  const schema = shapes['IGatewayRegisterPlayerOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayGetMyProfileInput(v: unknown): v is M.IGatewayGetMyProfileInput {
  const schema = shapes['IGatewayGetMyProfileInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayGetMyProfileOutput(v: unknown): v is M.IGatewayGetMyProfileOutput {
  const schema = shapes['IGatewayGetMyProfileOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayUpdateMyProfileInput(v: unknown): v is M.IGatewayUpdateMyProfileInput {
  const schema = shapes['IGatewayUpdateMyProfileInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayUpdateMyProfileOutput(v: unknown): v is M.IGatewayUpdateMyProfileOutput {
  const schema = shapes['IGatewayUpdateMyProfileOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayGetMyEligibilityInput(v: unknown): v is M.IGatewayGetMyEligibilityInput {
  const schema = shapes['IGatewayGetMyEligibilityInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayGetMyEligibilityOutput(v: unknown): v is M.IGatewayGetMyEligibilityOutput {
  const schema = shapes['IGatewayGetMyEligibilityOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIError(v: unknown): v is M.IError {
  const schema = shapes['IError'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}
