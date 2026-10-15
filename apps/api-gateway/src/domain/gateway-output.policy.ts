import * as M from './gateway.model.js';
import { validInstant, validUuid } from './gateway.policy.js';

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined;
}

export function isICallContext(value: unknown): value is M.ICallContext {
  const r = record(value);

  return r !== undefined && (validUuid(r.operatorId)) && (validUuid(r.actorId))
    && (Object.values(M.ActorKind).some(candidate => candidate === r.actorKind))
    && (r.playerId === undefined || validUuid(r.playerId))
    && (Array.isArray(r.capabilities) && r.capabilities.length <= 200
      && r.capabilities.every(
        (item: unknown) => Object.values(M.Capability).some(candidate => candidate === item),
      ))
    && (validUuid(r.correlationId))
    && (validInstant(r.deadlineAt));
}

export function isIPageInput(value: unknown): value is M.IPageInput {
  const r = record(value);

  return r !== undefined && (typeof r.limit === 'number' && Number.isSafeInteger(r.limit))
    && (r.cursor === undefined || typeof r.cursor === 'string')
    && (r.from === undefined || validInstant(r.from))
    && (r.to === undefined || validInstant(r.to));
}

export function isIError(value: unknown): value is M.IError {
  const r = record(value);

  return r !== undefined && (Object.values(M.ErrorCode).some(candidate => candidate === r.code))
    && (typeof r.message === 'string')
    && (validUuid(r.correlationId))
    && (r.fields === undefined
      || Array.isArray(r.fields) && r.fields.length <= 200
      && r.fields.every(
        (item: unknown) =>
          ((value: unknown): boolean => {
            const nested = record(value);

            return nested !== undefined && (typeof nested.path === 'string') && (typeof nested.code === 'string');
          })(
            item,
          ),
      ))
    && (typeof r.retryable === 'boolean')
    && (typeof r.outcomeUnknown === 'boolean')
    && (r.retryAfterMs === undefined
      || typeof r.retryAfterMs === 'number' && Number.isSafeInteger(r.retryAfterMs));
}

export function isIGatewayRegisterPlayerInput(value: unknown): value is M.IGatewayRegisterPlayerInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (r.externalRef === undefined || typeof r.externalRef === 'string')
    && (typeof r.locale === 'string')
    && (typeof r.timeZone === 'string');
}

export function isIGatewayRegisterPlayerOutput(value: unknown): value is M.IGatewayRegisterPlayerOutput {
  const r = record(value);

  return r !== undefined && (isIProfile(r.profile));
}

export function isIGatewayGetMyProfileInput(value: unknown): value is M.IGatewayGetMyProfileInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context));
}

export function isIGatewayGetMyProfileOutput(value: unknown): value is M.IGatewayGetMyProfileOutput {
  const r = record(value);

  return r !== undefined && (isIProfile(r.profile))
    && (Array.isArray(r.contacts) && r.contacts.length <= 200
      && r.contacts.every((item: unknown) => isIContact(item)));
}

export function isIGatewayUpdateMyProfileInput(value: unknown): value is M.IGatewayUpdateMyProfileInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (typeof r.expectedVersion === 'bigint' && r.expectedVersion >= -9223372036854775808n
      && r.expectedVersion <= 9223372036854775807n)
    && (isIPlayerProfilePatch(r.patch));
}

export function isIGatewayUpdateMyProfileOutput(value: unknown): value is M.IGatewayUpdateMyProfileOutput {
  const r = record(value);

  return r !== undefined && (isIProfile(r.profile));
}

export function isIGatewayGetMyEligibilityInput(value: unknown): value is M.IGatewayGetMyEligibilityInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context))
    && (Object.values(M.PlayerCapability).some(candidate => candidate === r.capability));
}

export function isIGatewayGetMyEligibilityOutput(value: unknown): value is M.IGatewayGetMyEligibilityOutput {
  const r = record(value);

  return r !== undefined && (isIEligibility(r.eligibility));
}

export function isIGatewayGetMyBalanceInput(value: unknown): value is M.IGatewayGetMyBalanceInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (typeof r.currency === 'string');
}

