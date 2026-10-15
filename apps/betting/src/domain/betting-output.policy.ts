import * as M from './betting.model.js';
import { validInstant, validUuid } from './betting.policy.js';

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined;
}

export function isIEventEnvelope(value: unknown): value is M.IEventEnvelope {
  const r = record(value);

  return r !== undefined && (validUuid(r.messageId))
    && (Object.values(M.EventSource).some(candidate => candidate === r.source))
    && (Object.values(M.EventType).some(candidate => candidate === r.eventType))
    && (typeof r.schemaVersion === 'number' && Number.isSafeInteger(r.schemaVersion))
    && (validUuid(r.operatorId))
    && (validUuid(r.correlationId))
    && (validInstant(r.occurredAt))
    && (((isIEventResult(r.payload)) || (isIBetStateChangedEvent(r.payload))));
}

export function isIError(value: unknown): value is M.IError {
  const r = record(value);

  return r !== undefined && (Object.values(M.ErrorCode).some(candidate => candidate === r.code))
    && (typeof r.message === 'string')
    && (validUuid(r.correlationId))
    && (typeof r.retryable === 'boolean')
    && (typeof r.outcomeUnknown === 'boolean');
}

export function isIBetSelection(value: unknown): value is M.IBetSelection {
  const r = record(value);

  return r !== undefined && (validUuid(r.eventId)) && (validUuid(r.marketId))
    && (validUuid(r.selectionId))
    && (validUuid(r.quoteId))
    && (typeof r.quoteVersion === 'bigint' && r.quoteVersion >= -9223372036854775808n
      && r.quoteVersion <= 9223372036854775807n);
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

export function isISettlementIntent(value: unknown): value is M.ISettlementIntent {
  const r = record(value);

  return r !== undefined && (validUuid(r.intentId)) && (validUuid(r.betId)) && (validUuid(r.resultId))
    && (typeof r.settlementSeq === 'bigint' && r.settlementSeq >= -9223372036854775808n
      && r.settlementSeq <= 9223372036854775807n)
    && (Object.values(M.SettlementDecision).some(candidate => candidate === r.decision))
    && (isIMoney(r.payout))
    && (validUuid(r.ledgerCommandId))
    && (Object.values(M.SettlementState).some(candidate => candidate === r.state))
    && (validInstant(r.createdAt));
}

export function isIReservationView(value: unknown): value is M.IReservationView {
  const r = record(value);

  return r !== undefined && (validUuid(r.betId)) && (validUuid(r.walletId)) && (isIMoney(r.stake))
    && (Object.values(M.ReservationState).some(candidate => candidate === r.state))
    && (validUuid(r.reservationTransactionId))
    && (r.settlementTransactionId === undefined || validUuid(r.settlementTransactionId))
    && (r.settlementSeq === undefined
      || typeof r.settlementSeq === 'bigint' && r.settlementSeq >= -9223372036854775808n
      && r.settlementSeq <= 9223372036854775807n)
    && (r.grossPayoutMinor === undefined
      || typeof r.grossPayoutMinor === 'bigint' && r.grossPayoutMinor >= -9223372036854775808n
      && r.grossPayoutMinor <= 9223372036854775807n);
}

export function isISettlementSweep(value: unknown): value is M.ISettlementSweep {
  const r = record(value);

  return r !== undefined && (validUuid(r.sweepId)) && (validUuid(r.eventId)) && (validUuid(r.resultId))
    && (r.cursor === undefined || typeof r.cursor === 'string')
    && (Object.values(M.SweepState).some(candidate => candidate === r.state))
    && (typeof r.version === 'bigint' && r.version >= -9223372036854775808n
      && r.version <= 9223372036854775807n);
}

export function isILedgerGetWalletOutput(value: unknown): value is M.ILedgerGetWalletOutput {
  const r = record(value);

  return r !== undefined && (isIWalletView(r.wallet));
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

export function isIPlayerCheckEligibilityOutput(value: unknown): value is M.IPlayerCheckEligibilityOutput {
  const r = record(value);

  return r !== undefined && (isIEligibility(r.eligibility));
}

export function isIEventsValidateSelectionQuoteOutput(value: unknown): value is M.IEventsValidateSelectionQuoteOutput {
  const r = record(value);

  return r !== undefined && (isIQuote(r.acceptedQuote)) && (validInstant(r.evaluatedAt));
}

export function isIEventsGetEventOutput(value: unknown): value is M.IEventsGetEventOutput {
  const r = record(value);

  return r !== undefined && (isIEvent(r.event));
}

export function isILedgerReserveStakeOutput(value: unknown): value is M.ILedgerReserveStakeOutput {
  const r = record(value);

  return r !== undefined && (isIReservationView(r.reservation)) && (isIFinancialOutcome(r.outcome));
}

export function isILedgerGetBetFinancialStatusOutput(value: unknown): value is M.ILedgerGetBetFinancialStatusOutput {
  const r = record(value);

  return r !== undefined && (r.reservation === undefined || isIReservationView(r.reservation))
    && (validInstant(r.observedAt));
}

export function isILedgerCancelBetOutput(value: unknown): value is M.ILedgerCancelBetOutput {
  const r = record(value);

  return r !== undefined && (isIReservationView(r.reservation)) && (isIFinancialOutcome(r.outcome));
}

export function isILedgerSettleWinOutput(value: unknown): value is M.ILedgerSettleWinOutput {
  const r = record(value);

  return r !== undefined && (isIReservationView(r.reservation)) && (isIFinancialOutcome(r.outcome));
}

export function isILedgerSettleLossOutput(value: unknown): value is M.ILedgerSettleLossOutput {
  const r = record(value);

  return r !== undefined && (isIReservationView(r.reservation)) && (isIFinancialOutcome(r.outcome));
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

export function isIBettingGetBetInput(value: unknown): value is M.IBettingGetBetInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.betId))
    && (validUuid(r.playerId));
}

