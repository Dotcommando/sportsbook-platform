import type { IShape } from '@sportsbook/service-transport';
import { decodeGraphqlShape, decodeShape, matchesShape, ShapeKind, StringFormat } from '@sportsbook/service-transport';

import type * as M from '../../../../../domain/gateway.model.js';

const shapes: Record<string, IShape> = {
  'ILedgerDepositTestFundsInput': {
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
      'walletId': {
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
  'ILedgerDepositTestFundsOutput': {
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
  'ILedgerRequestWithdrawalInput': {
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
      'walletId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'withdrawalId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'amount': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IMoney',
      },
    },
  },
  'ILedgerRequestWithdrawalOutput': {
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
  'ILedgerGetWalletInput': {
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
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
      },
    },
  },
  'ILedgerGetWalletOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'wallet': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWalletView',
      },
    },
  },
  'ILedgerGetWithdrawalInput': {
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
  'ILedgerGetWithdrawalOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'withdrawal': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWithdrawalView',
      },
    },
  },
  'ILedgerGetWalletTransactionsInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'walletId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
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
  'ILedgerGetWalletTransactionsOutput': {
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

export function decodeInput(name: string, value: unknown, protobuf = false, graphql = false): unknown {
  const schema = shapes[name];

  if (!schema) {
    throw new Error('Unregistered shape');
  }

  return graphql ? decodeGraphqlShape(value, schema, shapes) : decodeShape(value, schema, protobuf, shapes);
}

export function isILedgerDepositTestFundsInput(v: unknown): v is M.ILedgerDepositTestFundsInput {
  const schema = shapes['ILedgerDepositTestFundsInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isILedgerDepositTestFundsOutput(v: unknown): v is M.ILedgerDepositTestFundsOutput {
  const schema = shapes['ILedgerDepositTestFundsOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isILedgerRequestWithdrawalInput(v: unknown): v is M.ILedgerRequestWithdrawalInput {
  const schema = shapes['ILedgerRequestWithdrawalInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isILedgerRequestWithdrawalOutput(v: unknown): v is M.ILedgerRequestWithdrawalOutput {
  const schema = shapes['ILedgerRequestWithdrawalOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isILedgerGetWalletInput(v: unknown): v is M.ILedgerGetWalletInput {
  const schema = shapes['ILedgerGetWalletInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isILedgerGetWalletOutput(v: unknown): v is M.ILedgerGetWalletOutput {
  const schema = shapes['ILedgerGetWalletOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isILedgerGetWithdrawalInput(v: unknown): v is M.ILedgerGetWithdrawalInput {
  const schema = shapes['ILedgerGetWithdrawalInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isILedgerGetWithdrawalOutput(v: unknown): v is M.ILedgerGetWithdrawalOutput {
  const schema = shapes['ILedgerGetWithdrawalOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isILedgerGetWalletTransactionsInput(v: unknown): v is M.ILedgerGetWalletTransactionsInput {
  const schema = shapes['ILedgerGetWalletTransactionsInput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isILedgerGetWalletTransactionsOutput(v: unknown): v is M.ILedgerGetWalletTransactionsOutput {
  const schema = shapes['ILedgerGetWalletTransactionsOutput'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}

export function isIError(v: unknown): v is M.IError {
  const schema = shapes['IError'];

  return schema !== undefined && matchesShape(v, schema, shapes);
}