export function isIGatewayGetMyBalanceOutput(value: unknown): value is M.IGatewayGetMyBalanceOutput {
  const r = record(value);

  return r !== undefined && (isIWalletView(r.wallet));
}

export function isIGatewayTopUpTestWalletInput(value: unknown): value is M.IGatewayTopUpTestWalletInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (isIMoney(r.amount))
    && (typeof r.providerRef === 'string');
}

export function isIGatewayTopUpTestWalletOutput(value: unknown): value is M.IGatewayTopUpTestWalletOutput {
  const r = record(value);

  return r !== undefined && (isIFinancialOutcome(r.outcome));
}

export function isIGatewayRequestMyWithdrawalInput(value: unknown): value is M.IGatewayRequestMyWithdrawalInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (isIMoney(r.amount));
}

export function isIGatewayRequestMyWithdrawalOutput(value: unknown): value is M.IGatewayRequestMyWithdrawalOutput {
  const r = record(value);

  return r !== undefined && (isIWithdrawalView(r.withdrawal)) && (isIFinancialOutcome(r.outcome));
}

export function isIGatewayGetMyWithdrawalInput(value: unknown): value is M.IGatewayGetMyWithdrawalInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.withdrawalId));
}

export function isIGatewayGetMyWithdrawalOutput(value: unknown): value is M.IGatewayGetMyWithdrawalOutput {
  const r = record(value);

  return r !== undefined && (isIWithdrawalView(r.withdrawal));
}

export function isIGatewayGetMyTransactionsInput(value: unknown): value is M.IGatewayGetMyTransactionsInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (typeof r.currency === 'string')
    && (isIPageInput(r.page));
}

export function isIGatewayGetMyTransactionsOutput(value: unknown): value is M.IGatewayGetMyTransactionsOutput {
  const r = record(value);

  return r !== undefined
    && (Array.isArray(r.transactions) && r.transactions.length <= 200
      && r.transactions.every((item: unknown) => isIJournalView(item)))
    && (r.nextCursor === undefined || typeof r.nextCursor === 'string')
    && (validInstant(r.observedAt));
}

export function isIGatewayPlaceBetInput(value: unknown): value is M.IGatewayPlaceBetInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (Object.values(M.BetType).some(candidate => candidate === r.type))
    && (isIMoney(r.stake))
    && (((value: unknown): boolean => {
      const nested = record(value);

      return nested !== undefined && (validUuid(nested.eventId)) && (validUuid(nested.marketId))
        && (validUuid(nested.selectionId))
        && (validUuid(nested.quoteId))
        && (typeof nested.quoteVersion === 'bigint' && nested.quoteVersion >= -9223372036854775808n
          && nested.quoteVersion <= 9223372036854775807n);
    })(
      r.selection,
    ));
}

export function isIGatewayPlaceBetOutput(value: unknown): value is M.IGatewayPlaceBetOutput {
  const r = record(value);

  return r !== undefined && (isIBetView(r.bet))
    && (Object.values(M.PlaceOutcome).some(candidate => candidate === r.outcome));
}

export function isIGatewayGetMyBetInput(value: unknown): value is M.IGatewayGetMyBetInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.betId));
}

export function isIGatewayGetMyBetOutput(value: unknown): value is M.IGatewayGetMyBetOutput {
  const r = record(value);

  return r !== undefined && (isIBetView(r.bet));
}

export function isIGatewayGetMyBetStatusInput(value: unknown): value is M.IGatewayGetMyBetStatusInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.betId));
}

export function isIGatewayGetMyBetStatusOutput(value: unknown): value is M.IGatewayGetMyBetStatusOutput {
  const r = record(value);

  return r !== undefined && (validUuid(r.betId))
    && (Object.values(M.BetStatus).some(candidate => candidate === r.status))
    && (Object.values(M.FinancialState).some(candidate => candidate === r.financialState))
    && (typeof r.version === 'bigint' && r.version >= -9223372036854775808n
      && r.version <= 9223372036854775807n)
    && (validInstant(r.observedAt));
}

export function isIGatewayListMyBetsInput(value: unknown): value is M.IGatewayListMyBetsInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (isIPageInput(r.page))
    && (r.status === undefined || Object.values(M.BetStatus).some(candidate => candidate === r.status));
}

