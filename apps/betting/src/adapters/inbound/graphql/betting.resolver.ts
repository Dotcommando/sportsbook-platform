import type { GraphQLResolverMap } from '@apollo/subgraph';
import { Controller, Inject, Post, Req, Res } from '@nestjs/common';
import type { IGraphqlSettings } from '@sportsbook/service-transport';
import { businessGraphqlError, FederationBoundary, jsonWire, objectValue } from '@sportsbook/service-transport';
import { GraphQLScalarType, Kind } from 'graphql';

import { BETTING_BOUNDARY, BETTING_GRAPHQL_SETTINGS } from '../../../infra/betting-transport.tokens.js';
import type { IRestRequest, IRestResponse } from '../rest/betting-rest.controller.js';
import type { ITransportHeaders } from '../shared/betting-boundary.js';
import { BettingBoundary } from '../shared/betting-boundary.js';

export const bettingSdl = 'extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])\nscalar BettingSavedOutcome\ntype Player @key(fields: "operatorId playerId") {operatorId: String! playerId: String! bets(limit:Int!,cursor:String):BettingBettingListPlayerBetsOutput!}\ntype Event @key(fields: "operatorId eventId", resolvable: false) {operatorId:String! eventId:String!}\ninput BettingBettingPlaceBetInputInput { requestId: String! playerId: String! stake: BettingMoneyInput! type: BettingBetType! selection: BettingShape4Input! }\ninput BettingMoneyInput { amountMinor: String! currency: String! }\nenum BettingBetType { SINGLE }\ninput BettingShape4Input { eventId: String! marketId: String! selectionId: String! quoteId: String! quoteVersion: String! }\ntype BettingBettingPlaceBetOutput { bet: Bet! outcome: BettingPlaceOutcome! }\ntype Bet @key(fields: "operatorId betId") { operatorId: String! player: Player! event: Event! betId: String! playerId: String! type: BettingBetType! status: BettingBetStatus! stake: BettingMoney! potentialPayoutMinor: String! actualPayoutMinor: String legs: [BettingBetLeg!]! createdAt: String! acceptedAt: String settledAt: String reasonCode: BettingErrorCode version: String! }\nenum BettingBetStatus { PENDING_RESERVATION ACCEPTED REJECTED SETTLEMENT_PENDING WON LOST VOID CANCELED }\ntype BettingMoney { amountMinor: String! currency: String! }\ntype BettingBetLeg { legId: String! legNo: Int! eventId: String! marketId: String! selectionId: String! quote: BettingQuote state: BettingBetLegState! resultRef: String }\ntype BettingQuote { quoteId: String! quoteVersion: String! eventId: String! marketId: String! selectionId: String! selection: BettingSelection! odds: String! validUntil: String! state: BettingMarketState! }\nenum BettingSelection { HOME DRAW AWAY }\nenum BettingMarketState { OPEN SUSPENDED CLOSED }\nenum BettingBetLegState { PENDING WON LOST VOID }\nenum BettingErrorCode { INVALID_INPUT AMOUNT_OUT_OF_RANGE CURRENCY_MISMATCH UNAUTHENTICATED PERMISSION_DENIED NOT_FOUND IDEMPOTENCY_CONFLICT VERSION_CONFLICT INSUFFICIENT_FUNDS INELIGIBLE STALE_QUOTE MARKET_CLOSED INVALID_STATE IN_PROGRESS OVERLOADED DEADLINE_EXCEEDED DEPENDENCY_UNAVAILABLE ADAPTER_CONTRACT_VIOLATION INVARIANT_VIOLATION }\nenum BettingPlaceOutcome { ACCEPTED REJECTED PENDING }\ninput BettingBettingGetBetInputInput { betId: String! playerId: String! }\ntype BettingBettingGetBetOutput { bet: Bet! }\ninput BettingBettingListPlayerBetsInputInput { playerId: String! page: BettingPageInputInput! status: BettingBetStatus }\ninput BettingPageInputInput { limit: Int! cursor: String from: String to: String }\ntype BettingBettingListPlayerBetsOutput { bets: [Bet!]! nextCursor: String observedAt: String! }\ninput BettingBettingGetBetStatusInputInput { playerId: String! betId: String! }\ntype BettingBettingGetBetStatusOutput { betId: String! status: BettingBetStatus! financialState: BettingFinancialState! version: String! observedAt: String! }\nenum BettingFinancialState { UNCONFIRMED RESERVED SETTLED REFUNDED }\ninput BettingBettingCancelBetInputInput { requestId: String! playerId: String! betId: String! expectedVersion: String! }\ntype BettingBettingCancelBetOutput { bet: Bet! outcome: BettingCancelOutcome! }\nenum BettingCancelOutcome { CANCELED PENDING }\ninput BettingBettingRecordEventResultInputInput { envelope: BettingEventEnvelopeInput! result: BettingEventResultInput! }\ninput BettingEventEnvelopeInput { messageId: String! source: BettingEventSource! eventType: BettingEventType! schemaVersion: Int! operatorId: String! correlationId: String! occurredAt: String! payload: BettingSavedOutcome! }\nenum BettingEventSource { EVENTS BETTING }\nenum BettingEventType { EVENT_RESULT BET_STATE_CHANGED }\ninput BettingEventResultInput { resultId: String! eventId: String! runId: String! resultSeq: String! homeGoals: Int! awayGoals: Int! outcome: BettingResultOutcome! occurredAt: String! }\nenum BettingResultOutcome { HOME DRAW AWAY VOID }\ntype BettingBettingRecordEventResultOutput { accepted: Boolean! duplicate: Boolean! sweepId: String! }\ninput BettingBettingSettleBetInputInput { requestId: String! betId: String! resultId: String! settlementSeq: String! }\ntype BettingBettingSettleBetOutput { bet: Bet! outcome: BettingSettleOutcome! }\nenum BettingSettleOutcome { SETTLED PENDING }\ninput BettingBettingRetryPendingReservationInputInput { batchId: String! page: BettingPageInputInput! pendingBefore: String! }\ntype BettingBettingRetryPendingReservationOutput { report: BettingBatchReport! }\ntype BettingBatchReport { selected: Int! applied: Int! replayed: Int! rejected: Int! pending: Int! failed: Int! nextCursor: String }\ninput BettingBettingRetryPendingSettlementInputInput { batchId: String! page: BettingPageInputInput! pendingBefore: String! }\ntype BettingBettingRetryPendingSettlementOutput { report: BettingBatchReport! }\ninput BettingBettingReconcileBetWithLedgerInputInput { requestId: String! runId: String! page: BettingPageInputInput! cutoff: String! }\ntype BettingBettingReconcileBetWithLedgerOutput { report: BettingReconciliationReport! }\ntype BettingReconciliationReport { runId: String! snapshotAt: String! status: BettingReconciliationStatus! counts: BettingShape46! violations: [BettingShape47!]! nextCursor: String }\nenum BettingReconciliationStatus { PASS FAIL }\ntype BettingShape46 { transactions: String! entries: String! violations: String! }\ntype BettingShape47 { code: String! businessRef: String }\ninput BettingBettingRetryPendingCancellationInputInput { batchId: String! page: BettingPageInputInput! pendingBefore: String! }\ntype BettingBettingRetryPendingCancellationOutput { report: BettingBatchReport! }\ntype Query { getBet(input: BettingBettingGetBetInputInput!): BettingBettingGetBetOutput! listPlayerBets(input: BettingBettingListPlayerBetsInputInput!): BettingBettingListPlayerBetsOutput! getBetStatus(input: BettingBettingGetBetStatusInputInput!): BettingBettingGetBetStatusOutput! }\ntype Mutation { placeBet(input: BettingBettingPlaceBetInputInput!): BettingBettingPlaceBetOutput! cancelBet(input: BettingBettingCancelBetInputInput!): BettingBettingCancelBetOutput! recordEventResult(input: BettingBettingRecordEventResultInputInput!): BettingBettingRecordEventResultOutput! settleBet(input: BettingBettingSettleBetInputInput!): BettingBettingSettleBetOutput! retryPendingReservation(input: BettingBettingRetryPendingReservationInputInput!): BettingBettingRetryPendingReservationOutput! retryPendingSettlement(input: BettingBettingRetryPendingSettlementInputInput!): BettingBettingRetryPendingSettlementOutput! reconcileBetWithLedger(input: BettingBettingReconcileBetWithLedgerInputInput!): BettingBettingReconcileBetWithLedgerOutput! retryPendingCancellation(input: BettingBettingRetryPendingCancellationInputInput!): BettingBettingRetryPendingCancellationOutput! }\n';

