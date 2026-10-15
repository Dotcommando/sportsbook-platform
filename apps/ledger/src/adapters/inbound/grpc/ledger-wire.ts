import { objectValue } from '@sportsbook/service-transport';

const enums: Record<string, string[]> =
  {
    'BetStateChangedEventFinancialState': [
      'BET_STATE_CHANGED_EVENT_FINANCIAL_STATE_UNCONFIRMED',
      'BET_STATE_CHANGED_EVENT_FINANCIAL_STATE_RESERVED',
      'BET_STATE_CHANGED_EVENT_FINANCIAL_STATE_SETTLED',
      'BET_STATE_CHANGED_EVENT_FINANCIAL_STATE_REFUNDED',
    ],
    'BetStatus': [
      'BET_STATUS_PENDING_RESERVATION',
      'BET_STATUS_ACCEPTED',
      'BET_STATUS_REJECTED',
      'BET_STATUS_SETTLEMENT_PENDING',
      'BET_STATUS_WON',
      'BET_STATUS_LOST',
      'BET_STATUS_VOID',
      'BET_STATUS_CANCELED',
    ],
    'CallContextActorKind': [
      'CALL_CONTEXT_ACTOR_KIND_PLAYER',
      'CALL_CONTEXT_ACTOR_KIND_SERVICE',
      'CALL_CONTEXT_ACTOR_KIND_SYSTEM',
    ],
    'CancelBetRequestReasonCode': [
      'CANCEL_BET_REQUEST_REASON_CODE_VOID',
      'CANCEL_BET_REQUEST_REASON_CODE_CANCELED',
      'CANCEL_BET_REQUEST_REASON_CODE_ACCEPTANCE_FAILED',
    ],
    'Capability': [
      'CAPABILITY_REGISTER_PLAYER',
      'CAPABILITY_PROFILE_READ',
      'CAPABILITY_PROFILE_WRITE',
      'CAPABILITY_CONTACT_WRITE',
      'CAPABILITY_CONTACT_VERIFY',
      'CAPABILITY_MANAGE_PLAYER',
      'CAPABILITY_MANAGE_KYC',
      'CAPABILITY_DECIDE_KYC',
      'CAPABILITY_KYC_STATUS',
      'CAPABILITY_MANAGE_RESTRICTIONS',
      'CAPABILITY_RESTRICTION_READ',
      'CAPABILITY_EVALUATE_ELIGIBILITY',
      'CAPABILITY_EVENT_READ',
      'CAPABILITY_EVENT_RESULT_READ',
      'CAPABILITY_QUOTE_VALIDATE',
      'CAPABILITY_MATCH_CONTROL',
      'CAPABILITY_PLACE_BET',
      'CAPABILITY_BET_READ',
      'CAPABILITY_CANCEL_BET',
      'CAPABILITY_SETTLE_BET',
      'CAPABILITY_RECOVER_BETS',
      'CAPABILITY_RECONCILE_BETS',
      'CAPABILITY_CREATE_WALLET',
      'CAPABILITY_READ_WALLET',
      'CAPABILITY_READ_JOURNAL',
      'CAPABILITY_FUND_SYNTHETIC',
      'CAPABILITY_WITHDRAW',
      'CAPABILITY_PAYMENT_SIMULATOR',
      'CAPABILITY_RESERVE_STAKE',
      'CAPABILITY_CANCEL_RESERVATION',
      'CAPABILITY_RECONCILE_LEDGER',
      'CAPABILITY_PUBLISH_EVENTS',
      'CAPABILITY_SYNTHETIC_KYC',
      'CAPABILITY_READ_PLAYER_REFERENCE',
      'CAPABILITY_DIAGNOSTICS',
    ],
    'EntrySide': ['ENTRY_SIDE_DEBIT', 'ENTRY_SIDE_CREDIT'],
    'ErrorCode': [
      'ERROR_CODE_INVALID_INPUT',
      'ERROR_CODE_AMOUNT_OUT_OF_RANGE',
      'ERROR_CODE_CURRENCY_MISMATCH',
      'ERROR_CODE_UNAUTHENTICATED',
      'ERROR_CODE_PERMISSION_DENIED',
      'ERROR_CODE_NOT_FOUND',
      'ERROR_CODE_IDEMPOTENCY_CONFLICT',
      'ERROR_CODE_VERSION_CONFLICT',
      'ERROR_CODE_INSUFFICIENT_FUNDS',
      'ERROR_CODE_INELIGIBLE',
      'ERROR_CODE_STALE_QUOTE',
      'ERROR_CODE_MARKET_CLOSED',
      'ERROR_CODE_INVALID_STATE',
      'ERROR_CODE_IN_PROGRESS',
      'ERROR_CODE_OVERLOADED',
      'ERROR_CODE_DEADLINE_EXCEEDED',
      'ERROR_CODE_DEPENDENCY_UNAVAILABLE',
      'ERROR_CODE_ADAPTER_CONTRACT_VIOLATION',
      'ERROR_CODE_INVARIANT_VIOLATION',
    ],
    'EventEnvelopeSource': [
      'EVENT_ENVELOPE_SOURCE_EVENTS',
      'EVENT_ENVELOPE_SOURCE_PLAYER',
      'EVENT_ENVELOPE_SOURCE_BETTING',
      'EVENT_ENVELOPE_SOURCE_LEDGER',
    ],
    'EventPhase': [
      'EVENT_PHASE_PRE_MATCH',
      'EVENT_PHASE_LIVE',
      'EVENT_PHASE_HALF_TIME',
      'EVENT_PHASE_SUSPENDED',
      'EVENT_PHASE_FINISHED',
    ],
    'EventResultOutcome': [
      'EVENT_RESULT_OUTCOME_HOME',
      'EVENT_RESULT_OUTCOME_DRAW',
      'EVENT_RESULT_OUTCOME_AWAY',
      'EVENT_RESULT_OUTCOME_VOID',
    ],
    'EventType': [
      'EVENT_TYPE_PLAYER_REGISTERED',
      'EVENT_TYPE_PLAYER_PROFILE_CHANGED',
      'EVENT_TYPE_PLAYER_ELIGIBILITY_CHANGED',
      'EVENT_TYPE_MATCH_PHASE_CHANGED',
      'EVENT_TYPE_EVENT_RESULT',
      'EVENT_TYPE_BET_STATE_CHANGED',
      'EVENT_TYPE_LEDGER_POSTED',
      'EVENT_TYPE_WITHDRAWAL_RESOLVED',
      'EVENT_TYPE_WALLET_CREATED',
    ],
    'FinancialOutcomeState': ['FINANCIAL_OUTCOME_STATE_COMPLETED', 'FINANCIAL_OUTCOME_STATE_REJECTED'],
    'JournalViewStatus': ['JOURNAL_VIEW_STATUS_POSTED', 'JOURNAL_VIEW_STATUS_REJECTED'],
    'LedgerGetCommandOutcomeOutputState': [
      'LEDGER_GET_COMMAND_OUTCOME_OUTPUT_STATE_IN_PROGRESS',
      'LEDGER_GET_COMMAND_OUTCOME_OUTPUT_STATE_COMPLETED',
      'LEDGER_GET_COMMAND_OUTCOME_OUTPUT_STATE_FAILED_FINAL',
    ],
    'PlayerCapability': ['PLAYER_CAPABILITY_PLACE_BET', 'PLAYER_CAPABILITY_DEPOSIT', 'PLAYER_CAPABILITY_WITHDRAW'],
    'ProfileField': [
      'PROFILE_FIELD_FIRST_NAME',
      'PROFILE_FIELD_LAST_NAME',
      'PROFILE_FIELD_BIRTH_DATE',
      'PROFILE_FIELD_RESIDENCE_COUNTRY',
      'PROFILE_FIELD_NATIONALITY_COUNTRY',
      'PROFILE_FIELD_LOCALE',
      'PROFILE_FIELD_TIME_ZONE',
    ],
    'ReconciliationReportStatus': ['RECONCILIATION_REPORT_STATUS_PASS', 'RECONCILIATION_REPORT_STATUS_FAIL'],
    'ReservationViewState': [
      'RESERVATION_VIEW_STATE_RESERVED',
      'RESERVATION_VIEW_STATE_WON',
      'RESERVATION_VIEW_STATE_LOST',
      'RESERVATION_VIEW_STATE_CANCELED',
    ],
    'TransactionType': [
      'TRANSACTION_TYPE_DEPOSIT',
      'TRANSACTION_TYPE_RESERVE_STAKE',
      'TRANSACTION_TYPE_SETTLE_WIN',
      'TRANSACTION_TYPE_SETTLE_LOSS',
      'TRANSACTION_TYPE_CANCEL_RESERVATION',
      'TRANSACTION_TYPE_WITHDRAWAL_HOLD',
      'TRANSACTION_TYPE_WITHDRAWAL_COMPLETE',
      'TRANSACTION_TYPE_WITHDRAWAL_REJECT',
    ],
    'WalletViewStatus': ['WALLET_VIEW_STATUS_ACTIVE', 'WALLET_VIEW_STATUS_CLOSED'],
    'WithdrawalResolvedEventState':
    [
      'WITHDRAWAL_RESOLVED_EVENT_STATE_COMPLETED',
      'WITHDRAWAL_RESOLVED_EVENT_STATE_REJECTED',
    ],
    'WithdrawalViewState': [
      'WITHDRAWAL_VIEW_STATE_HELD',
      'WITHDRAWAL_VIEW_STATE_COMPLETED',
      'WITHDRAWAL_VIEW_STATE_REJECTED',
    ],
  };