export function isIGatewayListMyBetsOutput(value: unknown): value is M.IGatewayListMyBetsOutput {
  const r = record(value);

  return r !== undefined
    && (Array.isArray(r.bets) && r.bets.length <= 200
      && r.bets.every((item: unknown) => isIBetView(item)))
    && (r.nextCursor === undefined || typeof r.nextCursor === 'string')
    && (validInstant(r.observedAt));
}

export function isIGatewayCancelMyBetInput(value: unknown): value is M.IGatewayCancelMyBetInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (validUuid(r.betId))
    && (typeof r.expectedVersion === 'bigint' && r.expectedVersion >= -9223372036854775808n
      && r.expectedVersion <= 9223372036854775807n);
}

export function isIGatewayCancelMyBetOutput(value: unknown): value is M.IGatewayCancelMyBetOutput {
  const r = record(value);

  return r !== undefined && (isIBetView(r.bet))
    && (Object.values(M.CancelOutcome).some(candidate => candidate === r.outcome));
}

export function isIGatewayListEventsInput(value: unknown): value is M.IGatewayListEventsInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (isIPageInput(r.page))
    && (r.phase === undefined || Object.values(M.EventPhase).some(candidate => candidate === r.phase));
}

export function isIGatewayListEventsOutput(value: unknown): value is M.IGatewayListEventsOutput {
  const r = record(value);

  return r !== undefined
    && (Array.isArray(r.events) && r.events.length <= 200
      && r.events.every((item: unknown) => isIEvent(item)))
    && (r.nextCursor === undefined || typeof r.nextCursor === 'string')
    && (validInstant(r.observedAt));
}

export function isIGatewayGetEventInput(value: unknown): value is M.IGatewayGetEventInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.eventId));
}

export function isIGatewayGetEventOutput(value: unknown): value is M.IGatewayGetEventOutput {
  const r = record(value);

  return r !== undefined && (isIEvent(r.event));
}

export function isIGatewayListMarketsInput(value: unknown): value is M.IGatewayListMarketsInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.eventId));
}

export function isIGatewayListMarketsOutput(value: unknown): value is M.IGatewayListMarketsOutput {
  const r = record(value);

  return r !== undefined
    && (Array.isArray(r.markets) && r.markets.length <= 200
      && r.markets.every((item: unknown) => isIMarket(item)))
    && (validInstant(r.observedAt));
}

export function isIGatewayGetMyDashboardInput(value: unknown): value is M.IGatewayGetMyDashboardInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (typeof r.currency === 'string')
    && (typeof r.recentBetLimit === 'number' && Number.isSafeInteger(r.recentBetLimit));
}

export function isIGatewayGetMyDashboardOutput(value: unknown): value is M.IGatewayGetMyDashboardOutput {
  const r = record(value);

  return r !== undefined && (isIProfile(r.profile)) && (isIWalletView(r.wallet))
    && (Array.isArray(r.recentBets) && r.recentBets.length <= 200
      && r.recentBets.every((item: unknown) => isIBetView(item)))
    && (Array.isArray(r.events) && r.events.length <= 200
      && r.events.every((item: unknown) => isIEvent(item)))
    && (((value: unknown): boolean => {
      const nested = record(value);

      return nested !== undefined && (validInstant(nested.profile)) && (validInstant(nested.wallet))
        && (validInstant(nested.bets))
        && (validInstant(nested.events));
    })(
      r.sectionObservedAt,
    ));
}

export function isIPlayerRegisterPlayerInput(value: unknown): value is M.IPlayerRegisterPlayerInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (r.externalRef === undefined || typeof r.externalRef === 'string')
    && (typeof r.locale === 'string')
    && (typeof r.timeZone === 'string');
}

export function isIPlayerRegisterPlayerOutput(value: unknown): value is M.IPlayerRegisterPlayerOutput {
  const r = record(value);

  return r !== undefined && (isIProfile(r.profile)) && (typeof r.created === 'boolean');
}

