import * as Wire from '@sportsbook/ledger-client';

import * as M from '../../../domain/betting.model.js';
import { requireRule } from '../../../domain/betting.policy.js';
import * as Output from '../../../domain/betting-output.policy.js';
import type { ClockPort, LedgerReservationPort, LedgerSettlementPort } from '../../../ports/outbound/betting.port.js';
import { decodeInput } from './betting-client.dto.js';
import { protobufOutput } from './ledger-wire.js';
import type { IPrivateGrpcSettings } from './private-grpc.js';
import { PrivateGrpc } from './private-grpc.js';

export class LedgerGrpcClient implements LedgerReservationPort, LedgerSettlementPort {
  private readonly connection: PrivateGrpc; private readonly client: Wire.LedgerServiceClient;

  constructor(settings: IPrivateGrpcSettings, clock: ClockPort) {
    this.connection = new PrivateGrpc(settings, clock);
    this.client = new Wire.LedgerServiceClient(settings.endpoint, this.connection.credentials);
  }

  close(): void {
    this.client.close();
  }

  private async getWalletCall(
    context: M.ICallContext,
    body: Record<
      string,
      unknown
    >,
  ): Promise<
    M.ILedgerGetWalletOutput
  > {
    const request = Wire.GetWalletRequest.fromJSON(
      protobufOutput({ ...body, context: this.connection.delegated(context) }, 'GetWalletRequest'),
    );
    const raw = await this.connection.call(
      context,
      false,
      (metadata, options, done) => this.client.getWallet(request, metadata, options, done),
      Wire.GetWalletResponse.toJSON,
    );
    const result = decodeInput('ILedgerGetWalletOutput', raw, true);

    requireRule(Output.isILedgerGetWalletOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    if (!Output.isILedgerGetWalletOutput(result)) {
      throw new Error('Malformed dependency output');
    }

    return result;
  }

  private async reserveStakeCall(
    context: M.ICallContext,
    body: Record<
      string,
      unknown
    >,
  ): Promise<
    M.ILedgerReserveStakeOutput
  > {
    const request = Wire.ReserveStakeRequest.fromJSON(
      protobufOutput({ ...body, context: this.connection.delegated(context) }, 'ReserveStakeRequest'),
    );
    const raw = await this.connection.call(
      context,
      true,
      (metadata, options, done) => this.client.reserveStake(request, metadata, options, done),
      Wire.ReserveStakeResponse.toJSON,
    );
    const result = decodeInput('ILedgerReserveStakeOutput', raw, true);

    requireRule(Output.isILedgerReserveStakeOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    if (!Output.isILedgerReserveStakeOutput(result)) {
      throw new Error('Malformed dependency output');
    }

    return result;
  }

  private async getBetFinancialStatusCall(
    context: M.ICallContext,
    body: Record<string, unknown>,
  ): Promise<M.ILedgerGetBetFinancialStatusOutput> {
    const request = Wire.GetBetFinancialStatusRequest.fromJSON(
      protobufOutput(
        { ...body, context: this.connection.delegated(context) },
        'GetBetFinancialStatusRequest',
      ),
    );
    const raw = await this.connection.call(
      context,
      false,
      (metadata, options, done) =>
        this.client.getBetFinancialStatus(request, metadata, options, done),
      Wire.GetBetFinancialStatusResponse.toJSON,
    );
    const result = decodeInput('ILedgerGetBetFinancialStatusOutput', raw, true);

    requireRule(
      Output.isILedgerGetBetFinancialStatusOutput(result),
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );

    if (!Output.isILedgerGetBetFinancialStatusOutput(result)) {
      throw new Error('Malformed dependency output');
    }

    return result;
  }

  private async cancelBetCall(
    context: M.ICallContext,
    body: Record<
      string,
      unknown
    >,
  ): Promise<
    M.ILedgerCancelBetOutput
  > {
    const request = Wire.CancelBetRequest.fromJSON(
      protobufOutput({ ...body, context: this.connection.delegated(context) }, 'CancelBetRequest'),
    );
    const raw = await this.connection.call(
      context,
      true,
      (metadata, options, done) => this.client.cancelBet(request, metadata, options, done),
      Wire.CancelBetResponse.toJSON,
    );
    const result = decodeInput('ILedgerCancelBetOutput', raw, true);

    requireRule(Output.isILedgerCancelBetOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    if (!Output.isILedgerCancelBetOutput(result)) {
      throw new Error('Malformed dependency output');
    }

    return result;
  }

  private async settleWinCall(
    context: M.ICallContext,
    body: Record<
      string,
      unknown
    >,
  ): Promise<
    M.ILedgerSettleWinOutput
  > {
    const request = Wire.SettleWinRequest.fromJSON(
      protobufOutput({ ...body, context: this.connection.delegated(context) }, 'SettleWinRequest'),
    );
    const raw = await this.connection.call(
      context,
      true,
      (metadata, options, done) => this.client.settleWin(request, metadata, options, done),
      Wire.SettleWinResponse.toJSON,
    );
    const result = decodeInput('ILedgerSettleWinOutput', raw, true);

    requireRule(Output.isILedgerSettleWinOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    if (!Output.isILedgerSettleWinOutput(result)) {
      throw new Error('Malformed dependency output');
    }

    return result;
  }

  private async settleLossCall(
    context: M.ICallContext,
    body: Record<
      string,
      unknown
    >,
  ): Promise<
    M.ILedgerSettleLossOutput
  > {
    const request = Wire.SettleLossRequest.fromJSON(
      protobufOutput({ ...body, context: this.connection.delegated(context) }, 'SettleLossRequest'),
    );
    const raw = await this.connection.call(
      context,
      true,
      (metadata, options, done) => this.client.settleLoss(request, metadata, options, done),
      Wire.SettleLossResponse.toJSON,
    );
    const result = decodeInput('ILedgerSettleLossOutput', raw, true);

    requireRule(Output.isILedgerSettleLossOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    if (!Output.isILedgerSettleLossOutput(result)) {
      throw new Error('Malformed dependency output');
    }

    return result;
  }

  async reserve(
    context: M.ICallContext,
    requestId: string,
    betId: string,
    playerId: string,
    stake: M.IMoney,
  ): Promise<M.ILedgerReserveStakeOutput> {
    const result = await this.getWalletCall({ ...context, playerId }, { playerId, currency: stake.currency });
    const wallet = result.wallet;

    requireRule(
      wallet.playerId === playerId && wallet.currency === stake.currency
      && wallet.status === M.WalletStatus.ACTIVE,
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );
    const posted = await this.reserveStakeCall(
      { ...context, playerId },
      { requestId, betId, walletId: wallet.walletId, stake },
    );

    requireRule(
      posted.reservation.betId === betId && posted.reservation.walletId === wallet.walletId
      && posted.reservation.stake.amountMinor === stake.amountMinor
      && posted.reservation.stake.currency === stake.currency,
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );

    return posted;
  }

  getStatus(context: M.ICallContext, betId: string): Promise<M.ILedgerGetBetFinancialStatusOutput> {
    return this.getBetFinancialStatusCall(context, { betId });
  }

  cancel(
    context: M.ICallContext,
    requestId: string,
    betId: string,
    reasonCode: M.CancellationReason,
  ): Promise<M.ILedgerCancelBetOutput> {
    return this.cancelBetCall(context, { requestId, betId, reasonCode });
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
    return this.settleWinCall(context, { requestId, betId, settlementSeq, grossPayout });
  }

  settleLoss(
    context: M.ICallContext,
    requestId: string,
    betId: string,
    settlementSeq: bigint,
  ): Promise<
    M.ILedgerSettleLossOutput
  > {
    return this.settleLossCall(context, { requestId, betId, settlementSeq });
  }
}