const messages: Record<string, Record<string, string>> =
  {
    'EventEnvelope': {
      'messageId': 'string',
      'source': 'EventEnvelopeSource',
      'eventType': 'EventType',
      'schemaVersion': 'int32',
      'operatorId': 'string',
      'correlationId': 'string',
      'occurredAt': 'string',
      'payload': 'EventPayload',
    },
    'EventPayload': {
      'playerRegisteredEvent': 'PlayerRegisteredEvent',
      'playerProfileChangedEvent': 'PlayerProfileChangedEvent',
      'playerEligibilityChangedEvent': 'PlayerEligibilityChangedEvent',
      'matchPhaseChangedEvent': 'MatchPhaseChangedEvent',
      'eventResult': 'EventResult',
      'betStateChangedEvent': 'BetStateChangedEvent',
      'ledgerPostedEvent': 'LedgerPostedEvent',
      'withdrawalResolvedEvent': 'WithdrawalResolvedEvent',
      'walletCreatedEvent': 'WalletCreatedEvent',
    },
    'PlayerRegisteredEvent': { 'playerId': 'string', 'registeredAt': 'string' },
    'PlayerProfileChangedEvent': { 'playerId': 'string', 'version': 'int64', 'changedFields': 'ProfileField' },
    'PlayerEligibilityChangedEvent': {
      'playerId': 'string',
      'capability': 'PlayerCapability',
      'playerVersion': 'int64',
      'policyVersion': 'string',
      'evaluatedAt': 'string',
    },
    'MatchPhaseChangedEvent': {
      'eventId': 'string',
      'runId': 'string',
      'phase': 'EventPhase',
      'phaseSeq': 'int64',
      'simulatedAt': 'string',
    },
    'EventResult': {
      'resultId': 'string',
      'eventId': 'string',
      'runId': 'string',
      'resultSeq': 'int64',
      'homeGoals': 'int32',
      'awayGoals': 'int32',
      'outcome': 'EventResultOutcome',
      'occurredAt': 'string',
    },
    'BetStateChangedEvent': {
      'betId': 'string',
      'playerId': 'string',
      'status': 'BetStatus',
      'version': 'int64',
      'financialState': 'BetStateChangedEventFinancialState',
    },
    'LedgerPostedEvent': {
      'transactionId': 'string',
      'requestId': 'string',
      'businessRef': 'string',
      'transactionType': 'TransactionType',
      'currency': 'string',
      'amountMinor': 'int64',
    },
    'WithdrawalResolvedEvent': {
      'withdrawalId': 'string',
      'walletId': 'string',
      'state': 'WithdrawalResolvedEventState',
      'resolutionTransactionId': 'string',
    },
    'WalletCreatedEvent': { 'walletId': 'string', 'playerId': 'string', 'currency': 'string' },
    'CreateWalletRequest':
  {
    'context':
      'CallContext',
    'requestId':
      'string',
    'playerId':
      'string',
    'currency':
      'string',
  },
    'CallContext': {
      'operatorId': 'string',
      'actorId': 'string',
      'actorKind': 'CallContextActorKind',
      'playerId': 'string',
      'capabilities': 'Capability',
      'correlationId': 'string',
      'deadlineAt': 'string',
    },
    'LedgerCreateWalletOutput': { 'wallet': 'WalletView', 'created': 'bool' },
    'WalletView': {
      'walletId': 'string',
      'playerId': 'string',
      'currency': 'string',
      'status': 'WalletViewStatus',
      'availableMinor': 'int64',
      'reservedMinor': 'int64',
      'withdrawalHoldMinor': 'int64',
      'version': 'int64',
      'observedAt': 'string',
    },
    'Error': {
      'code': 'ErrorCode',
      'message': 'string',
      'correlationId': 'string',
      'fields': 'ErrorFields',
      'retryable': 'bool',
      'outcomeUnknown': 'bool',
      'retryAfterMs': 'int32',
    },
    'ErrorFields': { 'path': 'string', 'code': 'string' },
    'GetBalanceRequest': { 'context': 'CallContext', 'walletId': 'string' },
    'LedgerGetBalanceOutput': { 'wallet': 'WalletView' },
    'GetTransactionRequest': { 'context': 'CallContext', 'transactionId': 'string' },
    'LedgerGetTransactionOutput': { 'transaction': 'JournalView' },
    'JournalView': {
      'transactionId': 'string',
      'requestId': 'string',
      'transactionType': 'TransactionType',
      'businessRef': 'string',
      'currency': 'string',
      'status': 'JournalViewStatus',
      'postedAt': 'string',
      'entries': 'Entry',
    },
    'Entry': {
      'entryId': 'string',
      'accountId': 'string',
      'transactionId': 'string',
      'entryNo': 'int32',
      'side': 'EntrySide',
      'amountMinor': 'int64',
      'currency': 'string',
      'postedAt': 'string',
    },
    'GetLedgerEntriesRequest': { 'context': 'CallContext', 'walletId': 'string', 'page': 'PageInput' },
    'PageInput': { 'limit': 'int32', 'cursor': 'string', 'from': 'string', 'to': 'string' },
    'LedgerGetLedgerEntriesOutput': { 'entries': 'Entry', 'nextCursor': 'string', 'observedAt': 'string' },
    'GetWalletTransactionsRequest': { 'context': 'CallContext', 'walletId': 'string', 'page': 'PageInput' },
    'LedgerGetWalletTransactionsOutput':
  {
    'transactions':
      'JournalView',
    'nextCursor':
      'string',
    'observedAt':
      'string',
  },
    'GetBetFinancialStatusRequest': { 'context': 'CallContext', 'betId': 'string' },
    'LedgerGetBetFinancialStatusOutput': { 'reservation': 'ReservationView', 'observedAt': 'string' },
    'ReservationView': {
      'betId': 'string',
      'walletId': 'string',
      'stake': 'Money',
      'state': 'ReservationViewState',
      'reservationTransactionId': 'string',
      'settlementTransactionId': 'string',
      'settlementSeq': 'int64',
      'grossPayoutMinor': 'int64',
    },
    'Money': { 'amountMinor': 'int64', 'currency': 'string' },
    'GetWithdrawalRequest': { 'context': 'CallContext', 'withdrawalId': 'string' },
    'LedgerGetWithdrawalOutput': { 'withdrawal': 'WithdrawalView' },
    'WithdrawalView': {
      'withdrawalId': 'string',
      'walletId': 'string',
      'amount': 'Money',
      'state': 'WithdrawalViewState',
      'holdTransactionId': 'string',
      'resolutionTransactionId': 'string',
      'providerRef': 'string',
      'reasonCode': 'string',
      'createdAt': 'string',
      'resolvedAt': 'string',
    },
    'GetCommandOutcomeRequest': { 'context': 'CallContext', 'requestId': 'string' },
    'LedgerGetCommandOutcomeOutput': {
      'found': 'bool',
      'operation': 'string',
      'state': 'LedgerGetCommandOutcomeOutputState',
      'result': 'RegisteredOutputResult',
    },
    'RegisteredOutput': {
      'createWallet': 'LedgerCreateWalletOutput',
      'getBalance': 'LedgerGetBalanceOutput',
      'getTransaction': 'LedgerGetTransactionOutput',
      'getLedgerEntries': 'LedgerGetLedgerEntriesOutput',
      'getWalletTransactions': 'LedgerGetWalletTransactionsOutput',
      'getBetFinancialStatus': 'LedgerGetBetFinancialStatusOutput',
      'getWithdrawal': 'LedgerGetWithdrawalOutput',
      'depositTestFunds': 'LedgerDepositTestFundsOutput',
      'requestWithdrawal': 'LedgerRequestWithdrawalOutput',
      'completeWithdrawal': 'LedgerCompleteWithdrawalOutput',
      'rejectWithdrawal': 'LedgerRejectWithdrawalOutput',
      'reserveStake': 'LedgerReserveStakeOutput',
      'settleWin': 'LedgerSettleWinOutput',
      'settleLoss': 'LedgerSettleLossOutput',
      'cancelBet': 'LedgerCancelBetOutput',
      'reconcileLedger': 'LedgerReconcileLedgerOutput',
      'getWallet': 'LedgerGetWalletOutput',
    },
    'LedgerDepositTestFundsOutput': { 'outcome': 'FinancialOutcome' },
    'FinancialOutcome': {
      'requestId': 'string',
      'state': 'FinancialOutcomeState',
      'transactionId': 'string',
      'businessRef': 'string',
      'wallet': 'WalletView',
      'reasonCode': 'ErrorCode',
      'replayed': 'bool',
    },
    'LedgerRequestWithdrawalOutput': { 'withdrawal': 'WithdrawalView', 'outcome': 'FinancialOutcome' },
    'LedgerCompleteWithdrawalOutput': { 'withdrawal': 'WithdrawalView', 'outcome': 'FinancialOutcome' },
    'LedgerRejectWithdrawalOutput': { 'withdrawal': 'WithdrawalView', 'outcome': 'FinancialOutcome' },
    'LedgerReserveStakeOutput': { 'reservation': 'ReservationView', 'outcome': 'FinancialOutcome' },
    'LedgerSettleWinOutput': { 'reservation': 'ReservationView', 'outcome': 'FinancialOutcome' },
    'LedgerSettleLossOutput': { 'reservation': 'ReservationView', 'outcome': 'FinancialOutcome' },
    'LedgerCancelBetOutput': { 'reservation': 'ReservationView', 'outcome': 'FinancialOutcome' },
    'LedgerReconcileLedgerOutput': { 'report': 'ReconciliationReport' },
    'ReconciliationReport': {
      'runId': 'string',
      'snapshotAt': 'string',
      'status': 'ReconciliationReportStatus',
      'counts': 'ReconciliationReportCounts',
      'violations': 'ReconciliationReportViolations',
      'nextCursor': 'string',
    },
    'ReconciliationReportCounts': { 'transactions': 'int64', 'entries': 'int64', 'violations': 'int64' },
    'ReconciliationReportViolations': { 'code': 'string', 'businessRef': 'string' },
    'LedgerGetWalletOutput': { 'wallet': 'WalletView' },
    'DepositTestFundsRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'walletId': 'string',
      'amount': 'Money',
      'providerRef': 'string',
    },
    'RequestWithdrawalRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'walletId': 'string',
      'withdrawalId': 'string',
      'amount': 'Money',
    },
    'CompleteWithdrawalRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'withdrawalId': 'string',
      'providerRef': 'string',
    },
    'RejectWithdrawalRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'withdrawalId': 'string',
      'reasonCode': 'string',
    },
    'ReserveStakeRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'betId': 'string',
      'walletId': 'string',
      'stake': 'Money',
    },
    'SettleWinRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'betId': 'string',
      'settlementSeq': 'int64',
      'grossPayout': 'Money',
    },
    'SettleLossRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'betId': 'string',
      'settlementSeq': 'int64',
    },
    'CancelBetRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'betId': 'string',
      'reasonCode': 'CancelBetRequestReasonCode',
    },
    'ReconcileLedgerRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'runId': 'string',
      'cutoff': 'string',
      'page': 'PageInput',
    },
    'GetWalletRequest': { 'context': 'CallContext', 'playerId': 'string', 'currency': 'string' },
    'CreateWalletResponse': { 'value': 'LedgerCreateWalletOutput', 'error': 'Error' },
    'GetBalanceResponse': { 'value': 'LedgerGetBalanceOutput', 'error': 'Error' },
    'GetTransactionResponse': { 'value': 'LedgerGetTransactionOutput', 'error': 'Error' },
    'GetLedgerEntriesResponse': { 'value': 'LedgerGetLedgerEntriesOutput', 'error': 'Error' },
    'GetWalletTransactionsResponse': { 'value': 'LedgerGetWalletTransactionsOutput', 'error': 'Error' },
    'GetBetFinancialStatusResponse': { 'value': 'LedgerGetBetFinancialStatusOutput', 'error': 'Error' },
    'GetWithdrawalResponse': { 'value': 'LedgerGetWithdrawalOutput', 'error': 'Error' },
    'GetCommandOutcomeResponse': { 'value': 'LedgerGetCommandOutcomeOutput', 'error': 'Error' },
    'RegisteredOutputResult': { 'value': 'RegisteredOutput', 'error': 'Error' },
    'DepositTestFundsResponse': { 'value': 'LedgerDepositTestFundsOutput', 'error': 'Error' },
    'RequestWithdrawalResponse': { 'value': 'LedgerRequestWithdrawalOutput', 'error': 'Error' },
    'CompleteWithdrawalResponse': { 'value': 'LedgerCompleteWithdrawalOutput', 'error': 'Error' },
    'RejectWithdrawalResponse': { 'value': 'LedgerRejectWithdrawalOutput', 'error': 'Error' },
    'ReserveStakeResponse': { 'value': 'LedgerReserveStakeOutput', 'error': 'Error' },
    'SettleWinResponse': { 'value': 'LedgerSettleWinOutput', 'error': 'Error' },
    'SettleLossResponse': { 'value': 'LedgerSettleLossOutput', 'error': 'Error' },
    'CancelBetResponse': { 'value': 'LedgerCancelBetOutput', 'error': 'Error' },
    'ReconcileLedgerResponse': { 'value': 'LedgerReconcileLedgerOutput', 'error': 'Error' },
    'GetWalletResponse': { 'value': 'LedgerGetWalletOutput', 'error': 'Error' },
  };

export function protobufOutput(value: unknown, type: string, operation?: string): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(item => protobufOutput(item, type, operation));
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'string' && enums[type]) {
    return enums[type]?.find(name => name.endsWith('_' + value));
  }
  if (value !== null && typeof value === 'object') {
    const fields = messages[type];

    if (!fields) {
      throw new Error('Unregistered wire type');
    }

    const record = objectValue(value);
    const hint = type === 'LedgerGetCommandOutcomeOutput' && typeof record.operation === 'string'
      ? record.operation
      : operation;

    if (type === 'RegisteredOutput') {
      const selected = Object.entries(fields).find(([, name]) => name === 'Ledger' + hint + 'Output');

      if (!selected) {
        throw new Error('Unregistered saved outcome');
      }

      return { [selected[0]]: protobufOutput(value, selected[1], hint) };
    }
    if ('ok' in record) {
      return record.ok
        ? { value: protobufOutput(record.value, fields.value ?? '', hint) }
        : { error: protobufOutput(record.error, 'Error', hint) };
    }

    return Object.fromEntries(
      Object.entries(record).filter(([, item]) => item !== undefined).map(
        ([key, item]) => [key, protobufOutput(item, fields[key] ?? '', hint)],
      ),
    );
  }

  return value;
}
