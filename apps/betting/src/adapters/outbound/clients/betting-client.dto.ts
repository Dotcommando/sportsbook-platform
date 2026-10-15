import type { IShape } from '@sportsbook/service-transport';
import { decodeShape, matchesShape, ShapeKind, StringFormat } from '@sportsbook/service-transport';

import type { IBettingCancelBetInput, IBettingCancelBetOutput, IBettingGetBetInput, IBettingGetBetOutput, IBettingGetBetStatusInput, IBettingGetBetStatusOutput, IBettingListPlayerBetsInput, IBettingListPlayerBetsOutput, IBettingPlaceBetInput, IBettingPlaceBetOutput, IBettingReconcileBetWithLedgerInput, IBettingReconcileBetWithLedgerOutput, IBettingRecordEventResultInput, IBettingRecordEventResultOutput, IBettingRetryPendingCancellationInput, IBettingRetryPendingCancellationOutput, IBettingRetryPendingReservationInput, IBettingRetryPendingReservationOutput, IBettingRetryPendingSettlementInput, IBettingRetryPendingSettlementOutput, IBettingSettleBetInput, IBettingSettleBetOutput } from '../../../domain/betting.model.js';

const shapes:Record<string, IShape> = {ILedgerGetWalletOutput:{kind:ShapeKind.OBJECT, fields:{wallet:{kind:ShapeKind.REFERENCE, name:'IWalletView'}}},
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
            'PLACE_BET',
            'BET_READ',
            'CANCEL_BET',
            'SETTLE_BET',
            'RECOVER_BETS',
            'RECONCILE_BETS',
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
  'IFinancialOutcome': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'requestId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'COMPLETED',
          'REJECTED',
        ],
      },
      'transactionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
      'businessRef': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'wallet': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWalletView',
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
      'replayed': {
        'kind': ShapeKind.BOOLEAN,
      },
    },
  },
  'IReservationView': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'betId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'walletId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'stake': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IMoney',
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'RESERVED',
          'WON',
          'LOST',
          'CANCELED',
        ],
      },
      'reservationTransactionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'settlementTransactionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
      'settlementSeq': {
        'kind': ShapeKind.BIGINT,
        'optional': true,
      },
      'grossPayoutMinor': {
        'kind': ShapeKind.BIGINT,
        'optional': true,
      },
    },
  },
  'IReconciliationReport': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'runId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'snapshotAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'status': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PASS',
          'FAIL',
        ],
      },
      'counts': {
        'kind': ShapeKind.OBJECT,
        'fields': {
          'transactions': {
            'kind': ShapeKind.BIGINT,
          },
          'entries': {
            'kind': ShapeKind.BIGINT,
          },
          'violations': {
            'kind': ShapeKind.BIGINT,
          },
        },
      },
      'violations': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.OBJECT,
          'fields': {
            'code': {
              'kind': ShapeKind.STRING,
            },
            'businessRef': {
              'kind': ShapeKind.REFERENCE,
              'name': 'UUID',
              'optional': true,
            },
          },
        },
      },
      'nextCursor': {
        'kind': ShapeKind.REFERENCE,
        'name': 'OpaqueCursor',
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
  'ILedgerGetBetFinancialStatusOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'reservation': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IReservationView',
        'optional': true,
      },
      'observedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'ILedgerReserveStakeOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'reservation': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IReservationView',
      },
      'outcome': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IFinancialOutcome',
      },
    },
  },
  'ILedgerSettleWinOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'reservation': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IReservationView',
      },
      'outcome': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IFinancialOutcome',
      },
    },
  },
  'ILedgerSettleLossOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'reservation': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IReservationView',
      },
      'outcome': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IFinancialOutcome',
      },
    },
  },
  'ILedgerCancelBetOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'reservation': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IReservationView',
      },
      'outcome': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IFinancialOutcome',
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
  'IEventsGetEventOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'event': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEvent',
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
  'IBettingRecordEventResultInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'envelope': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventEnvelope',
      },
      'result': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventResult',
      },
    },
  },
  'IBettingRecordEventResultOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'accepted': {
        'kind': ShapeKind.BOOLEAN,
      },
      'duplicate': {
        'kind': ShapeKind.BOOLEAN,
      },
      'sweepId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
    },
  },
  'IBettingSettleBetInput': {
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
      'betId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'resultId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'settlementSeq': {
        'kind': ShapeKind.BIGINT,
      },
    },
  },
  'IBettingSettleBetOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'bet': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBetView',
      },
      'outcome': {
        'kind': ShapeKind.ENUM,
        'values': [
          'SETTLED',
          'PENDING',
        ],
      },
    },
  },
  'IBettingRetryPendingReservationInput': {
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
      'page': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPageInput',
      },
      'pendingBefore': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IBettingRetryPendingReservationOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'report': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBatchReport',
      },
    },
  },
  'IBettingRetryPendingSettlementInput': {
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
      'page': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPageInput',
      },
      'pendingBefore': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IBettingRetryPendingSettlementOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'report': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBatchReport',
      },
    },
  },
  'IBettingReconcileBetWithLedgerInput': {
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
      'runId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'page': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPageInput',
      },
      'cutoff': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IBettingReconcileBetWithLedgerOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'report': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IReconciliationReport',
      },
    },
  },
  'ISettlementIntent': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'intentId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'betId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'resultId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'settlementSeq': {
        'kind': ShapeKind.BIGINT,
      },
      'decision': {
        'kind': ShapeKind.ENUM,
        'values': [
          'WIN',
          'LOSS',
          'VOID',
        ],
      },
      'payout': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IMoney',
      },
      'ledgerCommandId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PENDING',
          'APPLIED',
        ],
      },
      'createdAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
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
  'IBettingPublishOutboxBatchInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'input': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWorkerBatchInput',
      },
    },
  },
  'IBettingPublishOutboxBatchOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'report': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBatchReport',
      },
    },
  },
  'IBettingRetryPendingCancellationInput': {
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
      'page': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPageInput',
      },
      'pendingBefore': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
    },
  },
  'IBettingRetryPendingCancellationOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'report': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBatchReport',
      },
    },
  },
  'IBetSelection': {
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
  'ISettlementSweep': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'sweepId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'eventId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'resultId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'cursor': {
        'kind': ShapeKind.REFERENCE,
        'name': 'OpaqueCursor',
        'optional': true,
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PENDING',
          'COMPLETE',
        ],
      },
      'version': {
        'kind': ShapeKind.BIGINT,
      },
    },
  },
  'IBettingScheduleEventSettlementsInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'sweepId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'page': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPageInput',
      },
    },
  },
  'IBettingScheduleEventSettlementsOutput': {
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
  'IBetStateChangedEvent': {
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
      'version': {
        'kind': ShapeKind.BIGINT,
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
          'BETTING',
        ],
      },
      'eventType': {
        'kind': ShapeKind.ENUM,
        'values': [
          'EVENT_RESULT',
          'BET_STATE_CHANGED',
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
            'name': 'IBetStateChangedEvent',
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
  'IBettingOperatorSettings': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'operatorId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'currencies': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'CurrencyCode',
        },
      },
      'marketPeriod': {
        'kind': ShapeKind.ENUM,
        'values': [
          'NORMAL_TIME',
        ],
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
                  'PLACE_BET',
                  'BET_READ',
                  'CANCEL_BET',
                  'SETTLE_BET',
                  'RECOVER_BETS',
                  'RECONCILE_BETS',
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
  'CurrencyCode': {
    'kind': ShapeKind.STRING,
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
        'name': 'IBettingPlaceBetInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingGetBetInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingListPlayerBetsInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingGetBetStatusInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingCancelBetInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingRecordEventResultInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingSettleBetInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingRetryPendingReservationInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingRetryPendingSettlementInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingReconcileBetWithLedgerInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingPublishOutboxBatchInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingRetryPendingCancellationInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingScheduleEventSettlementsInput',
      },
    ],
  },
  'RegisteredOutput': {
    'kind': ShapeKind.UNION,
    'members': [
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingPlaceBetOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingGetBetOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingListPlayerBetsOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingGetBetStatusOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingCancelBetOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingRecordEventResultOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingSettleBetOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingRetryPendingReservationOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingRetryPendingSettlementOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingReconcileBetWithLedgerOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingPublishOutboxBatchOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingRetryPendingCancellationOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBettingScheduleEventSettlementsOutput',
      },
    ],
  }};

