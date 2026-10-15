import type { IShape } from '@sportsbook/service-transport';
import { decodeShape, matchesShape, ShapeKind, StringFormat } from '@sportsbook/service-transport';

import type * as M from '../../../../../domain/gateway.model.js';

const shapes: Record<string, IShape> = {
  'IGatewayGetMyBalanceInput': {
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
  'IGatewayGetMyBalanceOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'wallet': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWalletView',
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
  'IGatewayTopUpTestWalletInput': {
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
      'amount': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IMoney',
      },
      'providerRef': {
        'kind': ShapeKind.STRING,
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
  'IGatewayTopUpTestWalletOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'outcome': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IFinancialOutcome',
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
  'IGatewayRequestMyWithdrawalInput': {
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
      'amount': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IMoney',
      },
    },
  },
  'IGatewayRequestMyWithdrawalOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'withdrawal': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWithdrawalView',
      },
      'outcome': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IFinancialOutcome',
      },
    },
  },
  'IWithdrawalView': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'withdrawalId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'walletId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'amount': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IMoney',
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'HELD',
          'COMPLETED',
          'REJECTED',
        ],
      },
      'holdTransactionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'resolutionTransactionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
      'providerRef': {
        'kind': ShapeKind.STRING,
        'optional': true,
      },
      'reasonCode': {
        'kind': ShapeKind.STRING,
        'optional': true,
      },
      'createdAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'resolvedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
    },
  },
  'IGatewayGetMyWithdrawalInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'withdrawalId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
    },
  },
  'IGatewayGetMyWithdrawalOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'withdrawal': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWithdrawalView',
      },
    },
  },
  'IGatewayGetMyTransactionsInput': {
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
      'page': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPageInput',
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
  'IGatewayGetMyTransactionsOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'transactions': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IJournalView',
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
  'IJournalView': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'transactionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'requestId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'transactionType': {
        'kind': ShapeKind.ENUM,
        'values': [
          'DEPOSIT',
          'RESERVE_STAKE',
          'SETTLE_WIN',
          'SETTLE_LOSS',
          'CANCEL_RESERVATION',
          'WITHDRAWAL_HOLD',
          'WITHDRAWAL_COMPLETE',
          'WITHDRAWAL_REJECT',
        ],
      },
      'businessRef': {
        'kind': ShapeKind.STRING,
      },
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
      },
      'status': {
        'kind': ShapeKind.ENUM,
        'values': [
          'POSTED',
          'REJECTED',
        ],
      },
      'postedAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
      'entries': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IEntry',
        },
      },
    },
  },
  'IEntry': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'entryId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'accountId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'transactionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'entryNo': {
        'kind': ShapeKind.NUMBER,
      },
      'side': {
        'kind': ShapeKind.ENUM,
        'values': [
          'DEBIT',
          'CREDIT',
        ],
      },
      'amountMinor': {
        'kind': ShapeKind.BIGINT,
      },
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
      },
      'postedAt': {
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

export function decodeInput(name: string, value: unknown, protobuf = false): unknown {
  const schema = shapes[name];

  if (!schema) {
    throw new Error('Unregistered shape');
  }

  return decodeShape(value, schema, protobuf, shapes);
}

export function isIGatewayGetMyBalanceInput(v: unknown): v is M.IGatewayGetMyBalanceInput {
  const schema = shapes['IGatewayGetMyBalanceInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayGetMyBalanceOutput(v: unknown): v is M.IGatewayGetMyBalanceOutput {
  const schema = shapes['IGatewayGetMyBalanceOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayTopUpTestWalletInput(v: unknown): v is M.IGatewayTopUpTestWalletInput {
  const schema = shapes['IGatewayTopUpTestWalletInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayTopUpTestWalletOutput(v: unknown): v is M.IGatewayTopUpTestWalletOutput {
  const schema = shapes['IGatewayTopUpTestWalletOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayRequestMyWithdrawalInput(v: unknown): v is M.IGatewayRequestMyWithdrawalInput {
  const schema = shapes['IGatewayRequestMyWithdrawalInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayRequestMyWithdrawalOutput(v: unknown): v is M.IGatewayRequestMyWithdrawalOutput {
  const schema = shapes['IGatewayRequestMyWithdrawalOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayGetMyWithdrawalInput(v: unknown): v is M.IGatewayGetMyWithdrawalInput {
  const schema = shapes['IGatewayGetMyWithdrawalInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayGetMyWithdrawalOutput(v: unknown): v is M.IGatewayGetMyWithdrawalOutput {
  const schema = shapes['IGatewayGetMyWithdrawalOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayGetMyTransactionsInput(v: unknown): v is M.IGatewayGetMyTransactionsInput {
  const schema = shapes['IGatewayGetMyTransactionsInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIGatewayGetMyTransactionsOutput(v: unknown): v is M.IGatewayGetMyTransactionsOutput {
  const schema = shapes['IGatewayGetMyTransactionsOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIError(v: unknown): v is M.IError {
  const schema = shapes['IError'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}