export function isIPlayerUpdatePlayerProfileInput(value: unknown): value is M.IPlayerUpdatePlayerProfileInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (validUuid(r.playerId))
    && (typeof r.expectedVersion === 'bigint' && r.expectedVersion >= -9223372036854775808n
      && r.expectedVersion <= 9223372036854775807n)
    && (((value: unknown): boolean => {
      const nested = record(value);

      return nested !== undefined
        && (nested.firstName === undefined || typeof nested.firstName === 'string')
        && (nested.lastName === undefined || typeof nested.lastName === 'string')
        && (nested.birthDate === undefined || typeof nested.birthDate === 'string')
        && (nested.residenceCountry === undefined || typeof nested.residenceCountry === 'string')
        && (nested.nationalityCountry === undefined || typeof nested.nationalityCountry === 'string')
        && (nested.locale === undefined || typeof nested.locale === 'string')
        && (nested.timeZone === undefined || typeof nested.timeZone === 'string');
    })(
      r.patch,
    ));
}

export function isIPlayerUpdatePlayerProfileOutput(value: unknown): value is M.IPlayerUpdatePlayerProfileOutput {
  const r = record(value);

  return r !== undefined && (isIProfile(r.profile));
}

export function isIPlayerGetPlayerInput(value: unknown): value is M.IPlayerGetPlayerInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId));
}

export function isIPlayerGetPlayerOutput(value: unknown): value is M.IPlayerGetPlayerOutput {
  const r = record(value);

  return r !== undefined && (isIProfile(r.profile))
    && (Array.isArray(r.contacts) && r.contacts.length <= 200
      && r.contacts.every((item: unknown) => isIContact(item)));
}

export function isIPlayerCheckEligibilityInput(value: unknown): value is M.IPlayerCheckEligibilityInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId))
    && (Object.values(M.PlayerCapability).some(candidate => candidate === r.capability));
}

export function isIPlayerCheckEligibilityOutput(value: unknown): value is M.IPlayerCheckEligibilityOutput {
  const r = record(value);

  return r !== undefined && (isIEligibility(r.eligibility));
}

export function isILedgerDepositTestFundsInput(value: unknown): value is M.ILedgerDepositTestFundsInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (validUuid(r.walletId))
    && (isIMoney(r.amount))
    && (typeof r.providerRef === 'string');
}

export function isILedgerDepositTestFundsOutput(value: unknown): value is M.ILedgerDepositTestFundsOutput {
  const r = record(value);

  return r !== undefined && (isIFinancialOutcome(r.outcome));
}

export function isILedgerRequestWithdrawalInput(value: unknown): value is M.ILedgerRequestWithdrawalInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (validUuid(r.walletId))
    && (validUuid(r.withdrawalId))
    && (isIMoney(r.amount));
}

export function isILedgerRequestWithdrawalOutput(value: unknown): value is M.ILedgerRequestWithdrawalOutput {
  const r = record(value);

  return r !== undefined && (isIWithdrawalView(r.withdrawal)) && (isIFinancialOutcome(r.outcome));
}

export function isILedgerGetWalletInput(value: unknown): value is M.ILedgerGetWalletInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId))
    && (typeof r.currency === 'string');
}

export function isILedgerGetWalletOutput(value: unknown): value is M.ILedgerGetWalletOutput {
  const r = record(value);

  return r !== undefined && (isIWalletView(r.wallet));
}

export function isILedgerGetWithdrawalInput(value: unknown): value is M.ILedgerGetWithdrawalInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.withdrawalId));
}

export function isILedgerGetWithdrawalOutput(value: unknown): value is M.ILedgerGetWithdrawalOutput {
  const r = record(value);

  return r !== undefined && (isIWithdrawalView(r.withdrawal));
}

export function isILedgerGetWalletTransactionsInput(value: unknown): value is M.ILedgerGetWalletTransactionsInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.walletId))
    && (isIPageInput(r.page));
}

export function isILedgerGetWalletTransactionsOutput(value: unknown): value is M.ILedgerGetWalletTransactionsOutput {
  const r = record(value);

  return r !== undefined
    && (Array.isArray(r.transactions) && r.transactions.length <= 200
      && r.transactions.every((item: unknown) => isIJournalView(item)))
    && (r.nextCursor === undefined || typeof r.nextCursor === 'string')
    && (validInstant(r.observedAt));
}