export class BettingResolver {
  constructor(private readonly boundary: BettingBoundary) { }

  async call(operation: string, args: unknown, context: unknown): Promise<unknown> {
    const fields = objectValue(args);
    const headers = headerValues(context);
    const result = await this.boundary.execute(operation, fields.input, headers);

    if (!result.ok) {
      throw businessGraphqlError(result.error);
    }

    return jsonWire(result.value);
  }

  async resolveReference(reference: unknown, context: unknown): Promise<unknown> {
    const key = objectValue(reference);
    const headers = headerValues(context);
    const trusted = this.boundary.context(headers);

    if (key.operatorId !== trusted.operatorId) {
      throw businessGraphqlError({ code: 'NOT_FOUND' });
    }

    const result = await this.boundary.execute('GetBet', { betId: key.betId, playerId: trusted.playerId }, headers);

    if (!result.ok) {
      throw businessGraphqlError(result.error);
    }

    return jsonWire(objectValue(result.value).bet);
  }

  resolvers(): GraphQLResolverMap<unknown> {
    return {
      Query: {
        getBet: (_parent: unknown, args: unknown, context: unknown) => this.call('GetBet', args, context),
        listPlayerBets: (_parent: unknown, args: unknown, context: unknown) =>
          this.call('ListPlayerBets', args, context),
        getBetStatus: (_parent: unknown, args: unknown, context: unknown) => this.call('GetBetStatus', args, context),
      },
      Mutation: {
        placeBet: (_parent: unknown, args: unknown, context: unknown) => this.call('PlaceBet', args, context),
        cancelBet: (_parent: unknown, args: unknown, context: unknown) => this.call('CancelBet', args, context),
        recordEventResult: (_parent: unknown, args: unknown, context: unknown) =>
          this.call('RecordEventResult', args, context),
        settleBet: (_parent: unknown, args: unknown, context: unknown) => this.call('SettleBet', args, context),
        retryPendingReservation: (_parent: unknown, args: unknown, context: unknown) =>
          this.call('RetryPendingReservation', args, context),
        retryPendingSettlement: (_parent: unknown, args: unknown, context: unknown) =>
          this.call('RetryPendingSettlement', args, context),
        reconcileBetWithLedger: (_parent: unknown, args: unknown, context: unknown) =>
          this.call('ReconcileBetWithLedger', args, context),
        retryPendingCancellation: (_parent: unknown, args: unknown, context: unknown) =>
          this.call('RetryPendingCancellation', args, context),
      },
      Bet: {
        __resolveReference: (reference: unknown, context: unknown) => this.resolveReference(reference, context),
        operatorId: (_parent: unknown, _args: unknown, context: unknown) =>
          this.boundary.context(headerValues(context)).operatorId,
        player: (parent: unknown, _args: unknown, context: unknown) =>
          ({
            __typename: 'Player',
            operatorId: this.boundary.context(headerValues(context)).operatorId,
            playerId: objectValue(parent).playerId,
          }),
        event: (parent: unknown, _args: unknown, context: unknown) =>
          ({
            __typename: 'Event',
            operatorId: this.boundary.context(headerValues(context)).operatorId,
            eventId: eventIdOf(parent),
          }),
      },
      Player: {
        __resolveReference: (reference: unknown, context: unknown) => {
          const fields = objectValue(reference);

          if (fields.operatorId !== this.boundary.context(headerValues(context)).operatorId) {
            throw businessGraphqlError({ code: 'NOT_FOUND' });
          }

          return fields;
        },
        bets: (parent: unknown, args: unknown, context: unknown) =>
          this.call(
            'ListPlayerBets',
            {
              input: {
                playerId: objectValue(parent).playerId,
                page: {
                  limit: objectValue(args).limit,
                  ...(objectValue(args).cursor === undefined ? {} : { cursor: objectValue(args).cursor }),
                },
              },
            },
            context,
          ),
      },
      BettingSavedOutcome: new GraphQLScalarType(
        {
          name: 'BettingSavedOutcome',
          serialize: value => jsonWire(value),
          parseValue: () => {
            throw new Error('Output scalar');
          },
          parseLiteral: node => {
            if (node.kind !== Kind.NULL) {
              throw new Error('Output scalar');
            }

            return null;
          },
        },
      ),
    };
  }
}