export function isIBettingGetBetOutput(value: unknown): value is M.IBettingGetBetOutput {
  const r = record(value);

  return r !== undefined && (isIBetView(r.bet));
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

export function isIBettingRecordEventResultInput(value: unknown): value is M.IBettingRecordEventResultInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (isIEventEnvelope(r.envelope))
    && (isIEventResult(r.result));
}

export function isIBettingRecordEventResultOutput(value: unknown): value is M.IBettingRecordEventResultOutput {
  const r = record(value);

  return r !== undefined && (typeof r.accepted === 'boolean') && (typeof r.duplicate === 'boolean')
    && (validUuid(r.sweepId));
}

export function isIBettingSettleBetInput(value: unknown): value is M.IBettingSettleBetInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (validUuid(r.betId))
    && (validUuid(r.resultId))
    && (typeof r.settlementSeq === 'bigint' && r.settlementSeq >= -9223372036854775808n
      && r.settlementSeq <= 9223372036854775807n);
}

export function isIBettingSettleBetOutput(value: unknown): value is M.IBettingSettleBetOutput {
  const r = record(value);

  return r !== undefined && (isIBetView(r.bet))
    && (Object.values(M.SettleOutcome).some(candidate => candidate === r.outcome));
}

export function isIBettingRetryPendingReservationInput(
  value: unknown,
): value is M.IBettingRetryPendingReservationInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.batchId))
    && (isIPageInput(r.page))
    && (validInstant(r.pendingBefore));
}

export function isIBettingRetryPendingReservationOutput(
  value: unknown,
): value is M.IBettingRetryPendingReservationOutput {
  const r = record(value);

  return r !== undefined && (isIBatchReport(r.report));
}

export function isIBettingRetryPendingSettlementInput(value: unknown): value is M.IBettingRetryPendingSettlementInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.batchId))
    && (isIPageInput(r.page))
    && (validInstant(r.pendingBefore));
}

