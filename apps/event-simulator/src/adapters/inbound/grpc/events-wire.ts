import { objectValue } from '@sportsbook/service-transport';

const enums: Record<string, string[]> =
  {
    'AdvanceMatchPhaseRequestNextPhase': [
      'ADVANCE_MATCH_PHASE_REQUEST_NEXT_PHASE_LIVE',
      'ADVANCE_MATCH_PHASE_REQUEST_NEXT_PHASE_HALF_TIME',
      'ADVANCE_MATCH_PHASE_REQUEST_NEXT_PHASE_SUSPENDED',
    ],
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
    'EventsCompleteEventOutputDelivery': [
      'EVENTS_COMPLETE_EVENT_OUTPUT_DELIVERY_PENDING',
      'EVENTS_COMPLETE_EVENT_OUTPUT_DELIVERY_ACKNOWLEDGED',
    ],
    'EventSport': ['EVENT_SPORT_FOOTBALL'],
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
    'ListEventsRequestPhase': [
      'LIST_EVENTS_REQUEST_PHASE_PRE_MATCH',
      'LIST_EVENTS_REQUEST_PHASE_LIVE',
      'LIST_EVENTS_REQUEST_PHASE_HALF_TIME',
      'LIST_EVENTS_REQUEST_PHASE_SUSPENDED',
      'LIST_EVENTS_REQUEST_PHASE_FINISHED',
    ],
    'MarketState': ['MARKET_STATE_OPEN', 'MARKET_STATE_SUSPENDED', 'MARKET_STATE_CLOSED'],
    'MarketType': ['MARKET_TYPE_MATCH_RESULT'],
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
    'QuoteSelection': ['QUOTE_SELECTION_HOME', 'QUOTE_SELECTION_DRAW', 'QUOTE_SELECTION_AWAY'],
    'QuoteState': ['QUOTE_STATE_OPEN', 'QUOTE_STATE_SUSPENDED', 'QUOTE_STATE_CLOSED'],
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
    'WithdrawalResolvedEventState':
    [
      'WITHDRAWAL_RESOLVED_EVENT_STATE_COMPLETED',
      'WITHDRAWAL_RESOLVED_EVENT_STATE_REJECTED',
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
    'ListEventsRequest': { 'context': 'CallContext', 'page': 'PageInput', 'phase': 'ListEventsRequestPhase' },
    'CallContext': {
      'operatorId': 'string',
      'actorId': 'string',
      'actorKind': 'CallContextActorKind',
      'playerId': 'string',
      'capabilities': 'Capability',
      'correlationId': 'string',
      'deadlineAt': 'string',
    },
    'PageInput': { 'limit': 'int32', 'cursor': 'string', 'from': 'string', 'to': 'string' },
    'EventsListEventsOutput': { 'events': 'Event', 'nextCursor': 'string', 'observedAt': 'string' },
    'Event': {
      'eventId': 'string',
      'runId': 'string',
      'sport': 'EventSport',
      'homeTeam': 'string',
      'awayTeam': 'string',
      'startsAt': 'string',
      'phase': 'EventPhase',
      'phaseSeq': 'int64',
      'simulatedAt': 'string',
      'resultRef': 'string',
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
    'GetEventRequest': { 'context': 'CallContext', 'eventId': 'string' },
    'EventsGetEventOutput': { 'event': 'Event' },
    'GetMarketsRequest': { 'context': 'CallContext', 'eventId': 'string' },
    'EventsGetMarketsOutput': { 'markets': 'Market', 'observedAt': 'string' },
    'Market': {
      'marketId': 'string',
      'eventId': 'string',
      'type': 'MarketType',
      'state': 'MarketState',
      'selections': 'Quote',
    },
    'Quote': {
      'quoteId': 'string',
      'quoteVersion': 'int64',
      'eventId': 'string',
      'marketId': 'string',
      'selectionId': 'string',
      'selection': 'QuoteSelection',
      'odds': 'string',
      'validUntil': 'string',
      'state': 'QuoteState',
    },
    'ValidateSelectionQuoteRequest': {
      'context': 'CallContext',
      'playerId': 'string',
      'eventId': 'string',
      'marketId': 'string',
      'selectionId': 'string',
      'quoteId': 'string',
      'quoteVersion': 'int64',
    },
    'EventsValidateSelectionQuoteOutput': { 'acceptedQuote': 'Quote', 'evaluatedAt': 'string' },
    'GetEventResultRequest': { 'context': 'CallContext', 'eventId': 'string' },
    'EventsGetEventResultOutput': { 'result': 'EventResult', 'ready': 'bool' },
    'AdvanceMatchPhaseRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'eventId': 'string',
      'expectedPhaseSeq': 'int64',
      'nextPhase': 'AdvanceMatchPhaseRequestNextPhase',
      'simulatedAt': 'string',
    },
    'EventsAdvanceMatchPhaseOutput': { 'event': 'Event' },
    'CompleteEventRequest': {
      'context': 'CallContext',
      'requestId': 'string',
      'eventId': 'string',
      'expectedPhaseSeq': 'int64',
      'result': 'EventResult',
    },
    'EventsCompleteEventOutput':
  {
    'event':
      'Event',
    'result':
      'EventResult',
    'delivery':
      'EventsCompleteEventOutputDelivery',
  },
    'ListEventsResponse': { 'value': 'EventsListEventsOutput', 'error': 'Error' },
    'GetEventResponse': { 'value': 'EventsGetEventOutput', 'error': 'Error' },
    'GetMarketsResponse': { 'value': 'EventsGetMarketsOutput', 'error': 'Error' },
    'ValidateSelectionQuoteResponse': { 'value': 'EventsValidateSelectionQuoteOutput', 'error': 'Error' },
    'GetEventResultResponse': { 'value': 'EventsGetEventResultOutput', 'error': 'Error' },
    'AdvanceMatchPhaseResponse': { 'value': 'EventsAdvanceMatchPhaseOutput', 'error': 'Error' },
    'CompleteEventResponse': { 'value': 'EventsCompleteEventOutput', 'error': 'Error' },
  };

export function protobufOutput(value: unknown, type: string): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(item => protobufOutput(item, type));
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

    if ('ok' in record) {
      return record.ok
        ? { value: protobufOutput(record.value, fields.value ?? '') }
        : { error: protobufOutput(record.error, 'Error') };
    }

    return Object.fromEntries(
      Object.entries(record).filter(([, item]) => item !== undefined).map(
        ([key, item]) => [key, protobufOutput(item, fields[key] ?? '')],
      ),
    );
  }

  return value;
}
