import type { IShape } from '@sportsbook/service-transport';
import { decodeShape, matchesShape, ShapeKind, StringFormat } from '@sportsbook/service-transport';

import type { IPlayerAddContactInput, IPlayerAddContactOutput, IPlayerApplyRestrictionInput, IPlayerApplyRestrictionOutput, IPlayerChangePlayerStatusInput, IPlayerChangePlayerStatusOutput, IPlayerCheckEligibilityInput, IPlayerCheckEligibilityOutput, IPlayerClearRestrictionInput, IPlayerClearRestrictionOutput, IPlayerDecideKycCaseInput, IPlayerDecideKycCaseOutput, IPlayerGetKycStatusInput, IPlayerGetKycStatusOutput, IPlayerGetPlayerInput, IPlayerGetPlayerOutput, IPlayerGetPlayerReferenceInput, IPlayerGetPlayerReferenceOutput, IPlayerGetRestrictionsInput, IPlayerGetRestrictionsOutput, IPlayerOpenKycCaseInput, IPlayerOpenKycCaseOutput, IPlayerRecordKycCheckInput, IPlayerRecordKycCheckOutput, IPlayerRegisterPlayerInput, IPlayerRegisterPlayerOutput, IPlayerUpdatePlayerProfileInput, IPlayerUpdatePlayerProfileOutput, IPlayerVerifyContactInput, IPlayerVerifyContactOutput } from '../../../domain/player.model.js';

