import assert from 'node:assert/strict';
import test from 'node:test';

import type { sendUnaryData, ServerUnaryCall } from '@grpc/grpc-js';
import { Server, ServerCredentials, status } from '@grpc/grpc-js';
import * as Events from '@sportsbook/events-client';
import * as Ledger from '@sportsbook/ledger-client';
import * as Player from '@sportsbook/player-client';
import { SignedIdentity } from '@sportsbook/service-transport';

import { EventsGrpcClient } from '../src/adapters/outbound/clients/events-grpc.client.js';
import { protobufOutput as eventsWire } from '../src/adapters/outbound/clients/events-wire.js';
import { LedgerGrpcClient } from '../src/adapters/outbound/clients/ledger-grpc.client.js';
import { protobufOutput as ledgerWire } from '../src/adapters/outbound/clients/ledger-wire.js';
import { PlayerGrpcClient } from '../src/adapters/outbound/clients/player-grpc.client.js';
import { protobufOutput as playerWire } from '../src/adapters/outbound/clients/player-wire.js';
import * as M from '../src/domain/betting.model.js';
import { BettingError } from '../src/domain/betting.policy.js';

test(
  'typed clients resolve owner/currency wallet, delegate signed identity and preserve unknown financial outcome',
  async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const actorId = '00000000-0000-4000-8000-000000000002';
    const now = (): string => new Date().toISOString();
    const clock = { now };
    let absent = false;
    let lost = false;
    const calls: string[] = [];
    const identity = {
      issuer: 'synthetic',
      audience: 'private',
      key: 'test-key-at-least-thirty-two-bytes',
      maximumDeadlineMs: 60000,
    };
    const verify = new SignedIdentity(identity);
    const context: M.ICallContext = {
      operatorId: id,
      actorId: id,
      actorKind: M.ActorKind.SERVICE,
      playerId: id,
      capabilities: [M.Capability.PLACE_BET],
      correlationId: id,
      deadlineAt: new Date(Date.now() + 30000).toISOString(),
    };
    const wallet: M.IWalletView = {
      walletId: id,
      playerId: id,
      currency: 'USD',
      status: M.WalletStatus.ACTIVE,
      availableMinor: 9007199254740993n,
      reservedMinor: 0n,
      withdrawalHoldMinor: 0n,
      version: 1n,
      observedAt: now(),
    };
    let reservation: M.IReservationView = {
      betId: id,
      walletId: id,
      stake: { amountMinor: 9007199254740993n, currency: 'USD' },
      state: M.ReservationState.RESERVED,
      reservationTransactionId: id,
    };
    const server = new Server();

    server.addService(
      Player.PlayerServiceService,
      {
        checkEligibility: (
          call: ServerUnaryCall<Player.CheckEligibilityRequest, Player.CheckEligibilityResponse>,
          done: sendUnaryData<Player.CheckEligibilityResponse>,
        ) => {
          const claims = verify.authenticate(
            call.metadata.get('authorization')[0],
            context.correlationId,
            context.deadlineAt,
          );

          assert.equal(claims.actorId, actorId);
          assert.equal(call.request.playerId, id);
          done(
            null,
            Player.CheckEligibilityResponse.fromJSON(
              playerWire(
                {
                  value: {
                    eligibility: {
                      allowed: true,
                      reasonCode: 'ELIGIBLE',
                      policyVersion: 'TEST',
                      evaluatedAt: now(),
                      validUntil: context.deadlineAt,
                      playerVersion: 9007199254740993n,
                    },
                  },
                },
                'CheckEligibilityResponse',
              ),
            ),
          );
        },
      },
    );
    server.addService(
      Events.EventsServiceService,
      {
        validateSelectionQuote: (
          call: ServerUnaryCall<Events.ValidateSelectionQuoteRequest, Events.ValidateSelectionQuoteResponse>,
          done: sendUnaryData<Events.ValidateSelectionQuoteResponse>,
        ) => {
          assert.equal(call.request.quoteVersion, 9007199254740993n);
          done(
            null,
            Events.ValidateSelectionQuoteResponse.fromJSON(
              eventsWire(
                {
                  value: {
                    acceptedQuote: {
                      quoteId: id,
                      quoteVersion: 9007199254740993n,
                      eventId: id,
                      marketId: id,
                      selectionId: id,
                      selection: 'HOME',
                      odds: '2.12345678',
                      validUntil: context.deadlineAt,
                      state: 'OPEN',
                    },
                    evaluatedAt: now(),
                  },
                },
                'ValidateSelectionQuoteResponse',
              ),
            ),
          );
        },
      },
    );
    server.addService(
      Ledger.LedgerServiceService,
      {
        getWallet: (
          call: ServerUnaryCall<Ledger.GetWalletRequest, Ledger.GetWalletResponse>,
          done: sendUnaryData<Ledger.GetWalletResponse>,
        ) => {
          calls.push('wallet');
          assert.equal(call.request.playerId, id);
          assert.equal(call.request.currency, 'USD');
          const claims = verify.authenticate(
            call.metadata.get('authorization')[0],
            context.correlationId,
            context.deadlineAt,
          );

          assert.equal(claims.actorId, actorId);
          assert.equal(claims.playerId, id);

          if (absent) {
            done(
              {
                code: status.NOT_FOUND,
                details: JSON.stringify({ code: 'NOT_FOUND', outcomeUnknown: false }),
              },
            );

            return;
          }
          done(
            null,
            Ledger.GetWalletResponse.fromJSON(ledgerWire({ value: { wallet } }, 'GetWalletResponse')),
          );
        },
        reserveStake: (
          call: ServerUnaryCall<Ledger.ReserveStakeRequest, Ledger.ReserveStakeResponse>,
          done: sendUnaryData<Ledger.ReserveStakeResponse>,
        ) => {
          calls.push('reserve');
          assert.equal(call.request.walletId, id);
          assert.equal(call.request.stake?.amountMinor, 9007199254740993n);
          reservation =
            {
              ...reservation,
              stake: { amountMinor: call.request.stake?.amountMinor ?? 0n, currency: 'USD' },
            };

          if (lost) {
            lost = false;
            done({ code: status.UNAVAILABLE, details: 'Synthetic reply lost after commit' });

            return;
          }
          done(
            null,
            Ledger.ReserveStakeResponse.fromJSON(
              ledgerWire(
                {
                  value: {
                    reservation,
                    outcome: {
                      requestId: call.request.requestId,
                      state: 'COMPLETED',
                      transactionId: id,
                      businessRef: id,
                      wallet,
                      replayed: false,
                    },
                  },
                },
                'ReserveStakeResponse',
              ),
            ),
          );
        },
        getBetFinancialStatus: (
          _call: ServerUnaryCall<Ledger.GetBetFinancialStatusRequest, Ledger.GetBetFinancialStatusResponse>,
          done: sendUnaryData<Ledger.GetBetFinancialStatusResponse>,
        ) =>
          done(
            null,
            Ledger.GetBetFinancialStatusResponse.fromJSON(
              ledgerWire({ value: { reservation, observedAt: now() } }, 'GetBetFinancialStatusResponse'),
            ),
          ),
      },
    );
    const port = await new Promise<number>(
      (resolve, reject) =>
        server.bindAsync(
          '127.0.0.1:0',
          ServerCredentials.createInsecure(),
          (error, port) => error ? reject(error) : resolve(port),
        ),
    );
    const settings = {
      ...identity,
      endpoint: '127.0.0.1:' + port,
      tls: false,
      actorId,
      operators: [id],
      capabilities: ['READ_WALLET', 'RESERVE_STAKE', 'EVALUATE_ELIGIBILITY', 'QUOTE_VALIDATE'],
      timeoutMs: 30000,
    };
    const player = new PlayerGrpcClient(settings, clock);
    const events = new EventsGrpcClient(settings, clock);
    const ledger = new LedgerGrpcClient(settings, clock);

    try {
      assert.equal(
        (await player.check(context, id, M.PlayerCapability.PLACE_BET)).eligibility.playerVersion,
        9007199254740993n,
      );
      assert.equal(
        (await events.validateSelection(context, id, id, id, id, id, 9007199254740993n)).acceptedQuote.odds,
        '2.12345678',
      );
      assert.equal(
        (await ledger.reserve(
          context,
          id,
          id,
          id,
          {
            amountMinor:
              9007199254740993n,
            currency:
              'USD',
          },
        )).reservation.stake.amountMinor,
        9007199254740993n,
      );
      assert.deepEqual(calls, ['wallet', 'reserve']);
      absent = true;
      await assert.rejects(
        ledger.reserve(context, id, id, id, { amountMinor: 1n, currency: 'USD' }),
        error => error instanceof BettingError && error.code === M.ErrorCode.NOT_FOUND,
      );
      assert.deepEqual(calls, ['wallet', 'reserve', 'wallet']);
      absent = false;
      lost = true;
      await assert.rejects(
        ledger.reserve(context, id, id, id, { amountMinor: 9007199254740993n, currency: 'USD' }),
        error => error instanceof BettingError && error.outcomeUnknown,
      );
      assert.equal(
        (await ledger.getStatus(context, id)).reservation?.state,
        M.ReservationState.RESERVED,
      );
    } finally {
      player.close();
      events.close();
      ledger.close();
      await new Promise<void>(resolve => server.tryShutdown(() => resolve()));
    }
  },
);
