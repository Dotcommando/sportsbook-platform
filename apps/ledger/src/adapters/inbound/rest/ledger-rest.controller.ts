import { Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import { camelWire, jsonWire, objectValue } from '@sportsbook/service-transport';

import { LEDGER_BOUNDARY } from '../../../infra/ledger-transport.tokens.js';
import { LedgerBoundary } from '../shared/ledger-boundary.js';

export interface IRestRequest {
  body: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
}

export interface IRestResponse {
  status(code: number): IRestResponse;
  json(value: unknown): unknown;
  setHeader(key: string, value: string): void;
}

@Controller()
export class LedgerRestController {
  constructor(@Inject(LEDGER_BOUNDARY) private readonly boundary: LedgerBoundary) { }

  @Post('/internal/v1/wallets')
  async createWallet(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));
    const result = await this.boundary.execute(
      'CreateWallet',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(201).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/wallets/:wallet_id/balance')
  async getBalance(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('walletId' in body && body.walletId !== request.params.wallet_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.walletId = request.params.wallet_id;
    const result = await this.boundary.execute(
      'GetBalance',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/transactions/:transaction_id')
  async getTransaction(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('transactionId' in body && body.transactionId !== request.params.transaction_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.transactionId = request.params.transaction_id;
    const result = await this.boundary.execute(
      'GetTransaction',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/wallets/:wallet_id/entries')
  async getLedgerEntries(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('walletId' in body && body.walletId !== request.params.wallet_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.walletId = request.params.wallet_id;
    const page = {
      limit: body.limit === undefined ? 50 : Number(body.limit),
      ...(body.cursor === undefined ? {} : { cursor: body.cursor }),
      ...(body.from === undefined ? {} : { from: body.from }),
      ...(body.to === undefined ? {} : { to: body.to }),
    };

    for (const key of ['limit', 'cursor', 'from', 'to']) {
      delete body[key];
    }
    body.page = page;
    const result = await this.boundary.execute(
      'GetLedgerEntries',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/wallets/:wallet_id/transactions')
  async getWalletTransactions(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('walletId' in body && body.walletId !== request.params.wallet_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.walletId = request.params.wallet_id;
    const page = {
      limit: body.limit === undefined ? 50 : Number(body.limit),
      ...(body.cursor === undefined ? {} : { cursor: body.cursor }),
      ...(body.from === undefined ? {} : { from: body.from }),
      ...(body.to === undefined ? {} : { to: body.to }),
    };

    for (const key of ['limit', 'cursor', 'from', 'to']) {
      delete body[key];
    }
    body.page = page;
    const result = await this.boundary.execute(
      'GetWalletTransactions',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/bets/:bet_id/financial-status')
  async getBetFinancialStatus(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('betId' in body && body.betId !== request.params.bet_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.betId = request.params.bet_id;
    const result = await this.boundary.execute(
      'GetBetFinancialStatus',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/withdrawals/:withdrawal_id')
  async getWithdrawal(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('withdrawalId' in body && body.withdrawalId !== request.params.withdrawal_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.withdrawalId = request.params.withdrawal_id;
    const result = await this.boundary.execute(
      'GetWithdrawal',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/commands/:request_id')
  async getCommandOutcome(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('requestId' in body && body.requestId !== request.params.request_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.requestId = request.params.request_id;
    const result = await this.boundary.execute(
      'GetCommandOutcome',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/wallets/:wallet_id/deposits')
  async depositTestFunds(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('walletId' in body && body.walletId !== request.params.wallet_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.walletId = request.params.wallet_id;
    const result = await this.boundary.execute(
      'DepositTestFunds',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/wallets/:wallet_id/withdrawals')
  async requestWithdrawal(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('walletId' in body && body.walletId !== request.params.wallet_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.walletId = request.params.wallet_id;
    const result = await this.boundary.execute(
      'RequestWithdrawal',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(201).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/withdrawals/:withdrawal_id/complete')
  async completeWithdrawal(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('withdrawalId' in body && body.withdrawalId !== request.params.withdrawal_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.withdrawalId = request.params.withdrawal_id;
    const result = await this.boundary.execute(
      'CompleteWithdrawal',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/withdrawals/:withdrawal_id/reject')
  async rejectWithdrawal(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('withdrawalId' in body && body.withdrawalId !== request.params.withdrawal_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.withdrawalId = request.params.withdrawal_id;
    const result = await this.boundary.execute(
      'RejectWithdrawal',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/bets/:bet_id/reservations')
  async reserveStake(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('betId' in body && body.betId !== request.params.bet_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.betId = request.params.bet_id;
    const result = await this.boundary.execute(
      'ReserveStake',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/bets/:bet_id/settlements/win')
  async settleWin(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('betId' in body && body.betId !== request.params.bet_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.betId = request.params.bet_id;
    const result = await this.boundary.execute(
      'SettleWin',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/bets/:bet_id/settlements/loss')
  async settleLoss(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('betId' in body && body.betId !== request.params.bet_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.betId = request.params.bet_id;
    const result = await this.boundary.execute(
      'SettleLoss',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/bets/:bet_id/reservation-cancellations')
  async cancelBet(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));

    if ('betId' in body && body.betId !== request.params.bet_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.betId = request.params.bet_id;
    const result = await this.boundary.execute(
      'CancelBet',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Post('/internal/v1/reconciliation-runs')
  async reconcileLedger(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.body ?? {}));
    const result = await this.boundary.execute(
      'ReconcileLedger',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }

  @Get('/internal/v1/players/:player_id/wallets/:currency')
  async getWallet(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const body = objectValue(camelWire(request.query ?? {}));

    if ('playerId' in body && body.playerId !== request.params.player_id) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.playerId = request.params.player_id;

    if ('currency' in body && body.currency !== request.params.currency) {
      return response.status(400).json({ code: 'INVALID_INPUT' });
    }
    body.currency = request.params.currency;
    const result = await this.boundary.execute(
      'GetWallet',
      body,
      {
        traceparent: request.headers.traceparent,
        tracestate: request.headers.tracestate,
        authorization: request.headers.authorization,
        correlationId: request.headers['x-correlation-id'],
        deadlineAt: request.headers['x-deadline-at'],
      },
    );

    if (!result.ok) {
      response.setHeader('x-correlation-id', result.error.correlationId);

      return response.status(httpCode(result.error.code)).json(jsonWire(result.error, true));
    }

    return response.status(200).json(jsonWire(result.value, true));
  }
}

export function httpCode(code: string): number {
  return ({
    INVALID_INPUT: 400,
    AMOUNT_OUT_OF_RANGE: 400,
    CURRENCY_MISMATCH: 400,
    UNAUTHENTICATED: 401,
    PERMISSION_DENIED: 403,
    NOT_FOUND: 404,
    IDEMPOTENCY_CONFLICT: 409,
    VERSION_CONFLICT: 409,
    IN_PROGRESS: 202,
    OVERLOADED: 429,
    DEADLINE_EXCEEDED: 504,
    DEPENDENCY_UNAVAILABLE: 503,
    ADAPTER_CONTRACT_VIOLATION: 500,
    INVARIANT_VIOLATION: 500,
  }[code] ?? 422);
}
