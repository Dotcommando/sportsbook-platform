import type { IServiceClientSettings } from '@sportsbook/service-transport';

import * as M from '../../../domain/betting.model.js';
import { requireRule } from '../../../domain/betting.policy.js';
import * as Output from '../../../domain/betting-output.policy.js';
import type {
  ClockPort,
  LedgerReservationPort,
  LedgerSettlementPort,
  MarketQuotePort,
  PlayerEligibilityPort,
} from '../../../ports/outbound/betting.port.js';
import type { IPrivateOperation } from './private-http.js';
import { PrivateHttp } from './private-http.js';

const wallet = 'walletId playerId currency status availableMinor reservedMinor withdrawalHoldMinor version observedAt';

const reservation =
  'betId walletId stake{amountMinor currency} state reservationTransactionId settlementTransactionId settlementSeq grossPayoutMinor';

const financial = 'reservation{' + reservation + '} outcome{requestId state transactionId businessRef wallet{'
  + wallet
  + '} replayed reasonCode}';

const quote = 'quoteId quoteVersion eventId marketId selectionId selection odds validUntil state';

const descriptors: Readonly<Record<string, IPrivateOperation>> = {
  eligibility: {
    verb: 'POST',
    route: '/internal/v1/players/:player_id/eligibility-checks',
    field: 'checkEligibility',
    type: 'PlayerPlayerCheckEligibilityInputInput',
    shape: 'IPlayerCheckEligibilityOutput',
    selection: 'eligibility{allowed reasonCode policyVersion evaluatedAt validUntil playerVersion}',
    mutates: false,
  },
  quote: {
    verb: 'POST',
    route: '/internal/v1/quote-validations',
    field: 'validateSelectionQuote',
    type: 'EventsEventsValidateSelectionQuoteInputInput',
    shape: 'IEventsValidateSelectionQuoteOutput',
    selection: 'acceptedQuote{' + quote + '} evaluatedAt',
    mutates: false,
  },
  event: {
    verb: 'GET',
    route: '/internal/v1/events/:event_id',
    field: 'getEvent',
    type: 'EventsEventsGetEventInputInput',
    shape: 'IEventsGetEventOutput',
    selection: 'event{eventId runId sport homeTeam awayTeam startsAt phase phaseSeq simulatedAt resultRef}',
    mutates: false,
  },
  wallet: {
    verb: 'GET',
    route: '/internal/v1/players/:player_id/wallets/:currency',
    field: 'getWallet',
    type: 'LedgerLedgerGetWalletInputInput',
    shape: 'ILedgerGetWalletOutput',
    selection: 'wallet{' + wallet + '}',
    mutates: false,
  },
  reserve: {
    verb: 'POST',
    route: '/internal/v1/bets/:bet_id/reservations',
    field: 'reserveStake',
    type: 'LedgerLedgerReserveStakeInputInput',
    shape: 'ILedgerReserveStakeOutput',
    selection: financial,
    mutates: true,
  },
  status: {
    verb: 'GET',
    route: '/internal/v1/bets/:bet_id/financial-status',
    field: 'getBetFinancialStatus',
    type: 'LedgerLedgerGetBetFinancialStatusInputInput',
    shape: 'ILedgerGetBetFinancialStatusOutput',
    selection: 'reservation{' + reservation + '} observedAt',
    mutates: false,
  },
  cancel: {
    verb: 'POST',
    route: '/internal/v1/bets/:bet_id/reservation-cancellations',
    field: 'cancelStakeReservation',
    type: 'LedgerLedgerCancelBetInputInput',
    shape: 'ILedgerCancelBetOutput',
    selection: financial,
    mutates: true,
  },
  win: {
    verb: 'POST',
    route: '/internal/v1/bets/:bet_id/settlements/win',
    field: 'settleWin',
    type: 'LedgerLedgerSettleWinInputInput',
    shape: 'ILedgerSettleWinOutput',
    selection: financial,
    mutates: true,
  },
  loss: {
    verb: 'POST',
    route: '/internal/v1/bets/:bet_id/settlements/loss',
    field: 'settleLoss',
    type: 'LedgerLedgerSettleLossInputInput',
    shape: 'ILedgerSettleLossOutput',
    selection: financial,
    mutates: true,
  },
};

function descriptor(name: string): IPrivateOperation {
  const value = descriptors[name];

  if (!value) {
    throw new Error('Unregistered private operation');
  }

  return value;
}

