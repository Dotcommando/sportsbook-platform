import type { IShape } from '@sportsbook/service-transport';
import { decodeShape, matchesShape, ShapeKind, StringFormat } from '@sportsbook/service-transport';

import type {
  ILedgerProvisionPlayerWalletInput,
  ILedgerProvisionPlayerWalletOutput,
} from '../../../domain/ledger.model.js';
import type {
  ILedgerCancelBetInput,
  ILedgerCancelBetOutput,
  ILedgerCompleteWithdrawalInput,
  ILedgerCompleteWithdrawalOutput,
  ILedgerCreateWalletInput,
  ILedgerCreateWalletOutput,
  ILedgerDepositTestFundsInput,
  ILedgerDepositTestFundsOutput,
  ILedgerGetBalanceInput,
  ILedgerGetBalanceOutput,
  ILedgerGetBetFinancialStatusInput,
  ILedgerGetBetFinancialStatusOutput,
  ILedgerGetCommandOutcomeInput,
  ILedgerGetCommandOutcomeOutput,
  ILedgerGetLedgerEntriesInput,
  ILedgerGetLedgerEntriesOutput,
  ILedgerGetTransactionInput,
  ILedgerGetTransactionOutput,
  ILedgerGetWalletInput,
  ILedgerGetWalletOutput,
  ILedgerGetWalletTransactionsInput,
  ILedgerGetWalletTransactionsOutput,
  ILedgerGetWithdrawalInput,
  ILedgerGetWithdrawalOutput,
  ILedgerReconcileLedgerInput,
  ILedgerReconcileLedgerOutput,
  ILedgerRejectWithdrawalInput,
  ILedgerRejectWithdrawalOutput,
  ILedgerRequestWithdrawalInput,
  ILedgerRequestWithdrawalOutput,
  ILedgerReserveStakeInput,
  ILedgerReserveStakeOutput,
  ILedgerSettleLossInput,
  ILedgerSettleLossOutput,
  ILedgerSettleWinInput,
  ILedgerSettleWinOutput,
} from '../../../domain/ledger.model.js';

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
            'CREATE_WALLET',
            'READ_WALLET',
            'READ_JOURNAL',
            'FUND_SYNTHETIC',
            'WITHDRAW',
            'PAYMENT_SIMULATOR',
            'RESERVE_STAKE',
            'SETTLE_BET',
            'CANCEL_RESERVATION',
            'RECONCILE_LEDGER',
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
  'ILedgerCreateWalletInput': {
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
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
      },
    },
  },
  'ILedgerCreateWalletOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'wallet': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWalletView',
      },
      'created': {
        'kind': ShapeKind.BOOLEAN,
      },
    },
  },
  'ILedgerGetBalanceInput': {
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
    },
  },
  'ILedgerGetBalanceOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'wallet': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWalletView',
      },
    },
  },
  'ILedgerGetTransactionInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'context': {
        'kind': ShapeKind.REFERENCE,
        'name': 'ICallContext',
      },
      'transactionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
    },
  },
  'ILedgerGetTransactionOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'transaction': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IJournalView',
      },
    },
  },
  'ILedgerGetLedgerEntriesInput': {
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
  'ILedgerGetLedgerEntriesOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'entries': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IEntry',
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
  'ILedgerGetBetFinancialStatusInput': {
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
  'ILedgerGetCommandOutcomeInput': {
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
    },
  },
  'ILedgerGetCommandOutcomeOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'found': {
        'kind': ShapeKind.BOOLEAN,
      },
      'operation': {
        'kind': ShapeKind.STRING,
        'optional': true,
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'IN_PROGRESS',
          'COMPLETED',
          'FAILED_FINAL',
        ],
        'optional': true,
      },
      'result': {
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
    },
  },
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
  'ILedgerDepositTestFundsOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'outcome': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IFinancialOutcome',
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
  'ILedgerCompleteWithdrawalInput': {
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
      'withdrawalId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'providerRef': {
        'kind': ShapeKind.STRING,
      },
    },
  },
  'ILedgerCompleteWithdrawalOutput': {
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
  'ILedgerRejectWithdrawalInput': {
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
      'withdrawalId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'reasonCode': {
        'kind': ShapeKind.STRING,
      },
    },
  },
  'ILedgerRejectWithdrawalOutput': {
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
  'ILedgerReserveStakeInput': {
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
      'walletId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'stake': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IMoney',
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
  'ILedgerSettleWinInput': {
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
      'settlementSeq': {
        'kind': ShapeKind.BIGINT,
      },
      'grossPayout': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IMoney',
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
  'ILedgerSettleLossInput': {
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
      'settlementSeq': {
        'kind': ShapeKind.BIGINT,
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
  'ILedgerCancelBetInput': {
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
      'reasonCode': {
        'kind': ShapeKind.ENUM,
        'values': [
          'VOID',
          'CANCELED',
          'ACCEPTANCE_FAILED',
        ],
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
  'ILedgerReconcileLedgerInput': {
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
      'cutoff': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
      },
      'page': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IPageInput',
      },
    },
  },
  'ILedgerReconcileLedgerOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'report': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IReconciliationReport',
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
  'IAccountState': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'accountId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'walletId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
      },
      'accountKind': {
        'kind': ShapeKind.ENUM,
        'values': [
          'AVAILABLE',
          'RESERVED',
          'WITHDRAWAL_HOLD',
          'CLEARING',
          'REVENUE',
          'EXPENSE',
        ],
      },
      'normalSide': {
        'kind': ShapeKind.ENUM,
        'values': [
          'DEBIT',
          'CREDIT',
        ],
      },
      'balanceMinor': {
        'kind': ShapeKind.BIGINT,
      },
      'version': {
        'kind': ShapeKind.BIGINT,
      },
    },
  },
  'IAccountDelta': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'accountId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
      },
      'deltaMinor': {
        'kind': ShapeKind.BIGINT,
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
  'ILedgerPublishOutboxBatchInput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'input': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IWorkerBatchInput',
      },
    },
  },
  'ILedgerPublishOutboxBatchOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'report': {
        'kind': ShapeKind.REFERENCE,
        'name': 'IBatchReport',
      },
    },
  },
  'ILedgerProvisionPlayerWalletInput': {
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
      'playerId': {
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
    },
  },
  'ILedgerProvisionPlayerWalletOutput': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'wallets': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.REFERENCE,
          'name': 'IWalletView',
        },
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
          'PLAYER',
          'BETTING',
          'LEDGER',
        ],
      },
      'eventType': {
        'kind': ShapeKind.ENUM,
        'values': [
          'PLAYER_REGISTERED',
          'PLAYER_PROFILE_CHANGED',
          'PLAYER_ELIGIBILITY_CHANGED',
          'MATCH_PHASE_CHANGED',
          'EVENT_RESULT',
          'BET_STATE_CHANGED',
          'LEDGER_POSTED',
          'WITHDRAWAL_RESOLVED',
          'WALLET_CREATED',
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
        'kind': ShapeKind.REFERENCE,
        'name': 'IEventPayload',
      },
    },
  },
  'IEventPayload': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'transactionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
      'requestId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
      'businessRef': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
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
        'optional': true,
      },
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
        'optional': true,
      },
      'amountMinor': {
        'kind': ShapeKind.BIGINT,
        'optional': true,
      },
      'walletId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
      'playerId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
      'registeredAt': {
        'kind': ShapeKind.REFERENCE,
        'name': 'Instant',
        'optional': true,
      },
      'withdrawalId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
      },
      'state': {
        'kind': ShapeKind.ENUM,
        'values': [
          'HELD',
          'COMPLETED',
          'REJECTED',
        ],
        'optional': true,
      },
      'resolutionTransactionId': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
        'optional': true,
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
  'ICurrencyPolicy': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'currency': {
        'kind': ShapeKind.REFERENCE,
        'name': 'CurrencyCode',
      },
      'minimumMinor': {
        'kind': ShapeKind.BIGINT,
      },
      'maximumMinor': {
        'kind': ShapeKind.BIGINT,
      },
    },
  },
  'IOperatorFinancialPolicy': {
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
          'name': 'ICurrencyPolicy',
        },
      },
      'providerNames': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.STRING,
        },
      },
      'rejectionReasons': {
        'kind': ShapeKind.ARRAY,
        'items': {
          'kind': ShapeKind.STRING,
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
                  'CREATE_WALLET',
                  'READ_WALLET',
                  'READ_JOURNAL',
                  'FUND_SYNTHETIC',
                  'WITHDRAW',
                  'PAYMENT_SIMULATOR',
                  'RESERVE_STAKE',
                  'SETTLE_BET',
                  'CANCEL_RESERVATION',
                  'RECONCILE_LEDGER',
                  'PUBLISH_EVENTS',
                ],
              },
            },
            'providerName': {
              'kind': ShapeKind.STRING,
              'optional': true,
            },
          },
        },
      },
    },
  },
  'IChartAccountIds': {
    'kind': ShapeKind.OBJECT,
    'fields': {
      'available': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'reserved': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'withdrawalHold': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'clearing': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'revenue': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
      },
      'expense': {
        'kind': ShapeKind.REFERENCE,
        'name': 'UUID',
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
    'kind': ShapeKind.STRING, 'format': StringFormat.CURRENCY,
  },
  'OpaqueCursor': {
    'kind': ShapeKind.STRING,
  },
  'Sha256': {
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
        'name': 'ILedgerCreateWalletInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetBalanceInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetTransactionInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetLedgerEntriesInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetWalletTransactionsInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetBetFinancialStatusInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetWithdrawalInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetCommandOutcomeInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerDepositTestFundsInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerRequestWithdrawalInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerCompleteWithdrawalInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerRejectWithdrawalInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerReserveStakeInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerSettleWinInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerSettleLossInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerCancelBetInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerReconcileLedgerInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetWalletInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerPublishOutboxBatchInput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerProvisionPlayerWalletInput',
      },
    ],
  },
  'RegisteredOutput': {
    'kind': ShapeKind.UNION,
    'members': [
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerCreateWalletOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetBalanceOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetTransactionOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetLedgerEntriesOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetWalletTransactionsOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetBetFinancialStatusOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetWithdrawalOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetCommandOutcomeOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerDepositTestFundsOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerRequestWithdrawalOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerCompleteWithdrawalOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerRejectWithdrawalOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerReserveStakeOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerSettleWinOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerSettleLossOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerCancelBetOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerReconcileLedgerOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerGetWalletOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerPublishOutboxBatchOutput',
      },
      {
        'kind': ShapeKind.REFERENCE,
        'name': 'ILedgerProvisionPlayerWalletOutput',
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

export function isILedgerProvisionPlayerWalletInput(value: unknown): value is ILedgerProvisionPlayerWalletInput {
  const schema = shapes['ILedgerProvisionPlayerWalletInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerProvisionPlayerWalletOutput(value: unknown): value is ILedgerProvisionPlayerWalletOutput {
  const schema = shapes['ILedgerProvisionPlayerWalletOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerCreateWalletInput(value: unknown): value is ILedgerCreateWalletInput {
  const schema = shapes['ILedgerCreateWalletInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerCreateWalletOutput(value: unknown): value is ILedgerCreateWalletOutput {
  const schema = shapes['ILedgerCreateWalletOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetBalanceInput(value: unknown): value is ILedgerGetBalanceInput {
  const schema = shapes['ILedgerGetBalanceInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetBalanceOutput(value: unknown): value is ILedgerGetBalanceOutput {
  const schema = shapes['ILedgerGetBalanceOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetTransactionInput(value: unknown): value is ILedgerGetTransactionInput {
  const schema = shapes['ILedgerGetTransactionInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetTransactionOutput(value: unknown): value is ILedgerGetTransactionOutput {
  const schema = shapes['ILedgerGetTransactionOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetLedgerEntriesInput(value: unknown): value is ILedgerGetLedgerEntriesInput {
  const schema = shapes['ILedgerGetLedgerEntriesInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetLedgerEntriesOutput(value: unknown): value is ILedgerGetLedgerEntriesOutput {
  const schema = shapes['ILedgerGetLedgerEntriesOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetWalletTransactionsInput(value: unknown): value is ILedgerGetWalletTransactionsInput {
  const schema = shapes['ILedgerGetWalletTransactionsInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetWalletTransactionsOutput(value: unknown): value is ILedgerGetWalletTransactionsOutput {
  const schema = shapes['ILedgerGetWalletTransactionsOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetBetFinancialStatusInput(value: unknown): value is ILedgerGetBetFinancialStatusInput {
  const schema = shapes['ILedgerGetBetFinancialStatusInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetBetFinancialStatusOutput(value: unknown): value is ILedgerGetBetFinancialStatusOutput {
  const schema = shapes['ILedgerGetBetFinancialStatusOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetWithdrawalInput(value: unknown): value is ILedgerGetWithdrawalInput {
  const schema = shapes['ILedgerGetWithdrawalInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetWithdrawalOutput(value: unknown): value is ILedgerGetWithdrawalOutput {
  const schema = shapes['ILedgerGetWithdrawalOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetCommandOutcomeInput(value: unknown): value is ILedgerGetCommandOutcomeInput {
  const schema = shapes['ILedgerGetCommandOutcomeInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetCommandOutcomeOutput(value: unknown): value is ILedgerGetCommandOutcomeOutput {
  const schema = shapes['ILedgerGetCommandOutcomeOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerDepositTestFundsInput(value: unknown): value is ILedgerDepositTestFundsInput {
  const schema = shapes['ILedgerDepositTestFundsInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerDepositTestFundsOutput(value: unknown): value is ILedgerDepositTestFundsOutput {
  const schema = shapes['ILedgerDepositTestFundsOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerRequestWithdrawalInput(value: unknown): value is ILedgerRequestWithdrawalInput {
  const schema = shapes['ILedgerRequestWithdrawalInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerRequestWithdrawalOutput(value: unknown): value is ILedgerRequestWithdrawalOutput {
  const schema = shapes['ILedgerRequestWithdrawalOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerCompleteWithdrawalInput(value: unknown): value is ILedgerCompleteWithdrawalInput {
  const schema = shapes['ILedgerCompleteWithdrawalInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerCompleteWithdrawalOutput(value: unknown): value is ILedgerCompleteWithdrawalOutput {
  const schema = shapes['ILedgerCompleteWithdrawalOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerRejectWithdrawalInput(value: unknown): value is ILedgerRejectWithdrawalInput {
  const schema = shapes['ILedgerRejectWithdrawalInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerRejectWithdrawalOutput(value: unknown): value is ILedgerRejectWithdrawalOutput {
  const schema = shapes['ILedgerRejectWithdrawalOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerReserveStakeInput(value: unknown): value is ILedgerReserveStakeInput {
  const schema = shapes['ILedgerReserveStakeInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerReserveStakeOutput(value: unknown): value is ILedgerReserveStakeOutput {
  const schema = shapes['ILedgerReserveStakeOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerSettleWinInput(value: unknown): value is ILedgerSettleWinInput {
  const schema = shapes['ILedgerSettleWinInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerSettleWinOutput(value: unknown): value is ILedgerSettleWinOutput {
  const schema = shapes['ILedgerSettleWinOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerSettleLossInput(value: unknown): value is ILedgerSettleLossInput {
  const schema = shapes['ILedgerSettleLossInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerSettleLossOutput(value: unknown): value is ILedgerSettleLossOutput {
  const schema = shapes['ILedgerSettleLossOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerCancelBetInput(value: unknown): value is ILedgerCancelBetInput {
  const schema = shapes['ILedgerCancelBetInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerCancelBetOutput(value: unknown): value is ILedgerCancelBetOutput {
  const schema = shapes['ILedgerCancelBetOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerReconcileLedgerInput(value: unknown): value is ILedgerReconcileLedgerInput {
  const schema = shapes['ILedgerReconcileLedgerInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerReconcileLedgerOutput(value: unknown): value is ILedgerReconcileLedgerOutput {
  const schema = shapes['ILedgerReconcileLedgerOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetWalletInput(value: unknown): value is ILedgerGetWalletInput {
  const schema = shapes['ILedgerGetWalletInput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}

export function isILedgerGetWalletOutput(value: unknown): value is ILedgerGetWalletOutput {
  const schema = shapes['ILedgerGetWalletOutput'];

  return schema !== undefined && matchesShape(value, schema, shapes);
}