function eventIdOf(parent: unknown): unknown {
  const legs = objectValue(parent).legs;

  return objectValue(Array.isArray(legs) ? legs[0] : undefined).eventId;
}

function headerValues(context: unknown): ITransportHeaders {
  const headers = objectValue(context);

  return {
    traceparent: headers.traceparent,
    tracestate: headers.tracestate,
    authorization: headers.authorization,
    correlationId: headers.correlationId,
    deadlineAt: headers.deadlineAt,
  };
}

@Controller()
export class BettingGraphqlController {
  private readonly federation: FederationBoundary;

  constructor(
    @Inject(BETTING_BOUNDARY)
    private readonly boundary: BettingBoundary,
    @Inject(BETTING_GRAPHQL_SETTINGS)
    settings: IGraphqlSettings,
  ) {
    this.federation =
      new FederationBoundary(bettingSdl, new BettingResolver(boundary).resolvers(), settings);
  }

  @Post('/internal/graphql')
  async execute(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const headers = {
      traceparent: request.headers.traceparent,
      tracestate: request.headers.tracestate,
      authorization: request.headers.authorization,
      correlationId: request.headers['x-correlation-id'],
      deadlineAt: request.headers['x-deadline-at'],
    };

    try {
      this.boundary.context(headers);
    } catch {
      return response.status(401).json(
        {
          errors: [
            {
              message: 'UNAUTHENTICATED',
              extensions: { code: 'UNAUTHENTICATED', retryable: false, outcomeUnknown: false },
            },
          ],
        },
      );
    }

    return response.status(200).json(await this.federation.execute(request.body, headers));
  }
}