const shapes:Record<string, IShape> = {
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
            'REGISTER_PLAYER',
            'PROFILE_READ',
            'PROFILE_WRITE',
            'CONTACT_WRITE',
            'CONTACT_VERIFY',
            'MANAGE_PLAYER',
            'MANAGE_KYC',
            'DECIDE_KYC',
            'KYC_STATUS',
            'MANAGE_RESTRICTIONS',
            'RESTRICTION_READ',
            'EVALUATE_ELIGIBILITY',
            'SYNTHETIC_KYC',
            'READ_PLAYER_REFERENCE',
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
  'IKycCase': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'caseId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'requiredLevel': {
        'kind': ShapeKind.ENUM,
        'values': [
          'BASIC',
          'ENHANCED',
        ],
      },
      'status': {
        'kind': ShapeKind.ENUM,
        'values': [
          'OPEN',
          'IN_REVIEW',
          'APPROVED',
          'REJECTED',
          'EXPIRED',
        ],
      },
      'policyVersion': {
        'kind': ShapeKind.STRING,
      },
      'decisionCode': {
        'kind': ShapeKind.STRING,
        'optional': true,
      },
      'validUntil': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
      'version': {
        'kind': ShapeKind.BIGINT,
      },
    },
  },
  'IKycCheck': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'checkId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'caseId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'checkType': {
        'kind': ShapeKind.ENUM,
        'values': [
          'IDENTITY',
          'AGE',
          'RESIDENCE',
        ],
      },
      'attemptNo': {
        'kind': ShapeKind.NUMBER,
      },
      'provider': {
        'kind': ShapeKind.ENUM,
        'values': [
          'SYNTHETIC',
        ],
      },
      'providerCheckRef': {
        'kind': ShapeKind.STRING,
      },
      'status': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PASSED',
          'FAILED',
        ],
      },
      'resultCode': {
        'kind': ShapeKind.STRING,
      },
      'completedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IRestriction': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'restrictionId': {
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
          'BETTING_BLOCK',
          'DEPOSIT_BLOCK',
          'WITHDRAWAL_REVIEW',
        ],
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'ACTIVE',
          'CLEARED',
          'EXPIRED',
        ],
      },
      'reasonCode': {
        'kind': ShapeKind.STRING,
      },
      'startsAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'endsAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
      'clearedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
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
  'IPlayerRegisterPlayerInput': {
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
  'IPlayerRegisterPlayerOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'profile': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IProfile',
      },
      'created': {
        'kind': ShapeKind.BOOLEAN,
      },
    },
  },
  'IPlayerGetPlayerInput': {
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
    },
  },
  'IPlayerGetPlayerOutput': {
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
  'IPlayerUpdatePlayerProfileInput': {
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
      'expectedVersion': {
        'kind': ShapeKind.BIGINT,
      },
      'patch': {
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
    },
  },
  'IPlayerUpdatePlayerProfileOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'profile': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IProfile',
      },
    },
  },
  'IPlayerAddContactInput': {
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
      'kind': {
        'kind': ShapeKind.ENUM,
        'values': [
          'EMAIL',
          'PHONE',
        ],
      },
      'value': {
        'kind': ShapeKind.STRING,
      },
      'isPrimary': {
        'kind': ShapeKind.BOOLEAN,
      },
    },
  },
  'IPlayerAddContactOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'contact': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IContact',
      },
    },
  },
  'IPlayerVerifyContactInput': {
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
      'contactId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'proofRef': {
        'kind': ShapeKind.STRING,
      },
    },
  },
  'IPlayerVerifyContactOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'contact': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IContact',
      },
    },
  },
  'IPlayerChangePlayerStatusInput': {
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
      'expectedVersion': {
        'kind': ShapeKind.BIGINT,
      },
      'status': {
        'kind': ShapeKind.ENUM,
        'values': [
          'ACTIVE',
          'SUSPENDED',
          'CLOSED',
        ],
      },
      'reasonCode': {
        'kind': ShapeKind.STRING,
      },
    },
  },
  'IPlayerChangePlayerStatusOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'profile': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IProfile',
      },
    },
  },
  'IPlayerOpenKycCaseInput': {
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
      'requiredLevel': {
        'kind': ShapeKind.ENUM,
        'values': [
          'BASIC',
          'ENHANCED',
        ],
      },
    },
  },
  'IPlayerOpenKycCaseOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'kycCase': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IKycCase',
      },
    },
  },
  'IPlayerRecordKycCheckInput': {
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
      'caseId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'check': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IKycCheck',
      },
    },
  },
  'IPlayerRecordKycCheckOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'check': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IKycCheck',
      },
      'kycCase': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IKycCase',
      },
    },
  },
  'IPlayerDecideKycCaseInput': {
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
      'caseId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'expectedVersion': {
        'kind': ShapeKind.BIGINT,
      },
      'decision': {
        'kind': ShapeKind.ENUM,
        'values': [
          'APPROVED',
          'REJECTED',
        ],
      },
      'decisionCode': {
        'kind': ShapeKind.STRING,
      },
      'validUntil': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
    },
  },
  'IPlayerDecideKycCaseOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'kycCase': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IKycCase',
      },
    },
  },
  'IPlayerGetKycStatusInput': {
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
    },
  },
  'IPlayerGetKycStatusOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'cases': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IKycCase',
        },
      },
      'evaluatedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IPlayerApplyRestrictionInput': {
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
      'type': {
        'kind': ShapeKind.ENUM,
        'values': [
          'BETTING_BLOCK',
          'DEPOSIT_BLOCK',
          'WITHDRAWAL_REVIEW',
        ],
      },
      'reasonCode': {
        'kind': ShapeKind.STRING,
      },
      'startsAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'endsAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
    },
  },
  'IPlayerApplyRestrictionOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'restriction': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IRestriction',
      },
    },
  },
  'IPlayerClearRestrictionInput': {
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
      'restrictionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'reasonCode': {
        'kind': ShapeKind.STRING,
      },
    },
  },
  'IPlayerClearRestrictionOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'restriction': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IRestriction',
      },
    },
  },
  'IPlayerGetRestrictionsInput': {
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
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'ACTIVE',
          'CLEARED',
          'EXPIRED',
        ],
        'optional': true,
      },
    },
  },
  'IPlayerGetRestrictionsOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'restrictions': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IRestriction',
        },
      },
      'nextCursor': {
        'kind': ShapeKind.REFERENCE,
        'name': 'OpaqueCursor',
        'optional': true,
      },
      'evaluatedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IPlayerCheckEligibilityInput': {
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
  'IPlayerCheckEligibilityOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'eligibility': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEligibility',
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
  'IOperatorEligibilityPolicy': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'policyVersion': {
        'kind': ShapeKind.STRING,
      },
      'capability': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PLACE_BET',
          'DEPOSIT',
          'WITHDRAW',
        ],
      },
      'requiredLevel': {
        'kind': ShapeKind.ENUM,
        'values': [
          'BASIC',
          'ENHANCED',
        ],
      },
      'requiredChecks': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.ENUM,
          'values': [
            'IDENTITY',
            'AGE',
            'RESIDENCE',
          ],
        },
      },
      'minimumAge': {
        'kind': ShapeKind.NUMBER,
        'optional': true,
      },
      'maxValidityDays': {
        'kind': ShapeKind.NUMBER,
      },
      'blockingRestrictions': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.ENUM,
          'values': [
            'BETTING_BLOCK',
            'DEPOSIT_BLOCK',
            'WITHDRAWAL_REVIEW',
          ],
        },
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
  'IPlayerPublishOutboxBatchInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'input': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWorkerBatchInput',
      },
    },
  },
  'IPlayerPublishOutboxBatchOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'report': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBatchReport',
      },
    },
  },
  'IPlayerRunSyntheticKycCheckInput': {
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
      'caseId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'checkType': {
        'kind': ShapeKind.ENUM,
        'values': [
          'IDENTITY',
          'AGE',
          'RESIDENCE',
        ],
      },
      'attemptNo': {
        'kind': ShapeKind.NUMBER,
      },
    },
  },
  'IPlayerRunSyntheticKycCheckOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'check': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IKycCheck',
      },
      'kycCase': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IKycCase',
      },
    },
  },
  'IPlayerGetPlayerReferenceInput': {
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
    },
  },
  'IPlayerGetPlayerReferenceOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'operatorId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'exists': {
        'kind': ShapeKind.BOOLEAN,
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
          'PLAYER',
        ],
      },
      'eventType': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PLAYER_REGISTERED',
          'PLAYER_PROFILE_CHANGED',
          'PLAYER_ELIGIBILITY_CHANGED',
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
        'kind': ShapeKind.OBJECT,
        'fields': {
          'playerId': {
            'kind': ShapeKind.REFERENCE,
            'name': 'UUID',
          },
          'registeredAt': {
            'kind': ShapeKind.REFERENCE,
            'name': 'Instant',
            'optional': true,
          },
          'version': {
            'kind': ShapeKind.BIGINT,
            'optional': true,
          },
        },
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
  'IPlayerOperatorSettings': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'operatorId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'businessTimeZone': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IanaZone',
      },
      'countries': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'CountryCode',
        },
      },
      'reasonCodes': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.STRING,
        },
      },
      'policies': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IOperatorEligibilityPolicy',
        },
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
                  'REGISTER_PLAYER',
                  'PROFILE_READ',
                  'PROFILE_WRITE',
                  'CONTACT_WRITE',
                  'CONTACT_VERIFY',
                  'MANAGE_PLAYER',
                  'MANAGE_KYC',
                  'DECIDE_KYC',
                  'KYC_STATUS',
                  'MANAGE_RESTRICTIONS',
                  'RESTRICTION_READ',
                  'EVALUATE_ELIGIBILITY',
                  'SYNTHETIC_KYC',
                  'READ_PLAYER_REFERENCE',
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
  'Sha256': {
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
        'name': 'IPlayerRegisterPlayerInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerGetPlayerInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerUpdatePlayerProfileInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerAddContactInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerVerifyContactInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerChangePlayerStatusInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerOpenKycCaseInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerRecordKycCheckInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerDecideKycCaseInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerGetKycStatusInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerApplyRestrictionInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerClearRestrictionInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerGetRestrictionsInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerCheckEligibilityInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerPublishOutboxBatchInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerRunSyntheticKycCheckInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerGetPlayerReferenceInput',
      },
    ],
  },
  'RegisteredOutput': {
    'kind': ShapeKind.UNION,
    'members': [
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerRegisterPlayerOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerGetPlayerOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerUpdatePlayerProfileOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerAddContactOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerVerifyContactOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerChangePlayerStatusOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerOpenKycCaseOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerRecordKycCheckOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerDecideKycCaseOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerGetKycStatusOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerApplyRestrictionOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerClearRestrictionOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerGetRestrictionsOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerCheckEligibilityOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerPublishOutboxBatchOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerRunSyntheticKycCheckOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPlayerGetPlayerReferenceOutput',
      },
    ],
  },
};