export function isIBettingPlaceBetInput(value: unknown): value is M.IBettingPlaceBetInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (validUuid(r.playerId))
    && (isIMoney(r.stake))
    && (Object.values(M.BetType).some(candidate => candidate === r.type))
    && (((value: unknown): boolean => {
      const nested = record(value);

      return nested !== undefined && (validUuid(nested.eventId)) && (validUuid(nested.marketId))
        && (validUuid(nested.selectionId))
        && (validUuid(nested.quoteId))
        && (typeof nested.quoteVersion === 'bigint' && nested.quoteVersion >= -9223372036854775808n
          && nested.quoteVersion <= 9223372036854775807n);
    })(
      r.selection,
    ));
}

export function isIBettingPlaceBetOutput(value: unknown): value is M.IBettingPlaceBetOutput {
  const r = record(value);

  return r !== undefined && (isIBetView(r.bet))
    && (Object.values(M.PlaceOutcome).some(candidate => candidate === r.outcome));
}

export function isIBettingCancelBetInput(value: unknown): value is M.IBettingCancelBetInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (validUuid(r.playerId))
    && (validUuid(r.betId))
    && (typeof r.expectedVersion === 'bigint' && r.expectedVersion >= -9223372036854775808n
      && r.expectedVersion <= 9223372036854775807n);
}

export function isIBettingCancelBetOutput(value: unknown): value is M.IBettingCancelBetOutput {
  const r = record(value);

  return r !== undefined && (isIBetView(r.bet))
    && (Object.values(M.CancelOutcome).some(candidate => candidate === r.outcome));
}

export function isIBettingGetBetInput(value: unknown): value is M.IBettingGetBetInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.betId))
    && (validUuid(r.playerId));
}

export function isIBettingGetBetOutput(value: unknown): value is M.IBettingGetBetOutput {
  const r = record(value);

  return r !== undefined && (isIBetView(r.bet));
}

export function isIBettingGetBetStatusInput(value: unknown): value is M.IBettingGetBetStatusInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId))
    && (validUuid(r.betId));
}

export function isIBettingGetBetStatusOutput(value: unknown): value is M.IBettingGetBetStatusOutput {
  const r = record(value);

  return r !== undefined && (validUuid(r.betId))
    && (Object.values(M.BetStatus).some(candidate => candidate === r.status))
    && (Object.values(M.FinancialState).some(candidate => candidate === r.financialState))
    && (typeof r.version === 'bigint' && r.version >= -9223372036854775808n
      && r.version <= 9223372036854775807n)
    && (validInstant(r.observedAt));
}

export function isIBettingListPlayerBetsInput(value: unknown): value is M.IBettingListPlayerBetsInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId))
    && (isIPageInput(r.page))
    && (r.status === undefined || Object.values(M.BetStatus).some(candidate => candidate === r.status));
}

export function isIBettingListPlayerBetsOutput(value: unknown): value is M.IBettingListPlayerBetsOutput {
  const r = record(value);

  return r !== undefined
    && (Array.isArray(r.bets) && r.bets.length <= 200
      && r.bets.every((item: unknown) => isIBetView(item)))
    && (r.nextCursor === undefined || typeof r.nextCursor === 'string')
    && (validInstant(r.observedAt));
}

export function isIEventsListEventsInput(value: unknown): value is M.IEventsListEventsInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (isIPageInput(r.page))
    && (r.phase === undefined || Object.values(M.EventPhase).some(candidate => candidate === r.phase));
}

export function isIEventsListEventsOutput(value: unknown): value is M.IEventsListEventsOutput {
  const r = record(value);

  return r !== undefined
    && (Array.isArray(r.events) && r.events.length <= 200
      && r.events.every((item: unknown) => isIEvent(item)))
    && (r.nextCursor === undefined || typeof r.nextCursor === 'string')
    && (validInstant(r.observedAt));
}

export function isIEventsGetEventInput(value: unknown): value is M.IEventsGetEventInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.eventId));
}

export function isIEventsGetEventOutput(value: unknown): value is M.IEventsGetEventOutput {
  const r = record(value);

  return r !== undefined && (isIEvent(r.event));
}

export function isIEventsGetMarketsInput(value: unknown): value is M.IEventsGetMarketsInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.eventId));
}

