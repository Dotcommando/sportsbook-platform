import 'reflect-metadata';

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';

import type { INestApplication } from '@nestjs/common';
import type { IIdentitySettings, IPrivateHost, IServiceClientSettings } from '@sportsbook/service-transport';
import { jsonWire, objectValue, ServiceProtocol } from '@sportsbook/service-transport';

import * as bettingOutput from '../../betting/src/adapters/inbound/shared/betting.dto.js';
import * as bettingModel from '../../betting/src/domain/betting.model.js';
import { startBettingTransports } from '../../betting/src/infra/betting-transport.module.js';
import type { IBettingOperationPorts } from '../../betting/src/ports/inbound/betting-application.port.js';
import * as eventsOutput from '../../event-simulator/src/adapters/inbound/shared/events.dto.js';
import * as eventsModel from '../../event-simulator/src/domain/events.model.js';
import { startEventsTransports } from '../../event-simulator/src/infra/events-transport.module.js';
import type { IEventsOperationPorts } from '../../event-simulator/src/ports/inbound/events-application.port.js';
import * as ledgerOutput from '../../ledger/src/adapters/inbound/shared/ledger.dto.js';
import * as ledgerModel from '../../ledger/src/domain/ledger.model.js';
import { startLedgerTransports } from '../../ledger/src/infra/ledger-transport.module.js';
import type { ILedgerOperationPorts } from '../../ledger/src/ports/inbound/ledger-application.port.js';
import * as playerOutput from '../../player/src/adapters/inbound/shared/player.dto.js';
import * as playerModel from '../../player/src/domain/player.model.js';
import { startPlayerTransports } from '../../player/src/infra/player-transport.module.js';
import type { IPlayerOperationPorts } from '../../player/src/ports/inbound/player-application.port.js';
import * as M from '../src/domain/gateway.model.js';
import { createGatewayApplication } from '../src/infra/gateway-application.factory.js';
import { createGatewayClients } from '../src/infra/gateway-client.factory.js';
import { startGatewayRest } from '../src/infra/gateway-transport.module.js';
import * as betsDto from '../src/modules/bets/adapters/outbound/clients/bets-client.dto.js';
import * as eventsDto from '../src/modules/events/adapters/outbound/clients/events-client.dto.js';
import * as playersDto from '../src/modules/players/adapters/outbound/clients/players-client.dto.js';
import * as walletDto from '../src/modules/wallet/adapters/outbound/clients/wallet-client.dto.js';
import type { IGatewayFixture } from './gateway.fixture.js';
import { gatewayFixture } from './gateway.fixture.js';

export interface IContractEnvironment {
  fixture: IGatewayFixture;
  hosts: Record<string, IPrivateHost>;
  grpcPorts: Record<string, number>;
  publicIdentity: IIdentitySettings;
  privateIdentity: IIdentitySettings;
  delegations: unknown[];
  serviceActor: string;
  close(): Promise<void>;
}