export function decodeInput(name:string, value:unknown, protobuf:boolean):unknown {const schema = shapes[name];

if (!schema) throw new Error('Unregistered input');

return decodeShape(value, schema, protobuf, shapes);}

export function isIPlayerRegisterPlayerInput(value:unknown):value is IPlayerRegisterPlayerInput {const schema = shapes['IPlayerRegisterPlayerInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerRegisterPlayerOutput(value:unknown):value is IPlayerRegisterPlayerOutput {const schema = shapes['IPlayerRegisterPlayerOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerGetPlayerInput(value:unknown):value is IPlayerGetPlayerInput {const schema = shapes['IPlayerGetPlayerInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerGetPlayerOutput(value:unknown):value is IPlayerGetPlayerOutput {const schema = shapes['IPlayerGetPlayerOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerUpdatePlayerProfileInput(value:unknown):value is IPlayerUpdatePlayerProfileInput {const schema = shapes['IPlayerUpdatePlayerProfileInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerUpdatePlayerProfileOutput(value:unknown):value is IPlayerUpdatePlayerProfileOutput {const schema = shapes['IPlayerUpdatePlayerProfileOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerAddContactInput(value:unknown):value is IPlayerAddContactInput {const schema = shapes['IPlayerAddContactInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerAddContactOutput(value:unknown):value is IPlayerAddContactOutput {const schema = shapes['IPlayerAddContactOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerVerifyContactInput(value:unknown):value is IPlayerVerifyContactInput {const schema = shapes['IPlayerVerifyContactInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerVerifyContactOutput(value:unknown):value is IPlayerVerifyContactOutput {const schema = shapes['IPlayerVerifyContactOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerChangePlayerStatusInput(value:unknown):value is IPlayerChangePlayerStatusInput {const schema = shapes['IPlayerChangePlayerStatusInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerChangePlayerStatusOutput(value:unknown):value is IPlayerChangePlayerStatusOutput {const schema = shapes['IPlayerChangePlayerStatusOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerOpenKycCaseInput(value:unknown):value is IPlayerOpenKycCaseInput {const schema = shapes['IPlayerOpenKycCaseInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerOpenKycCaseOutput(value:unknown):value is IPlayerOpenKycCaseOutput {const schema = shapes['IPlayerOpenKycCaseOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerRecordKycCheckInput(value:unknown):value is IPlayerRecordKycCheckInput {const schema = shapes['IPlayerRecordKycCheckInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerRecordKycCheckOutput(value:unknown):value is IPlayerRecordKycCheckOutput {const schema = shapes['IPlayerRecordKycCheckOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerDecideKycCaseInput(value:unknown):value is IPlayerDecideKycCaseInput {const schema = shapes['IPlayerDecideKycCaseInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerDecideKycCaseOutput(value:unknown):value is IPlayerDecideKycCaseOutput {const schema = shapes['IPlayerDecideKycCaseOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerGetKycStatusInput(value:unknown):value is IPlayerGetKycStatusInput {const schema = shapes['IPlayerGetKycStatusInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerGetKycStatusOutput(value:unknown):value is IPlayerGetKycStatusOutput {const schema = shapes['IPlayerGetKycStatusOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerApplyRestrictionInput(value:unknown):value is IPlayerApplyRestrictionInput {const schema = shapes['IPlayerApplyRestrictionInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerApplyRestrictionOutput(value:unknown):value is IPlayerApplyRestrictionOutput {const schema = shapes['IPlayerApplyRestrictionOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerClearRestrictionInput(value:unknown):value is IPlayerClearRestrictionInput {const schema = shapes['IPlayerClearRestrictionInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerClearRestrictionOutput(value:unknown):value is IPlayerClearRestrictionOutput {const schema = shapes['IPlayerClearRestrictionOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerGetRestrictionsInput(value:unknown):value is IPlayerGetRestrictionsInput {const schema = shapes['IPlayerGetRestrictionsInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerGetRestrictionsOutput(value:unknown):value is IPlayerGetRestrictionsOutput {const schema = shapes['IPlayerGetRestrictionsOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerCheckEligibilityInput(value:unknown):value is IPlayerCheckEligibilityInput {const schema = shapes['IPlayerCheckEligibilityInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerCheckEligibilityOutput(value:unknown):value is IPlayerCheckEligibilityOutput {const schema = shapes['IPlayerCheckEligibilityOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerGetPlayerReferenceInput(value:unknown):value is IPlayerGetPlayerReferenceInput {const schema = shapes['IPlayerGetPlayerReferenceInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIPlayerGetPlayerReferenceOutput(value:unknown):value is IPlayerGetPlayerReferenceOutput {const schema = shapes['IPlayerGetPlayerReferenceOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}