export class PlayerHttpClient implements PlayerEligibilityPort {
  private readonly client: PrivateHttp;

  constructor(settings: IServiceClientSettings, clock: ClockPort) {
    this.client = new PrivateHttp(settings, clock);
  }

  close(): void { }

  check(
    context: M.ICallContext,
    playerId: string,
    capability: M.PlayerCapability,
  ): Promise<
    M.IPlayerCheckEligibilityOutput
  > {
    return this.client.request(
      context,
      { playerId, capability },
      descriptor('eligibility'),
      Output.isIPlayerCheckEligibilityOutput,
    );
  }
}

export class EventsHttpClient implements MarketQuotePort {
  private readonly client: PrivateHttp;

  constructor(settings: IServiceClientSettings, clock: ClockPort) {
    this.client = new PrivateHttp(settings, clock);
  }

  close(): void { }

  validateSelection(
    context: M.ICallContext,
    playerId: string,
    eventId: string,
    marketId: string,
    selectionId: string,
    quoteId: string,
    quoteVersion: bigint,
  ): Promise<M.IEventsValidateSelectionQuoteOutput> {
    return this.client.request(
      context,
      { playerId, eventId, marketId, selectionId, quoteId, quoteVersion },
      descriptor('quote'),
      Output.isIEventsValidateSelectionQuoteOutput,
    );
  }

  getEvent(context: M.ICallContext, eventId: string): Promise<M.IEventsGetEventOutput> {
    return this.client.request(context, { eventId }, descriptor('event'), Output.isIEventsGetEventOutput);
  }
}

export class LedgerHttpClient implements LedgerReservationPort, LedgerSettlementPort {
  private readonly client: PrivateHttp;

  constructor(settings: IServiceClientSettings, clock: ClockPort) {
    this.client = new PrivateHttp(settings, clock);
  }

  close(): void { }

  async reserve(
    context: M.ICallContext,
    requestId: string,
    betId: string,
    playerId: string,
    stake: M.IMoney,
  ): Promise<M.ILedgerReserveStakeOutput> {
    const result = await this.client.request(
      context,
      { playerId, currency: stake.currency },
      descriptor('wallet'),
      Output.isILedgerGetWalletOutput,
    );
    const owned = result.wallet;

    requireRule(
      owned.playerId === playerId && owned.currency === stake.currency
      && owned.status === M.WalletStatus.ACTIVE,
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );
    const output = await this.client.request(
      context,
      { requestId, betId, walletId: owned.walletId, stake },
      descriptor('reserve'),
      Output.isILedgerReserveStakeOutput,
    );

    requireRule(
      output.reservation.betId === betId && output.reservation.walletId === owned.walletId
      && output.reservation.stake.amountMinor === stake.amountMinor
      && output.reservation.stake.currency === stake.currency,
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );

    return output;
  }

  getStatus(context: M.ICallContext, betId: string): Promise<M.ILedgerGetBetFinancialStatusOutput> {
    return this.client.request(
      context,
      { betId },
      descriptor('status'),
      Output.isILedgerGetBetFinancialStatusOutput,
    );
  }

  cancel(
    context: M.ICallContext,
    requestId: string,
    betId: string,
    reasonCode: M.CancellationReason,
  ): Promise<M.ILedgerCancelBetOutput> {
    return this.client.request(
      context,
      { requestId, betId, reasonCode },
      descriptor('cancel'),
      Output.isILedgerCancelBetOutput,
    );
  }

  void(
    context: M.ICallContext,
    requestId: string,
    betId: string,
    reasonCode: M.CancellationReason,
  ): Promise<M.ILedgerCancelBetOutput> {
    return this.cancel(context, requestId, betId, reasonCode);
  }

  settleWin(
    context: M.ICallContext,
    requestId: string,
    betId: string,
    settlementSeq: bigint,
    grossPayout: M.IMoney,
  ): Promise<M.ILedgerSettleWinOutput> {
    return this.client.request(
      context,
      { requestId, betId, settlementSeq, grossPayout },
      descriptor('win'),
      Output.isILedgerSettleWinOutput,
    );
  }

  settleLoss(
    context: M.ICallContext,
    requestId: string,
    betId: string,
    settlementSeq: bigint,
  ): Promise<
    M.ILedgerSettleLossOutput
  > {
    return this.client.request(
      context,
      { requestId, betId, settlementSeq },
      descriptor('loss'),
      Output.isILedgerSettleLossOutput,
    );
  }
}