export function isIEventsGetMarketsOutput(value: unknown): value is M.IEventsGetMarketsOutput {
  const r = record(value);

  return r !== undefined
    && (Array.isArray(r.markets) && r.markets.length <= 200
      && r.markets.every((item: unknown) => isIMarket(item)))
    && (validInstant(r.observedAt));
}

export function isIProfile(value: unknown): value is M.IProfile {
  const r = record(value);

  return r !== undefined && (validUuid(r.playerId))
    && (Object.values(M.PlayerStatus).some(candidate => candidate === r.status))
    && (r.firstName === undefined || typeof r.firstName === 'string')
    && (r.lastName === undefined || typeof r.lastName === 'string')
    && (r.birthDate === undefined || typeof r.birthDate === 'string')
    && (r.residenceCountry === undefined || typeof r.residenceCountry === 'string')
    && (r.nationalityCountry === undefined || typeof r.nationalityCountry === 'string')
    && (typeof r.locale === 'string')
    && (typeof r.timeZone === 'string')
    && (typeof r.version === 'bigint' && r.version >= -9223372036854775808n
      && r.version <= 9223372036854775807n)
    && (validInstant(r.createdAt))
    && (validInstant(r.updatedAt));
}

export function isIContact(value: unknown): value is M.IContact {
  const r = record(value);

  return r !== undefined && (validUuid(r.contactId))
    && (Object.values(M.ContactKind).some(candidate => candidate === r.kind))
    && (typeof r.displayValue === 'string')
    && (typeof r.isPrimary === 'boolean')
    && (r.verifiedAt === undefined || validInstant(r.verifiedAt));
}

export function isIPlayerProfilePatch(value: unknown): value is M.IPlayerProfilePatch {
  const r = record(value);

  return r !== undefined && (r.firstName === undefined || typeof r.firstName === 'string')
    && (r.lastName === undefined || typeof r.lastName === 'string')
    && (r.birthDate === undefined || typeof r.birthDate === 'string')
    && (r.residenceCountry === undefined || typeof r.residenceCountry === 'string')
    && (r.nationalityCountry === undefined || typeof r.nationalityCountry === 'string')
    && (r.locale === undefined || typeof r.locale === 'string')
    && (r.timeZone === undefined || typeof r.timeZone === 'string');
}

export function isIEligibility(value: unknown): value is M.IEligibility {
  const r = record(value);

  return r !== undefined && (typeof r.allowed === 'boolean')
    && (Object.values(M.EligibilityReason).some(candidate => candidate === r.reasonCode))
    && (typeof r.policyVersion === 'string')
    && (validInstant(r.evaluatedAt))
    && (r.validUntil === undefined || validInstant(r.validUntil))
    && (typeof r.playerVersion === 'bigint' && r.playerVersion >= -9223372036854775808n
      && r.playerVersion <= 9223372036854775807n);
}

export function isIWalletView(value: unknown): value is M.IWalletView {
  const r = record(value);

  return r !== undefined && (validUuid(r.walletId)) && (validUuid(r.playerId))
    && (typeof r.currency === 'string')
    && (Object.values(M.WalletStatus).some(candidate => candidate === r.status))
    && (typeof r.availableMinor === 'bigint' && r.availableMinor >= -9223372036854775808n
      && r.availableMinor <= 9223372036854775807n)
    && (typeof r.reservedMinor === 'bigint' && r.reservedMinor >= -9223372036854775808n
      && r.reservedMinor <= 9223372036854775807n)
    && (typeof r.withdrawalHoldMinor === 'bigint' && r.withdrawalHoldMinor >= -9223372036854775808n
      && r.withdrawalHoldMinor <= 9223372036854775807n)
    && (typeof r.version === 'bigint' && r.version >= -9223372036854775808n
      && r.version <= 9223372036854775807n)
    && (validInstant(r.observedAt));
}

export function isIMoney(value: unknown): value is M.IMoney {
  const r = record(value);

  return r !== undefined
    && (typeof r.amountMinor === 'bigint' && r.amountMinor >= -9223372036854775808n
      && r.amountMinor <= 9223372036854775807n)
    && (typeof r.currency === 'string');
}