export function decodeInput(name:string, value:unknown, protobuf:boolean):unknown {const schema = shapes[name];

if (!schema) throw new Error('Unregistered input');

return decodeShape(value, schema, protobuf, shapes);}

export function isIBettingPlaceBetInput(value:unknown):value is IBettingPlaceBetInput {const schema = shapes['IBettingPlaceBetInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingPlaceBetOutput(value:unknown):value is IBettingPlaceBetOutput {const schema = shapes['IBettingPlaceBetOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingGetBetInput(value:unknown):value is IBettingGetBetInput {const schema = shapes['IBettingGetBetInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingGetBetOutput(value:unknown):value is IBettingGetBetOutput {const schema = shapes['IBettingGetBetOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingListPlayerBetsInput(value:unknown):value is IBettingListPlayerBetsInput {const schema = shapes['IBettingListPlayerBetsInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingListPlayerBetsOutput(value:unknown):value is IBettingListPlayerBetsOutput {const schema = shapes['IBettingListPlayerBetsOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingGetBetStatusInput(value:unknown):value is IBettingGetBetStatusInput {const schema = shapes['IBettingGetBetStatusInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingGetBetStatusOutput(value:unknown):value is IBettingGetBetStatusOutput {const schema = shapes['IBettingGetBetStatusOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingCancelBetInput(value:unknown):value is IBettingCancelBetInput {const schema = shapes['IBettingCancelBetInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingCancelBetOutput(value:unknown):value is IBettingCancelBetOutput {const schema = shapes['IBettingCancelBetOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingRecordEventResultInput(value:unknown):value is IBettingRecordEventResultInput {const schema = shapes['IBettingRecordEventResultInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingRecordEventResultOutput(value:unknown):value is IBettingRecordEventResultOutput {const schema = shapes['IBettingRecordEventResultOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingSettleBetInput(value:unknown):value is IBettingSettleBetInput {const schema = shapes['IBettingSettleBetInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingSettleBetOutput(value:unknown):value is IBettingSettleBetOutput {const schema = shapes['IBettingSettleBetOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingRetryPendingReservationInput(value:unknown):value is IBettingRetryPendingReservationInput {const schema = shapes['IBettingRetryPendingReservationInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingRetryPendingReservationOutput(value:unknown):value is IBettingRetryPendingReservationOutput {const schema = shapes['IBettingRetryPendingReservationOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingRetryPendingSettlementInput(value:unknown):value is IBettingRetryPendingSettlementInput {const schema = shapes['IBettingRetryPendingSettlementInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingRetryPendingSettlementOutput(value:unknown):value is IBettingRetryPendingSettlementOutput {const schema = shapes['IBettingRetryPendingSettlementOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingReconcileBetWithLedgerInput(value:unknown):value is IBettingReconcileBetWithLedgerInput {const schema = shapes['IBettingReconcileBetWithLedgerInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingReconcileBetWithLedgerOutput(value:unknown):value is IBettingReconcileBetWithLedgerOutput {const schema = shapes['IBettingReconcileBetWithLedgerOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingRetryPendingCancellationInput(value:unknown):value is IBettingRetryPendingCancellationInput {const schema = shapes['IBettingRetryPendingCancellationInput'];

return schema !== undefined && matchesShape(value, schema, shapes);}

export function isIBettingRetryPendingCancellationOutput(value:unknown):value is IBettingRetryPendingCancellationOutput {const schema = shapes['IBettingRetryPendingCancellationOutput'];

return schema !== undefined && matchesShape(value, schema, shapes);}