export function isIBettingRetryPendingSettlementOutput(
  value: unknown,
): value is M.IBettingRetryPendingSettlementOutput {
  const r = record(value);

  return r !== undefined && (isIBatchReport(r.report));
}

export function isIBettingReconcileBetWithLedgerInput(value: unknown): value is M.IBettingReconcileBetWithLedgerInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId))
    && (validUuid(r.runId))
    && (isIPageInput(r.page))
    && (validInstant(r.cutoff));
}

export function isIBettingReconcileBetWithLedgerOutput(
  value: unknown,
): value is M.IBettingReconcileBetWithLedgerOutput {
  const r = record(value);

  return r !== undefined && (isIReconciliationReport(r.report));
}

export function isIBettingPublishOutboxBatchInput(value: unknown): value is M.IBettingPublishOutboxBatchInput {
  const r = record(value);

  return r !== undefined && (isIWorkerBatchInput(r.input));
}

export function isIBettingPublishOutboxBatchOutput(value: unknown): value is M.IBettingPublishOutboxBatchOutput {
  const r = record(value);

  return r !== undefined && (isIBatchReport(r.report));
}

export function isIBettingRetryPendingCancellationInput(
  value: unknown,
): value is M.IBettingRetryPendingCancellationInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.batchId))
    && (isIPageInput(r.page))
    && (validInstant(r.pendingBefore));
}

export function isIBettingRetryPendingCancellationOutput(
  value: unknown,
): value is M.IBettingRetryPendingCancellationOutput {
  const r = record(value);

  return r !== undefined && (isIBatchReport(r.report));
}

export function isIBettingScheduleEventSettlementsInput(
  value: unknown,
): value is M.IBettingScheduleEventSettlementsInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.sweepId))
    && (isIPageInput(r.page));
}

export function isIBettingScheduleEventSettlementsOutput(
  value: unknown,
): value is M.IBettingScheduleEventSettlementsOutput {
  const r = record(value);

  return r !== undefined && (isIBatchReport(r.report));
}

export function isIEventResult(value: unknown): value is M.IEventResult {
  const r = record(value);

  return r !== undefined && (validUuid(r.resultId)) && (validUuid(r.eventId)) && (validUuid(r.runId))
    && (typeof r.resultSeq === 'bigint' && r.resultSeq >= -9223372036854775808n
      && r.resultSeq <= 9223372036854775807n)
    && (typeof r.homeGoals === 'number' && Number.isSafeInteger(r.homeGoals))
    && (typeof r.awayGoals === 'number' && Number.isSafeInteger(r.awayGoals))
    && (Object.values(M.ResultOutcome).some(candidate => candidate === r.outcome))
    && (validInstant(r.occurredAt));
}

export function isIBetStateChangedEvent(value: unknown): value is M.IBetStateChangedEvent {
  const r = record(value);

  return r !== undefined && (validUuid(r.betId)) && (validUuid(r.playerId))
    && (Object.values(M.BetStatus).some(candidate => candidate === r.status))
    && (typeof r.version === 'bigint' && r.version >= -9223372036854775808n
      && r.version <= 9223372036854775807n)
    && (Object.values(M.FinancialState).some(candidate => candidate === r.financialState));
}