export function isIFinancialOutcome(value: unknown): value is M.IFinancialOutcome {
  const r = record(value);

  return r !== undefined && (validUuid(r.requestId))
    && (Object.values(M.FinancialOutcomeState).some(candidate => candidate === r.state))
    && (r.transactionId === undefined || validUuid(r.transactionId))
    && (validUuid(r.businessRef))
    && (isIWalletView(r.wallet))
    && (r.reasonCode === undefined
      || Object.values(M.ErrorCode).some(candidate => candidate === r.reasonCode))
    && (typeof r.replayed === 'boolean');
}

export function isIWithdrawalView(value: unknown): value is M.IWithdrawalView {
  const r = record(value);

  return r !== undefined && (validUuid(r.withdrawalId)) && (validUuid(r.walletId))
    && (isIMoney(r.amount))
    && (Object.values(M.WithdrawalState).some(candidate => candidate === r.state))
    && (validUuid(r.holdTransactionId))
    && (r.resolutionTransactionId === undefined || validUuid(r.resolutionTransactionId))
    && (r.providerRef === undefined || typeof r.providerRef === 'string')
    && (r.reasonCode === undefined || typeof r.reasonCode === 'string')
    && (validInstant(r.createdAt))
    && (r.resolvedAt === undefined || validInstant(r.resolvedAt));
}

export function isIJournalView(value: unknown): value is M.IJournalView {
  const r = record(value);

  return r !== undefined && (validUuid(r.transactionId)) && (validUuid(r.requestId))
    && (Object.values(M.TransactionType).some(candidate => candidate === r.transactionType))
    && (typeof r.businessRef === 'string')
    && (typeof r.currency === 'string')
    && (Object.values(M.JournalStatus).some(candidate => candidate === r.status))
    && (r.postedAt === undefined || validInstant(r.postedAt))
    && (Array.isArray(r.entries) && r.entries.length <= 200
      && r.entries.every((item: unknown) => isIEntry(item)));
}

export function isIBetView(value: unknown): value is M.IBetView {
  const r = record(value);

  return r !== undefined && (validUuid(r.betId)) && (validUuid(r.playerId))
    && (Object.values(M.BetType).some(candidate => candidate === r.type))
    && (Object.values(M.BetStatus).some(candidate => candidate === r.status))
    && (isIMoney(r.stake))
    && (typeof r.potentialPayoutMinor === 'bigint' && r.potentialPayoutMinor >= -9223372036854775808n
      && r.potentialPayoutMinor <= 9223372036854775807n)
    && (r.actualPayoutMinor === undefined
      || typeof r.actualPayoutMinor === 'bigint' && r.actualPayoutMinor >= -9223372036854775808n
      && r.actualPayoutMinor <= 9223372036854775807n)
    && (Array.isArray(r.legs) && r.legs.length <= 200
      && r.legs.every((item: unknown) => isIBetLeg(item)))
    && (validInstant(r.createdAt))
    && (r.acceptedAt === undefined || validInstant(r.acceptedAt))
    && (r.settledAt === undefined || validInstant(r.settledAt))
    && (r.reasonCode === undefined
      || Object.values(M.ErrorCode).some(candidate => candidate === r.reasonCode))
    && (typeof r.version === 'bigint' && r.version >= -9223372036854775808n
      && r.version <= 9223372036854775807n);
}

export function isIEvent(value: unknown): value is M.IEvent {
  const r = record(value);

  return r !== undefined && (validUuid(r.eventId)) && (validUuid(r.runId))
    && (Object.values(M.Sport).some(candidate => candidate === r.sport))
    && (typeof r.homeTeam === 'string')
    && (typeof r.awayTeam === 'string')
    && (validInstant(r.startsAt))
    && (Object.values(M.EventPhase).some(candidate => candidate === r.phase))
    && (typeof r.phaseSeq === 'bigint' && r.phaseSeq >= -9223372036854775808n
      && r.phaseSeq <= 9223372036854775807n)
    && (validInstant(r.simulatedAt))
    && (r.resultRef === undefined || validUuid(r.resultRef));
}

export function isIMarket(value: unknown): value is M.IMarket {
  const r = record(value);

  return r !== undefined && (validUuid(r.marketId)) && (validUuid(r.eventId))
    && (Object.values(M.MarketType).some(candidate => candidate === r.type))
    && (Object.values(M.MarketState).some(candidate => candidate === r.state))
    && (Array.isArray(r.selections) && r.selections.length <= 200
      && r.selections.every((item: unknown) => isIQuote(item)));
}

