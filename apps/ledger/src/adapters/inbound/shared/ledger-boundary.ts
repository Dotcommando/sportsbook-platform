import type { Metadata } from '@grpc/grpc-js';
import { Inject, Injectable } from '@nestjs/common';
import {
  AdmissionError,
  BoundaryError,
  decodeShape,
  objectValue,
  observeOperation,
  ShapeKind,
  SignedIdentity,
} from '@sportsbook/service-transport';

import type { ICallContext, IResult, RegisteredOutput } from '../../../domain/ledger.model.js';
import { ActorKind, Capability } from '../../../domain/ledger.model.js';
import { LEDGER_IDENTITY, LEDGER_OPERATIONS } from '../../../infra/ledger-transport.tokens.js';
import type { ILedgerOperationPorts } from '../../../ports/inbound/ledger-application.port.js';
import * as Dto from './ledger.dto.js';

export interface ITransportHeaders {
  authorization?: unknown;
  correlationId?: unknown;
  deadlineAt?: unknown;
  traceparent?: unknown;
  tracestate?: unknown;
}

@Injectable()
export class LedgerBoundary {
  constructor(
    @Inject(LEDGER_OPERATIONS)
    private readonly operations: ILedgerOperationPorts,
    @Inject(LEDGER_IDENTITY)
    private readonly identity: SignedIdentity,
  ) { }

  context(headers: ITransportHeaders): ICallContext {
    const claims = this.identity.authenticate(headers.authorization, headers.correlationId, headers.deadlineAt);
    const actorKind = Object.values(ActorKind).find(kind => kind === claims.actorKind);

    if (!actorKind) {
      throw new BoundaryError('UNAUTHENTICATED');
    }

    const capabilities = Object.values(Capability).filter(capability => claims.capabilities.includes(capability));

    return { ...claims, actorKind, capabilities };
  }

