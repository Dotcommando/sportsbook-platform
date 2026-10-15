import * as M from '../src/domain/gateway.model.js';
import type { IGatewayClients } from '../src/infra/gateway-application.factory.js';
import { createGatewayApplication } from '../src/infra/gateway-application.factory.js';
import type { IGatewayOperationPorts } from '../src/ports/inbound/gateway-application.port.js';

export interface IGatewayFixture {
  id(): string;
  context: M.ICallContext;
  settings: M.IGatewayOperatorSettings[];
  profile: M.IProfile;
  wallet: M.IWalletView;
  bet: M.IBetView;
  event: M.IEvent;
  eligibility: M.IEligibility;
  clients: IGatewayClients;
  operations: IGatewayOperationPorts;
  place: M.IGatewayPlaceBetInput;
  calls: { method: string; input: unknown }[];
  now: string;
  clock: { now(): string };
  ids: { derive(operator: string, request: string, purpose: string): string };
  registrationActor: string;
  withdrawal: M.IWithdrawalView;
}

export function gatewayFixture(instant = '2026-10-15T12:00:00.000Z'): IGatewayFixture {
  let sequence = 1;
  const id = (): string => '00000000-0000-4000-8000-' + String(sequence++).padStart(12, '0');
  const operatorId = id();
  const playerId = id();
  const registrationActor = id();
  const walletId = id();
  const eventId = id();
  const marketId = id();
  const selectionId = id();
  const quoteId = id();
  const betId = id();
  const withdrawalId = id();
  const now = instant;
  const clock = { now: () => now };
  const context: M.ICallContext = {
    operatorId,
    actorId: playerId,
    actorKind: M.ActorKind.PLAYER,
    playerId,
    capabilities: Object.values(M.Capability),
    correlationId: id(),
    deadlineAt: new Date(Date.parse(now) + 60000).toISOString(),
  };
  const settings: M.IGatewayOperatorSettings[] = [
    {
      operatorId,
      currencies: ['USD'],
      syntheticProvider: 'synthetic',
      trustedRegistrationActors: [{ actorId: registrationActor, actorKind: M.ActorKind.SYSTEM }],
    },
  ];
  const profile: M.IProfile = {
    playerId,
    status: M.PlayerStatus.ACTIVE,
    locale: 'en-US',
    timeZone: 'UTC',
    version: 1n,
    createdAt: now,
    updatedAt: now,
  };
  const wallet: M.IWalletView = {
    walletId,
    playerId,
    currency: 'USD',
    status: M.WalletStatus.ACTIVE,
    availableMinor: 30000000000000000n,
    reservedMinor: 0n,
    withdrawalHoldMinor: 0n,
    version: 1n,
    observedAt: now,
  };
  const quote: M.IQuote = {
    quoteId,
    quoteVersion: 1n,
    eventId,
    marketId,
    selectionId,
    selection: M.Selection.HOME,
    odds: '2.00000000',
    validUntil: new Date(Date.parse(now) + 3600000).toISOString(),
    state: M.MarketState.OPEN,
  };
  const bet: M.IBetView = {
    betId,
    playerId,
    type: M.BetType.SINGLE,
    status: M.BetStatus.ACCEPTED,
    stake: { amountMinor: 9007199254740993n, currency: 'USD' },
    potentialPayoutMinor: 18014398509481986n,
    legs: [
      { legId: id(), legNo: 1, eventId, marketId, selectionId, quote, state: M.BetLegState.PENDING },
    ],
    createdAt: now,
    acceptedAt: now,
    version: 1n,
  };
  const event: M.IEvent = {
    eventId,
    runId: id(),
    sport: M.Sport.FOOTBALL,
    homeTeam: 'Home',
    awayTeam: 'Away',
    startsAt: now,
    phase: M.EventPhase.PRE_MATCH,
    phaseSeq: 1n,
    simulatedAt: now,
  };
  const eligibility: M.IEligibility = {
    allowed: true,
    reasonCode: M.EligibilityReason.ELIGIBLE,
    policyVersion: 'synthetic-v1',
    evaluatedAt: now,
    validUntil: new Date(Date.parse(now) + 3600000).toISOString(),
    playerVersion: 1n,
  };
  const calls: { method: string; input: unknown }[] = [];
  const record = (method: string, input: unknown): void => {
    calls.push({ method, input: structuredClone(input) });
  };
  const ok = <T>(value: T): M.IResult<T> => ({ ok: true, value });
  const outcome = (requestId: string): M.IFinancialOutcome =>
    ({
      requestId,
      state: M.FinancialOutcomeState.COMPLETED,
      transactionId: id(),
      businessRef: walletId,
      wallet,
      replayed: false,
    });
  const withdrawal: M.IWithdrawalView = {
    withdrawalId,
    walletId,
    amount: { amountMinor: 101n, currency: 'USD' },
    state: M.WithdrawalState.HELD,
    holdTransactionId: id(),
    createdAt: now,
  };
  const clients: IGatewayClients = {
    playerCommand: {
      register: async input => {
        record('players.register', input);

        return ok({ profile, created: true });
      },
      updateProfile: async input => {
        record('players.update', input);

        return ok({ profile: { ...profile, ...input.patch, version: 2n } });
      },
    },
    playerQuery: {
      getProfile: async input => {
        record('players.profile', input);

        return ok({ profile, contacts: [] });
      },
      checkEligibility: async input => {
        record('players.eligibility', input);

        return ok({ eligibility });
      },
    },
    walletQuery: {
      getWallet: async input => {
        record('wallet.get', input);

        return ok({ wallet });
      },
      getWithdrawal: async input => {
        record('wallet.withdrawal', input);

        return ok({ withdrawal });
      },
      listTransactions: async input => {
        record('wallet.history', input);

        return ok({ transactions: [], observedAt: now });
      },
    },
    walletCommand: {
      deposit: async input => {
        record('wallet.deposit', input);

        return ok({ outcome: outcome(input.requestId) });
      },
      requestWithdrawal: async input => {
        record('wallet.request', input);

        return ok(
          {
            withdrawal: { ...withdrawal, withdrawalId: input.withdrawalId, amount: input.amount },
            outcome: outcome(input.requestId),
          },
        );
      },
    },
    betCommand: {
      place: async input => {
        record('bets.place', input);

        return ok({ bet, outcome: M.PlaceOutcome.ACCEPTED });
      },
      cancel: async input => {
        record('bets.cancel', input);

        return ok({ bet: { ...bet, status: M.BetStatus.CANCELED }, outcome: M.CancelOutcome.CANCELED });
      },
    },
    betQuery: {
      get: async input => {
        record('bets.get', input);

        return ok({ bet });
      },
      status: async input => {
        record('bets.status', input);

        return ok(
          {
            betId,
            status: M.BetStatus.ACCEPTED,
            financialState: M.FinancialState.RESERVED,
            version: 1n,
            observedAt: now,
          },
        );
      },
      list: async input => {
        record('bets.list', input);

        return ok({ bets: [bet], observedAt: now });
      },
    },
    eventCatalog: {
      listEvents: async input => {
        record('events.list', input);

        return ok({ events: [event], observedAt: now });
      },
      getEvent: async input => {
        record('events.get', input);

        return ok({ event });
      },
      listMarkets: async input => {
        record('events.markets', input);

        return ok(
          {
            markets: [
              {
                marketId,
                eventId,
                type: M.MarketType.MATCH_RESULT,
                state: M.MarketState.OPEN,
                selections: [quote],
              },
            ],
            observedAt: now,
          },
        );
      },
    },
  };
  const ids = {
    derive: (operator: string, request: string, purpose: string): string => {
      record('ids.derive', { operator, request, purpose });

      return withdrawalId;
    },
  };
  const operations = createGatewayApplication(settings, clock, ids, clients);
  const place = {
    context,
    requestId: id(),
    type: M.BetType.SINGLE,
    stake: bet.stake,
    selection: { eventId, marketId, selectionId, quoteId, quoteVersion: 1n },
  };

  return {
    id,
    context,
    settings,
    profile,
    wallet,
    bet,
    event,
    eligibility,
    clients,
    operations,
    place,
    calls,
    now,
    clock,
    ids,
    registrationActor,
    withdrawal,
  };
}