export async function contractEnvironment(
  bindHost = '127.0.0.1',
  quoteValidation?: IEventsOperationPorts['validateSelectionQuote'],
): Promise<IContractEnvironment> {
  const f = gatewayFixture(new Date().toISOString());
  const hosts: Record<string, IPrivateHost> = {};
  const grpcPorts: Record<string, number> = {};
  const serviceActor = f.id();
  const delegations: unknown[] = [];
  const privateIdentity = {
    issuer: 'private-test',
    audience: 'private-test',
    key: 'p'.repeat(32),
    maximumDeadlineMs: 60000,
  };
  const publicIdentity = {
    issuer: 'public-test',
    audience: 'public-test',
    key: 'u'.repeat(32),
    maximumDeadlineMs: 60000,
  };

  async function dispatch(key: string, raw: unknown): Promise<unknown> {
    const fields = objectValue(raw);
    const context = objectValue(fields.context);

    delegations.push(context);
    assert.equal(context.actorId, serviceActor);
    assert.equal(context.actorKind, 'SERVICE');
    assert.equal(context.operatorId, f.context.operatorId);
    assert.equal(context.playerId, f.context.playerId);

    switch (key) {
      case 'player.RegisterPlayer': {
        const input = playersDto.decodeInput('IPlayerRegisterPlayerInput', jsonWire(raw));

        assert.ok(playersDto.isIPlayerRegisterPlayerInput(input));

        return f.clients.playerCommand.register(input);
      }
      case 'player.UpdatePlayerProfile': {
        const input = playersDto.decodeInput('IPlayerUpdatePlayerProfileInput', jsonWire(raw));

        assert.ok(playersDto.isIPlayerUpdatePlayerProfileInput(input));

        return f.clients.playerCommand.updateProfile(input);
      }
      case 'player.GetPlayer': {
        const input = playersDto.decodeInput('IPlayerGetPlayerInput', jsonWire(raw));

        assert.ok(playersDto.isIPlayerGetPlayerInput(input));

        return f.clients.playerQuery.getProfile(input);
      }
      case 'player.CheckEligibility': {
        const input = playersDto.decodeInput('IPlayerCheckEligibilityInput', jsonWire(raw));

        assert.ok(playersDto.isIPlayerCheckEligibilityInput(input));

        return f.clients.playerQuery.checkEligibility(input);
      }
      case 'ledger.DepositTestFunds': {
        const input = walletDto.decodeInput('ILedgerDepositTestFundsInput', jsonWire(raw));

        assert.ok(walletDto.isILedgerDepositTestFundsInput(input));

        return f.clients.walletCommand.deposit(input);
      }
      case 'ledger.RequestWithdrawal': {
        const input = walletDto.decodeInput('ILedgerRequestWithdrawalInput', jsonWire(raw));

        assert.ok(walletDto.isILedgerRequestWithdrawalInput(input));

        return f.clients.walletCommand.requestWithdrawal(input);
      }
      case 'ledger.GetWallet': {
        const input = walletDto.decodeInput('ILedgerGetWalletInput', jsonWire(raw));

        assert.ok(walletDto.isILedgerGetWalletInput(input));

        return f.clients.walletQuery.getWallet(input);
      }
      case 'ledger.GetWithdrawal': {
        const input = walletDto.decodeInput('ILedgerGetWithdrawalInput', jsonWire(raw));

        assert.ok(walletDto.isILedgerGetWithdrawalInput(input));

        return f.clients.walletQuery.getWithdrawal(input);
      }
      case 'ledger.GetWalletTransactions': {
        const input = walletDto.decodeInput('ILedgerGetWalletTransactionsInput', jsonWire(raw));

        assert.ok(walletDto.isILedgerGetWalletTransactionsInput(input));

        return f.clients.walletQuery.listTransactions(input);
      }
      case 'betting.PlaceBet': {
        const input = betsDto.decodeInput('IBettingPlaceBetInput', jsonWire(raw));

        assert.ok(betsDto.isIBettingPlaceBetInput(input));

        return f.clients.betCommand.place(input);
      }
      case 'betting.CancelBet': {
        const input = betsDto.decodeInput('IBettingCancelBetInput', jsonWire(raw));

        assert.ok(betsDto.isIBettingCancelBetInput(input));

        return f.clients.betCommand.cancel(input);
      }
      case 'betting.GetBet': {
        const input = betsDto.decodeInput('IBettingGetBetInput', jsonWire(raw));

        assert.ok(betsDto.isIBettingGetBetInput(input));

        return f.clients.betQuery.get(input);
      }
      case 'betting.GetBetStatus': {
        const input = betsDto.decodeInput('IBettingGetBetStatusInput', jsonWire(raw));

        assert.ok(betsDto.isIBettingGetBetStatusInput(input));

        return f.clients.betQuery.status(input);
      }
      case 'betting.ListPlayerBets': {
        const input = betsDto.decodeInput('IBettingListPlayerBetsInput', jsonWire(raw));

        assert.ok(betsDto.isIBettingListPlayerBetsInput(input));

        return f.clients.betQuery.list(input);
      }
      case 'events.ListEvents': {
        const input = eventsDto.decodeInput('IEventsListEventsInput', jsonWire(raw));

        assert.ok(eventsDto.isIEventsListEventsInput(input));

        return f.clients.eventCatalog.listEvents(input);
      }
      case 'events.GetEvent': {
        const input = eventsDto.decodeInput('IEventsGetEventInput', jsonWire(raw));

        assert.ok(eventsDto.isIEventsGetEventInput(input));

        return f.clients.eventCatalog.getEvent(input);
      }
      case 'events.GetMarkets': {
        const input = eventsDto.decodeInput('IEventsGetMarketsInput', jsonWire(raw));

        assert.ok(eventsDto.isIEventsGetMarketsInput(input));

        return f.clients.eventCatalog.listMarkets(input);
      }
      default: return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'NOT_FOUND',
          correlationId: f.context.correlationId,
          retryable: false,
          outcomeUnknown: false,
        },
      };
    }
  }
  const ledgerReject = async (): Promise<{
    ok: false;
    error: ledgerModel.IError;
  }> =>
    ({
      ok: false,
      error: {
        code: ledgerModel.ErrorCode.NOT_FOUND,
        message: 'NOT_FOUND',
        correlationId: f.context.correlationId,
        retryable: false,
        outcomeUnknown: false,
      },
    });
  const ledgerOperations: ILedgerOperationPorts = {
    createWallet: { execute: ledgerReject },
    depositTestFunds: {
      execute: async (input) => {
        const response = objectValue(await dispatch('ledger.DepositTestFunds', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(ledgerModel.ErrorCode).find(c => c === error.code)
            ?? ledgerModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = ledgerOutput.decodeInput('ILedgerDepositTestFundsOutput', jsonWire(response.value), false);

        assert.ok(ledgerOutput.isILedgerDepositTestFundsOutput(output));

        return { ok: true, value: output };
      },
    },
    requestWithdrawal: {
      execute: async (input) => {
        const response = objectValue(await dispatch('ledger.RequestWithdrawal', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(ledgerModel.ErrorCode).find(c => c === error.code)
            ?? ledgerModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = ledgerOutput.decodeInput('ILedgerRequestWithdrawalOutput', jsonWire(response.value), false);

        assert.ok(ledgerOutput.isILedgerRequestWithdrawalOutput(output));

        return { ok: true, value: output };
      },
    },
    completeWithdrawal: { execute: ledgerReject },
    rejectWithdrawal: { execute: ledgerReject },
    reserveStake: { execute: ledgerReject },
    settleWin: { execute: ledgerReject },
    settleLoss: { execute: ledgerReject },
    cancelBet: { execute: ledgerReject },
    getBalance: { execute: ledgerReject },
    getTransaction: { execute: ledgerReject },
    getLedgerEntries: { execute: ledgerReject },
    getWalletTransactions: {
      execute: async (input) => {
        const response = objectValue(await dispatch('ledger.GetWalletTransactions', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(ledgerModel.ErrorCode).find(c => c === error.code)
            ?? ledgerModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = ledgerOutput.decodeInput('ILedgerGetWalletTransactionsOutput', jsonWire(response.value), false);

        assert.ok(ledgerOutput.isILedgerGetWalletTransactionsOutput(output));

        return { ok: true, value: output };
      },
    },
    getBetFinancialStatus: { execute: ledgerReject },
    getWithdrawal: {
      execute: async (input) => {
        const response = objectValue(await dispatch('ledger.GetWithdrawal', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(ledgerModel.ErrorCode).find(c => c === error.code)
            ?? ledgerModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = ledgerOutput.decodeInput('ILedgerGetWithdrawalOutput', jsonWire(response.value), false);

        assert.ok(ledgerOutput.isILedgerGetWithdrawalOutput(output));

        return { ok: true, value: output };
      },
    },
    getCommandOutcome: { execute: ledgerReject },
    getWallet: {
      execute: async (input) => {
        const response = objectValue(await dispatch('ledger.GetWallet', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(ledgerModel.ErrorCode).find(c => c === error.code)
            ?? ledgerModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = ledgerOutput.decodeInput('ILedgerGetWalletOutput', jsonWire(response.value), false);

        assert.ok(ledgerOutput.isILedgerGetWalletOutput(output));

        return { ok: true, value: output };
      },
    },
    reconcileLedger: { execute: ledgerReject },
    publishOutboxBatch: { execute: ledgerReject },
    provisionPlayerWallet: { execute: ledgerReject },
  };
  const playerReject = async (): Promise<{
    ok: false;
    error: playerModel.IError;
  }> =>
    ({
      ok: false,
      error: {
        code: playerModel.ErrorCode.NOT_FOUND,
        message: 'NOT_FOUND',
        correlationId: f.context.correlationId,
        retryable: false,
        outcomeUnknown: false,
      },
    });
  const playerOperations: IPlayerOperationPorts = {
    registerPlayer: {
      execute: async (input) => {
        const response = objectValue(await dispatch('player.RegisterPlayer', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(playerModel.ErrorCode).find(c => c === error.code)
            ?? playerModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = playerOutput.decodeInput('IPlayerRegisterPlayerOutput', jsonWire(response.value), false);

        assert.ok(playerOutput.isIPlayerRegisterPlayerOutput(output));

        return { ok: true, value: output };
      },
    },
    getPlayer: {
      execute: async (input) => {
        const response = objectValue(await dispatch('player.GetPlayer', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(playerModel.ErrorCode).find(c => c === error.code)
            ?? playerModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = playerOutput.decodeInput('IPlayerGetPlayerOutput', jsonWire(response.value), false);

        assert.ok(playerOutput.isIPlayerGetPlayerOutput(output));

        return { ok: true, value: output };
      },
    },
    updatePlayerProfile: {
      execute: async (input) => {
        const response = objectValue(await dispatch('player.UpdatePlayerProfile', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(playerModel.ErrorCode).find(c => c === error.code)
            ?? playerModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = playerOutput.decodeInput('IPlayerUpdatePlayerProfileOutput', jsonWire(response.value), false);

        assert.ok(playerOutput.isIPlayerUpdatePlayerProfileOutput(output));

        return { ok: true, value: output };
      },
    },
    addContact: { execute: playerReject },
    verifyContact: { execute: playerReject },
    changePlayerStatus: { execute: playerReject },
    openKycCase: { execute: playerReject },
    recordKycCheck: { execute: playerReject },
    decideKycCase: { execute: playerReject },
    getKycStatus: { execute: playerReject },
    applyRestriction: { execute: playerReject },
    clearRestriction: { execute: playerReject },
    getRestrictions: { execute: playerReject },
    checkEligibility: {
      execute: async (input) => {
        const response = objectValue(await dispatch('player.CheckEligibility', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(playerModel.ErrorCode).find(c => c === error.code)
            ?? playerModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = playerOutput.decodeInput('IPlayerCheckEligibilityOutput', jsonWire(response.value), false);

        assert.ok(playerOutput.isIPlayerCheckEligibilityOutput(output));

        return { ok: true, value: output };
      },
    },
    publishOutboxBatch: { execute: playerReject },
    runSyntheticKycCheck: { execute: playerReject },
    getPlayerReference: {
      execute: async (input) => {
        delegations.push(input.context);

        return input.playerId === f.context.playerId && input.context.operatorId === f.context.operatorId
          ? {
            ok: true,
            value: { operatorId: input.context.operatorId, playerId: input.playerId, exists: true },
          }
          : {
            ok: false,
            error: {
              code: playerModel.ErrorCode.NOT_FOUND,
              message: 'NOT_FOUND',
              correlationId: input.context.correlationId,
              retryable: false,
              outcomeUnknown: false,
            },
          };
      },
    },
  };
  const eventsReject = async (): Promise<{
    ok: false;
    error: eventsModel.IError;
  }> =>
    ({
      ok: false,
      error: {
        code: eventsModel.ErrorCode.NOT_FOUND,
        message: 'NOT_FOUND',
        correlationId: f.context.correlationId,
        retryable: false,
        outcomeUnknown: false,
      },
    });
  const eventsOperations: IEventsOperationPorts = {
    listEvents: {
      execute: async (input) => {
        const response = objectValue(await dispatch('events.ListEvents', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(eventsModel.ErrorCode).find(c => c === error.code)
            ?? eventsModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = eventsOutput.decodeInput('IEventsListEventsOutput', jsonWire(response.value), false);

        assert.ok(eventsOutput.isIEventsListEventsOutput(output));

        return { ok: true, value: output };
      },
    },
    getEvent: {
      execute: async (input) => {
        const response = objectValue(await dispatch('events.GetEvent', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(eventsModel.ErrorCode).find(c => c === error.code)
            ?? eventsModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = eventsOutput.decodeInput('IEventsGetEventOutput', jsonWire(response.value), false);

        assert.ok(eventsOutput.isIEventsGetEventOutput(output));

        return { ok: true, value: output };
      },
    },
    getMarkets: {
      execute: async (input) => {
        const response = objectValue(await dispatch('events.GetMarkets', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(eventsModel.ErrorCode).find(c => c === error.code)
            ?? eventsModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = eventsOutput.decodeInput('IEventsGetMarketsOutput', jsonWire(response.value), false);

        assert.ok(eventsOutput.isIEventsGetMarketsOutput(output));

        return { ok: true, value: output };
      },
    },
    validateSelectionQuote: quoteValidation ?? { execute: eventsReject },
    getEventResult: { execute: eventsReject },
    advanceMatchPhase: { execute: eventsReject },
    completeEvent: { execute: eventsReject },
    publishOutboxBatch: { execute: eventsReject },
  };
  const bettingReject = async (): Promise<{
    ok: false;
    error: bettingModel.IError;
  }> =>
    ({
      ok: false,
      error: {
        code: bettingModel.ErrorCode.NOT_FOUND,
        message: 'NOT_FOUND',
        correlationId: f.context.correlationId,
        retryable: false,
        outcomeUnknown: false,
      },
    });
  const bettingOperations: IBettingOperationPorts = {
    placeBet: {
      execute: async (input) => {
        const response = objectValue(await dispatch('betting.PlaceBet', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(bettingModel.ErrorCode).find(c => c === error.code)
            ?? bettingModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = bettingOutput.decodeInput('IBettingPlaceBetOutput', jsonWire(response.value), false);

        assert.ok(bettingOutput.isIBettingPlaceBetOutput(output));

        return { ok: true, value: output };
      },
    },
    getBet: {
      execute: async (input) => {
        const response = objectValue(await dispatch('betting.GetBet', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(bettingModel.ErrorCode).find(c => c === error.code)
            ?? bettingModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = bettingOutput.decodeInput('IBettingGetBetOutput', jsonWire(response.value), false);

        assert.ok(bettingOutput.isIBettingGetBetOutput(output));

        return { ok: true, value: output };
      },
    },
    listPlayerBets: {
      execute: async (input) => {
        const response = objectValue(await dispatch('betting.ListPlayerBets', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(bettingModel.ErrorCode).find(c => c === error.code)
            ?? bettingModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = bettingOutput.decodeInput('IBettingListPlayerBetsOutput', jsonWire(response.value), false);

        assert.ok(bettingOutput.isIBettingListPlayerBetsOutput(output));

        return { ok: true, value: output };
      },
    },
    getBetStatus: {
      execute: async (input) => {
        const response = objectValue(await dispatch('betting.GetBetStatus', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(bettingModel.ErrorCode).find(c => c === error.code)
            ?? bettingModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = bettingOutput.decodeInput('IBettingGetBetStatusOutput', jsonWire(response.value), false);

        assert.ok(bettingOutput.isIBettingGetBetStatusOutput(output));

        return { ok: true, value: output };
      },
    },
    cancelBet: {
      execute: async (input) => {
        const response = objectValue(await dispatch('betting.CancelBet', input));

        if (response.ok !== true) {
          const error = objectValue(response.error);
          const code = Object.values(bettingModel.ErrorCode).find(c => c === error.code)
            ?? bettingModel.ErrorCode.ADAPTER_CONTRACT_VIOLATION;

          return {
            ok: false,
            error: {
              code,
              message: code,
              correlationId: f.context.correlationId,
              retryable: error.retryable === true,
              outcomeUnknown: error.outcomeUnknown === true,
            },
          };
        }

        const output = bettingOutput.decodeInput('IBettingCancelBetOutput', jsonWire(response.value), false);

        assert.ok(bettingOutput.isIBettingCancelBetOutput(output));

        return { ok: true, value: output };
      },
    },
    recordEventResult: { execute: bettingReject },
    settleBet: { execute: bettingReject },
    retryPendingReservation: { execute: bettingReject },
    retryPendingSettlement: { execute: bettingReject },
    reconcileBetWithLedger: { execute: bettingReject },
    publishOutboxBatch: { execute: bettingReject },
    retryPendingCancellation: { execute: bettingReject },
    scheduleEventSettlements: { execute: bettingReject },
  };
  const graphql = {
    maximumBytes: 65536,
    maximumDepth: 8,
    maximumRootFields: 20,
    maximumSelectedFields: 1000,
    maximumResponseBytes: 1048576,
    introspection: false,
  };

  try {
    for (const owner of ['ledger', 'player', 'events', 'betting']) {
      const port = await freePort();

      grpcPorts[owner] = port;
      const directory = owner === 'events' ? 'events' : owner;
      const host = {
        host: bindHost,
        httpPort: 0,
        grpcPort: port,
        protoPath: path.resolve(
          import.meta.dirname,
          '../../../packages/contracts/proto/sportsbook/' + directory + '/v1/' + directory + '.proto',
        ),
        protobufPackage: 'sportsbook.' + directory + '.v1',
      };

      hosts[owner] =
        owner === 'ledger'
          ? await startLedgerTransports(ledgerOperations, privateIdentity, graphql, host)
          : owner === 'player'
            ? await startPlayerTransports(playerOperations, privateIdentity, graphql, host)
            : owner === 'events'
              ? await startEventsTransports(eventsOperations, privateIdentity, graphql, host)
              : await startBettingTransports(bettingOperations, privateIdentity, graphql, host);
    }

    return {
      fixture: f,
      hosts,
      grpcPorts,
      privateIdentity,
      publicIdentity,
      delegations,
      serviceActor,
      close: async () => {
        for (const host of Object.values(hosts)) {
          await host.close();
        }
      },
    };
  } catch (error) {
    for (const host of Object.values(hosts)) {
      await host.close();
    }
    throw error;
  }
}

export async function contractGateway(
  env: IContractEnvironment,
  protocol: ServiceProtocol,
  routerUrl?: string,
): Promise<{
  app: INestApplication;
  base: string;
  close(): Promise<void>;
}> {
  const f = env.fixture;

  async function settings(owner: string): Promise<IServiceClientSettings> {
    const host = env.hosts[owner];

    assert.ok(host);

    return {
      protocol,
      endpoint: protocol === ServiceProtocol.GRPC
        ? new URL(await host.http.getUrl()).hostname + ':' + env.grpcPorts[owner]
        : protocol === ServiceProtocol.GRAPHQL
          ? (routerUrl ?? await host.http.getUrl() + '/internal/graphql')
          : await host.http.getUrl(),
      tls: false,
      issuer: env.privateIdentity.issuer,
      audience: env.privateIdentity.audience,
      key: env.privateIdentity.key,
      actorId: env.serviceActor,
      operators: [f.context.operatorId],
      capabilities: owner === 'player'
        ? ['REGISTER_PLAYER', 'PROFILE_READ', 'PROFILE_WRITE', 'EVALUATE_ELIGIBILITY']
        : owner === 'ledger'
          ? ['READ_WALLET', 'READ_JOURNAL', 'FUND_SYNTHETIC', 'WITHDRAW']
          : owner === 'betting' ? ['PLACE_BET', 'BET_READ', 'CANCEL_BET'] : ['EVENT_READ'],
      timeoutMs: 5000,
    };
  }
  const bundle = createGatewayClients(
    {
      players: await settings('player'),
      wallet: await settings('ledger'),
      bets: await settings('betting'),
      events: await settings('events'),
    },
    f.clock,
  );

  try {
    const app = await startGatewayRest(
      createGatewayApplication(f.settings, f.clock, f.ids, bundle.clients),
      env.publicIdentity,
      '127.0.0.1',
      0,
    );

    return {
      app,
      base: await app.getUrl(),
      close: async () => {
        await app.close();
        bundle.close();
      },
    };
  } catch (error) {
    bundle.close();
    throw error;
  }
}

export function publicHeaders(
  env: IContractEnvironment,
  context: M.ICallContext = env.fixture.context,
): Record<string, string> {
  const now = Date.now();
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify(
      {
        ...context,
        iss: env.publicIdentity.issuer,
        aud: env.publicIdentity.audience,
        iat: Math.floor(now / 1000),
        exp: Math.ceil(Date.parse(context.deadlineAt) / 1000),
      },
    ),
  ).toString(
    'base64url',
  );

  return {
    'content-type': 'application/json',
    authorization: 'Bearer ' + head + '.' + payload + '.'
      + createHmac('sha256', env.publicIdentity.key).update(head + '.' + payload).digest('base64url'),
    'x-correlation-id': context.correlationId,
    'x-deadline-at': context.deadlineAt,
  };
}

export async function publicContractSuite(env: IContractEnvironment, base: string): Promise<void> {
  const f = env.fixture;
  const headers = publicHeaders(env);
  const requestId = f.id();
  const own = f.context;
  const registration = publicHeaders(env, { ...own, actorId: f.registrationActor, actorKind: M.ActorKind.SYSTEM });
  const cases: [
    string,
    string,
    unknown,
    number,
    Record<string, string>?,
  ][] = [
    [
      'POST',
      '/v1/players',
      { request_id: requestId, locale: 'en-US', time_zone: 'UTC' },
      201,
      registration,
    ],
    ['GET', '/v1/me/profile', undefined, 200],
    [
      'PATCH',
      '/v1/me/profile',
      { request_id: requestId, expected_version: '1', patch: { first_name: 'Synthetic' } },
      200,
    ],
    ['GET', '/v1/me/eligibility?capability=PLACE_BET', undefined, 200],
    ['GET', '/v1/wallet?currency=USD', undefined, 200],
    [
      'POST',
      '/v1/wallet/deposits',
      {
        request_id: requestId,
        amount: { amount_minor: '9007199254740993', currency: 'USD' },
        provider_ref: 'synthetic:fund-1',
      },
      200,
    ],
    [
      'POST',
      '/v1/wallet/withdrawals',
      { request_id: requestId, amount: { amount_minor: '101', currency: 'USD' } },
      201,
    ],
    ['GET', '/v1/wallet/withdrawals/' + f.withdrawal.withdrawalId, undefined, 200],
    ['GET', '/v1/wallet/transactions?currency=USD', undefined, 200],
    [
      'POST',
      '/v1/bets',
      jsonWire(
        {
          requestId: f.place.requestId,
          type: f.place.type,
          stake: f.place.stake,
          selection: f.place.selection,
        },
        true,
      ),
      201,
    ],
    ['GET', '/v1/bets/' + f.bet.betId, undefined, 200],
    ['GET', '/v1/bets/' + f.bet.betId + '/status', undefined, 200],
    ['GET', '/v1/bets', undefined, 200],
    [
      'POST',
      '/v1/bets/' + f.bet.betId + '/cancel',
      { request_id: requestId, expected_version: '1' },
      200,
    ],
    ['GET', '/v1/events', undefined, 200],
    ['GET', '/v1/events/' + f.event.eventId, undefined, 200],
    ['GET', '/v1/events/' + f.event.eventId + '/markets', undefined, 200],
    ['GET', '/v1/dashboard?currency=USD', undefined, 200],
  ];

  for (const [method, route, body, status, auth] of cases) {
    const response = await fetch(
      base + route,
      {
        method,
        headers: auth ?? headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    const result = objectValue(await response.json());

    assert.equal(response.status, status, method + ' ' + route + ' ' + JSON.stringify(result));

    if (route === '/v1/wallet?currency=USD') {
      assert.equal(objectValue(result.wallet).available_minor, '30000000000000000');
    }
  }

  for (const route of ['/internal/graphql', '/internal/v1/wallets', '/graphql']) {
    assert.equal((await fetch(base + route, { headers })).status, 404);
  }
  assert.ok(env.delegations.length >= 18);
}

export async function freePort(): Promise<number> {
  const server = createServer();

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  assert.ok(address && typeof address === 'object');
  const port = address.port;

  await new Promise<void>(
    (resolve, reject) => server.close(error => error ? reject(error) : resolve()),
  );

  return port;
}