  async execute(
    operation: string,
    body: unknown,
    headers: ITransportHeaders,
    protobuf = false,
  ): Promise<
    IResult<
      RegisteredOutput
    >
  > {
    let dispatched = false;
    let correlationId = '00000000-0000-4000-8000-000000000001';

    try {
      const context = this.context(headers);

      correlationId = context.correlationId;
      const args = objectValue(body);

      if ('context' in args || 'operatorId' in args) {
        throw new BoundaryError('INVALID_INPUT', correlationId);
      }

      const input = Dto.decodeInput('ILedger' + operation + 'Input', { ...args, context }, protobuf);

      switch (operation) {
        case 'CreateWallet': {
          if (!Dto.isILedgerCreateWalletInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.createWallet.execute(input),
          );

          if (result.ok && !Dto.isILedgerCreateWalletOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetBalance': {
          if (!Dto.isILedgerGetBalanceInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getBalance.execute(input),
          );

          if (result.ok && !Dto.isILedgerGetBalanceOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetTransaction': {
          if (!Dto.isILedgerGetTransactionInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getTransaction.execute(input),
          );

          if (result.ok && !Dto.isILedgerGetTransactionOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetLedgerEntries': {
          if (!Dto.isILedgerGetLedgerEntriesInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getLedgerEntries.execute(input),
          );

          if (result.ok && !Dto.isILedgerGetLedgerEntriesOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetWalletTransactions': {
          if (!Dto.isILedgerGetWalletTransactionsInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getWalletTransactions.execute(input),
          );

          if (result.ok && !Dto.isILedgerGetWalletTransactionsOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetBetFinancialStatus': {
          if (!Dto.isILedgerGetBetFinancialStatusInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getBetFinancialStatus.execute(input),
          );

          if (result.ok && !Dto.isILedgerGetBetFinancialStatusOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetWithdrawal': {
          if (!Dto.isILedgerGetWithdrawalInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getWithdrawal.execute(input),
          );

          if (result.ok && !Dto.isILedgerGetWithdrawalOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetCommandOutcome': {
          if (!Dto.isILedgerGetCommandOutcomeInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getCommandOutcome.execute(input),
          );

          if (result.ok && !Dto.isILedgerGetCommandOutcomeOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'DepositTestFunds': {
          if (!Dto.isILedgerDepositTestFundsInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.depositTestFunds.execute(input),
          );

          if (result.ok && !Dto.isILedgerDepositTestFundsOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'RequestWithdrawal': {
          if (!Dto.isILedgerRequestWithdrawalInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.requestWithdrawal.execute(input),
          );

          if (result.ok && !Dto.isILedgerRequestWithdrawalOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'CompleteWithdrawal': {
          if (!Dto.isILedgerCompleteWithdrawalInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.completeWithdrawal.execute(input),
          );

          if (result.ok && !Dto.isILedgerCompleteWithdrawalOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'RejectWithdrawal': {
          if (!Dto.isILedgerRejectWithdrawalInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.rejectWithdrawal.execute(input),
          );

          if (result.ok && !Dto.isILedgerRejectWithdrawalOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'ReserveStake': {
          if (!Dto.isILedgerReserveStakeInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.reserveStake.execute(input),
          );

          if (result.ok && !Dto.isILedgerReserveStakeOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'SettleWin': {
          if (!Dto.isILedgerSettleWinInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.settleWin.execute(input),
          );

          if (result.ok && !Dto.isILedgerSettleWinOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'SettleLoss': {
          if (!Dto.isILedgerSettleLossInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.settleLoss.execute(input),
          );

          if (result.ok && !Dto.isILedgerSettleLossOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'CancelBet': {
          if (!Dto.isILedgerCancelBetInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.cancelBet.execute(input),
          );

          if (result.ok && !Dto.isILedgerCancelBetOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'ReconcileLedger': {
          if (!Dto.isILedgerReconcileLedgerInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.reconcileLedger.execute(input),
          );

          if (result.ok && !Dto.isILedgerReconcileLedgerOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        case 'GetWallet': {
          if (!Dto.isILedgerGetWalletInput(input)) {
            throw new BoundaryError('INVALID_INPUT', correlationId);
          }
          dispatched = true;
          const result = await observeOperation(
            'ledger',
            operation,
            headers,
            context.deadlineAt,
            () => this.operations.getWallet.execute(input),
          );

          if (result.ok && !Dto.isILedgerGetWalletOutput(result.value)) {
            throw new BoundaryError('ADAPTER_CONTRACT_VIOLATION', correlationId);
          }

          return result;
        }
        default: throw new BoundaryError('INVALID_INPUT', correlationId);
      }
    } catch (error) {
      const code = error instanceof BoundaryError || error instanceof AdmissionError
        ? error.code
        : dispatched ? 'ADAPTER_CONTRACT_VIOLATION' : 'INVALID_INPUT';

      return {
        ok: false,
        error: {
          code: codeValue(code),
          message: code,
          correlationId,
          retryable: error instanceof AdmissionError,
          outcomeUnknown: !(error instanceof AdmissionError) && dispatched && !operation.startsWith('Get'),
        },
      };
    }
  }

  grpcHeaders(metadata: Metadata, context: unknown): ITransportHeaders {
    const claimed = objectValue(context);

    return {
      traceparent: metadata.get('traceparent')[0],
      tracestate: metadata.get('tracestate')[0],
      authorization: metadata.get('authorization')[0],
      correlationId: metadata.get('x-correlation-id')[0] ?? claimed.correlationId,
      deadlineAt: metadata.get('x-deadline-at')[0] ?? claimed.deadlineAt,
    };
  }

  validateDelegation(context: unknown, headers: ITransportHeaders): void {
    const claimed = objectValue(context);
    const trusted = this.context(headers);

    for (const key of ['operatorId', 'actorId', 'actorKind', 'playerId']) {
      if (key in claimed && claimed[key] !== objectValue(trusted)[key]) {
        if (key === 'actorKind' && typeof claimed[key] === 'string'
          && claimed[key].endsWith('_' + trusted.actorKind)) {
          continue;
        }
        throw new BoundaryError('PERMISSION_DENIED', trusted.correlationId);
      }
    }

    if (Array.isArray(claimed.capabilities)) {
      const values = decodeShape(
        claimed.capabilities,
        { kind: ShapeKind.ARRAY, items: { kind: ShapeKind.ENUM, values: Object.values(Capability) } },
        true,
      );

      if (Array.isArray(values)
        && values.some(value => !trusted.capabilities.some(capability => capability === value))) {
        throw new BoundaryError('PERMISSION_DENIED', trusted.correlationId);
      }
    }
  }
}

import { ErrorCode } from '../../../domain/ledger.model.js';

function codeValue(code: string): ErrorCode {
  return Object.values(ErrorCode).find(value => value === code) ?? ErrorCode.INVALID_INPUT;
}

export function transportError(code: string): IResult<RegisteredOutput> {
  return {
    ok: false,
    error: {
      code: codeValue(code),
      message: code,
      correlationId: '00000000-0000-4000-8000-000000000001',
      retryable: false,
      outcomeUnknown: false,
    },
  };
}