export function isIMoney(value: unknown): value is M.IMoney {
  const r = record(value);

  return r !== undefined
    && (typeof r.amountMinor === 'bigint' && r.amountMinor >= -9223372036854775808n
      && r.amountMinor <= 9223372036854775807n)
    && (typeof r.currency === 'string');
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

export function isIPageInput(value: unknown): value is M.IPageInput {
  const r = record(value);

  return r !== undefined && (typeof r.limit === 'number' && Number.isSafeInteger(r.limit))
    && (r.cursor === undefined || typeof r.cursor === 'string')
    && (r.from === undefined || validInstant(r.from))
    && (r.to === undefined || validInstant(r.to));
}

export function isIBatchReport(value: unknown): value is M.IBatchReport {
  const r = record(value);

  return r !== undefined && (typeof r.selected === 'number' && Number.isSafeInteger(r.selected))
    && (typeof r.applied === 'number' && Number.isSafeInteger(r.applied))
    && (typeof r.replayed === 'number' && Number.isSafeInteger(r.replayed))
    && (typeof r.rejected === 'number' && Number.isSafeInteger(r.rejected))
    && (typeof r.pending === 'number' && Number.isSafeInteger(r.pending))
    && (typeof r.failed === 'number' && Number.isSafeInteger(r.failed))
    && (r.nextCursor === undefined || typeof r.nextCursor === 'string');
}

export function isIReconciliationReport(value: unknown): value is M.IReconciliationReport {
  const r = record(value);

  return r !== undefined && (validUuid(r.runId)) && (validInstant(r.snapshotAt))
    && (Object.values(M.ReconciliationStatus).some(candidate => candidate === r.status))
    && (((value: unknown): boolean => {
      const nested = record(value);

      return nested !== undefined
        && (typeof nested.transactions === 'bigint' && nested.transactions >= -9223372036854775808n
          && nested.transactions <= 9223372036854775807n)
        && (typeof nested.entries === 'bigint' && nested.entries >= -9223372036854775808n
          && nested.entries <= 9223372036854775807n)
        && (typeof nested.violations === 'bigint' && nested.violations >= -9223372036854775808n
          && nested.violations <= 9223372036854775807n);
    })(
      r.counts,
    ))
    && (Array.isArray(r.violations) && r.violations.length <= 200
      && r.violations.every(
        (item: unknown) =>
          ((value: unknown): boolean => {
            const nested = record(value);

            return nested !== undefined && (typeof nested.code === 'string')
              && (nested.businessRef === undefined || validUuid(nested.businessRef));
          })(
            item,
          ),
      ))
    && (r.nextCursor === undefined || typeof r.nextCursor === 'string');
}

export function isIWorkerBatchInput(value: unknown): value is M.IWorkerBatchInput {
  const r = record(value);

  return r !== undefined && (isICallContext(r.context)) && (validUuid(r.batchId))
    && (typeof r.limit === 'number' && Number.isSafeInteger(r.limit))
    && (validInstant(r.cutoff));
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

export function isRegisteredInput(value: unknown): value is M.RegisteredInput {
  return isIBettingPlaceBetInput(value) || isIBettingGetBetInput(value)
    || isIBettingListPlayerBetsInput(value)
    || isIBettingGetBetStatusInput(value)
    || isIBettingCancelBetInput(value)
    || isIBettingRecordEventResultInput(value)
    || isIBettingSettleBetInput(value)
    || isIBettingRetryPendingReservationInput(value)
    || isIBettingRetryPendingSettlementInput(value)
    || isIBettingReconcileBetWithLedgerInput(value)
    || isIBettingPublishOutboxBatchInput(value)
    || isIBettingRetryPendingCancellationInput(value)
    || isIBettingScheduleEventSettlementsInput(value);
}

export function isRegisteredOutput(value: unknown): value is M.RegisteredOutput {
  return isIBettingPlaceBetOutput(value) || isIBettingGetBetOutput(value)
    || isIBettingListPlayerBetsOutput(value)
    || isIBettingGetBetStatusOutput(value)
    || isIBettingCancelBetOutput(value)
    || isIBettingRecordEventResultOutput(value)
    || isIBettingSettleBetOutput(value)
    || isIBettingRetryPendingReservationOutput(value)
    || isIBettingRetryPendingSettlementOutput(value)
    || isIBettingReconcileBetWithLedgerOutput(value)
    || isIBettingPublishOutboxBatchOutput(value)
    || isIBettingRetryPendingCancellationOutput(value)
    || isIBettingScheduleEventSettlementsOutput(value);
}