export function isIEntry(value: unknown): value is M.IEntry {
  const r = record(value);

  return r !== undefined && (validUuid(r.entryId)) && (validUuid(r.accountId))
    && (validUuid(r.transactionId))
    && (typeof r.entryNo === 'number' && Number.isSafeInteger(r.entryNo))
    && (Object.values(M.Side).some(candidate => candidate === r.side))
    && (typeof r.amountMinor === 'bigint' && r.amountMinor >= -9223372036854775808n
      && r.amountMinor <= 9223372036854775807n)
    && (typeof r.currency === 'string')
    && (validInstant(r.postedAt));
}

export function isIBetLeg(value: unknown): value is M.IBetLeg {
  const r = record(value);

  return r !== undefined && (validUuid(r.legId))
    && (typeof r.legNo === 'number' && Number.isSafeInteger(r.legNo))
    && (validUuid(r.eventId))
    && (validUuid(r.marketId))
    && (validUuid(r.selectionId))
    && (r.quote === undefined || isIQuote(r.quote))
    && (Object.values(M.BetLegState).some(candidate => candidate === r.state))
    && (r.resultRef === undefined || validUuid(r.resultRef));
}

export function isIQuote(value: unknown): value is M.IQuote {
  const r = record(value);

  return r !== undefined && (validUuid(r.quoteId))
    && (typeof r.quoteVersion === 'bigint' && r.quoteVersion >= -9223372036854775808n
      && r.quoteVersion <= 9223372036854775807n)
    && (validUuid(r.eventId))
    && (validUuid(r.marketId))
    && (validUuid(r.selectionId))
    && (Object.values(M.Selection).some(candidate => candidate === r.selection))
    && (typeof r.odds === 'string')
    && (validInstant(r.validUntil))
    && (Object.values(M.MarketState).some(candidate => candidate === r.state));
}

export function isRegisteredInput(value: unknown): value is M.RegisteredInput {
  return isIGatewayRegisterPlayerInput(value) || isIGatewayGetMyProfileInput(value)
    || isIGatewayUpdateMyProfileInput(value)
    || isIGatewayGetMyEligibilityInput(value)
    || isIGatewayGetMyBalanceInput(value)
    || isIGatewayTopUpTestWalletInput(value)
    || isIGatewayRequestMyWithdrawalInput(value)
    || isIGatewayGetMyWithdrawalInput(value)
    || isIGatewayGetMyTransactionsInput(value)
    || isIGatewayPlaceBetInput(value)
    || isIGatewayGetMyBetInput(value)
    || isIGatewayGetMyBetStatusInput(value)
    || isIGatewayListMyBetsInput(value)
    || isIGatewayCancelMyBetInput(value)
    || isIGatewayListEventsInput(value)
    || isIGatewayGetEventInput(value)
    || isIGatewayListMarketsInput(value)
    || isIGatewayGetMyDashboardInput(value);
}

export function isRegisteredOutput(value: unknown): value is M.RegisteredOutput {
  return isIGatewayRegisterPlayerOutput(value) || isIGatewayGetMyProfileOutput(value)
    || isIGatewayUpdateMyProfileOutput(value)
    || isIGatewayGetMyEligibilityOutput(value)
    || isIGatewayGetMyBalanceOutput(value)
    || isIGatewayTopUpTestWalletOutput(value)
    || isIGatewayRequestMyWithdrawalOutput(value)
    || isIGatewayGetMyWithdrawalOutput(value)
    || isIGatewayGetMyTransactionsOutput(value)
    || isIGatewayPlaceBetOutput(value)
    || isIGatewayGetMyBetOutput(value)
    || isIGatewayGetMyBetStatusOutput(value)
    || isIGatewayListMyBetsOutput(value)
    || isIGatewayCancelMyBetOutput(value)
    || isIGatewayListEventsOutput(value)
    || isIGatewayGetEventOutput(value)
    || isIGatewayListMarketsOutput(value)
    || isIGatewayGetMyDashboardOutput(value);
}
