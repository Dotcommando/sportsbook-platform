import { checkedInt64, LedgerError, validInstant, validUuid } from '../../../domain/ledger.error.js';
import * as M from '../../../domain/ledger.model.js';
import { PostingPolicy } from '../../../domain/posting.policy.js';
import { object as sqlObject } from './sql-session.js';

function object(value: unknown): Record<string, unknown> {
  try {
    return sqlObject(value);
  } catch {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }
}

export function text(value: unknown): string {
  if (typeof value !== 'string') {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return value;
}

export function uuid(value: unknown): string {
  if (!validUuid(value)) {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return value;
}

export function integer(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return checkedInt64(value);
  }
  if (typeof value !== 'string' || !/^(?:0|-?[1-9]\d*)$/.test(value)) {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return checkedInt64(BigInt(value));
}

export function timestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (!validInstant(value)) {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return new Date(value).toISOString();
}

export function member<T extends string>(value: unknown, values: readonly T[]): T {
  const found = values.find(candidate => candidate === value);

  if (found === undefined) {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return found;
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return value;
}

function int32(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2147483647) {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return value;
}

export function decodeMoney(value: unknown): M.IMoney {
  const money = object(value);
  const currency = text(money.currency);

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return { amountMinor: integer(money.amountMinor), currency };
}

export function decodeWallet(value: unknown): M.IWalletView {
  const wallet = object(value);
  const result: M.IWalletView = {
    walletId: uuid(wallet.walletId),
    playerId: uuid(wallet.playerId),
    currency: text(wallet.currency),
    status: member(wallet.status, Object.values(M.WalletState)),
    availableMinor: integer(wallet.availableMinor),
    reservedMinor: integer(wallet.reservedMinor),
    withdrawalHoldMinor: integer(wallet.withdrawalHoldMinor),
    version: integer(wallet.version),
    observedAt: timestamp(wallet.observedAt),
  };

  if ([result.availableMinor, result.reservedMinor, result.withdrawalHoldMinor].some(
    amount => amount < 0n,
  )
    || result.version < 1n
    || !/^[A-Z]{3}$/.test(result.currency)) {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return result;
}

export function decodeEntry(value: unknown): M.IEntry {
  const line = object(value);

  return {
    entryId: uuid(line.entryId),
    accountId: uuid(line.accountId),
    transactionId: uuid(line.transactionId),
    entryNo: int32(line.entryNo),
    side: member(line.side, Object.values(M.Side)),
    amountMinor: integer(line.amountMinor),
    currency: text(line.currency),
    postedAt: timestamp(line.postedAt),
  };
}

export function decodeJournal(value: unknown): M.IJournalView {
  const journal = object(value);
  const result: M.IJournalView = {
    transactionId: uuid(journal.transactionId),
    requestId: uuid(journal.requestId),
    transactionType: member(journal.transactionType, Object.values(M.TransactionType)),
    businessRef: text(journal.businessRef),
    currency: text(journal.currency),
    status: member(journal.status, Object.values(M.JournalStatus)),
    entries: array(journal.entries).map(decodeEntry),
    ...(journal.postedAt == null ? {} : { postedAt: timestamp(journal.postedAt) }),
  };

  if (result.status === M.JournalStatus.POSTED && !PostingPolicy.validate(result).ok) {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }
  if (result.status === M.JournalStatus.REJECTED
    && (result.entries.length || result.postedAt !== undefined)) {
    throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return result;
}

export function decodeReservation(value: unknown): M.IReservationView {
  const row = object(value);

  return {
    betId: uuid(row.betId),
    walletId: uuid(row.walletId),
    stake: decodeMoney(row.stake),
    state: member(row.state, Object.values(M.ReservationState)),
    reservationTransactionId: uuid(row.reservationTransactionId),
    ...(row.settlementTransactionId == null
      ? {}
      : { settlementTransactionId: uuid(row.settlementTransactionId) }),
    ...(row.settlementSeq == null ? {} : { settlementSeq: integer(row.settlementSeq) }),
    ...(row.grossPayoutMinor == null ? {} : { grossPayoutMinor: integer(row.grossPayoutMinor) }),
  };
}

export function decodeWithdrawal(value: unknown): M.IWithdrawalView {
  const row = object(value);

  return {
    withdrawalId: uuid(row.withdrawalId),
    walletId: uuid(row.walletId),
    amount: decodeMoney(row.amount),
    state: member(row.state, Object.values(M.WithdrawalState)),
    holdTransactionId: uuid(row.holdTransactionId),
    createdAt: timestamp(row.createdAt),
    ...(row.resolutionTransactionId == null
      ? {}
      : { resolutionTransactionId: uuid(row.resolutionTransactionId) }),
    ...(row.providerRef == null ? {} : { providerRef: text(row.providerRef) }),
    ...(row.reasonCode == null ? {} : { reasonCode: text(row.reasonCode) }),
    ...(row.resolvedAt == null ? {} : { resolvedAt: timestamp(row.resolvedAt) }),
  };
}

export function decodeAccount(row: Record<string, unknown>): M.IAccountState {
  return {
    accountId: uuid(row.account_id),
    currency: text(row.currency),
    accountKind: member(row.account_kind, Object.values(M.AccountKind)),
    normalSide: member(row.normal_side, Object.values(M.Side)),
    balanceMinor: integer(row.balance_minor),
    version: integer(row.version),
    ...(row.wallet_id == null ? {} : { walletId: uuid(row.wallet_id) }),
  };
}

export function decodeContext(value: unknown): M.ICallContext {
  const context = object(value);

  return {
    operatorId: uuid(context.operatorId),
    actorId: uuid(context.actorId),
    actorKind: member(context.actorKind, Object.values(M.ActorKind)),
    capabilities: array(context.capabilities).map(value => member(value, Object.values(M.Capability))),
    correlationId: uuid(context.correlationId),
    deadlineAt: timestamp(context.deadlineAt),
    ...(context.playerId == null ? {} : { playerId: uuid(context.playerId) }),
  };
}

export function decodeCommandInput(operation: string, value: unknown): M.RegisteredInput {
  const input = object(value);
  const common = { context: decodeContext(input.context), requestId: uuid(input.requestId) };

  switch (operation) {
    case 'CreateWallet': return { ...common, playerId: uuid(input.playerId), currency: text(input.currency) };
    case 'DepositTestFunds': return {
      ...common,
      walletId: uuid(input.walletId),
      amount: decodeMoney(input.amount),
      providerRef: text(input.providerRef),
    };
    case 'ReserveStake': return {
      ...common,
      walletId: uuid(input.walletId),
      betId: uuid(input.betId),
      stake: decodeMoney(input.stake),
    };
    case 'RequestWithdrawal': return {
      ...common,
      walletId: uuid(input.walletId),
      withdrawalId: uuid(input.withdrawalId),
      amount: decodeMoney(input.amount),
    };
    case 'CompleteWithdrawal':
      return {
        ...common,
        withdrawalId:
          uuid(
            input.withdrawalId,
          ),
        providerRef:
          text(
            input.providerRef,
          ),
      };
    case 'RejectWithdrawal':
      return {
        ...common,
        withdrawalId:
          uuid(
            input.withdrawalId,
          ),
        reasonCode:
          text(
            input.reasonCode,
          ),
      };
    case 'SettleWin': return {
      ...common,
      betId: uuid(input.betId),
      settlementSeq: integer(input.settlementSeq),
      grossPayout: decodeMoney(input.grossPayout),
    };
    case 'SettleLoss': return { ...common, betId: uuid(input.betId), settlementSeq: integer(input.settlementSeq) };
    case 'CancelBet': return {
      ...common,
      betId: uuid(input.betId),
      reasonCode: member(input.reasonCode, Object.values(M.RefundReason)),
    };
    default: throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }
}

export function decodeOutcome(value: unknown): M.IFinancialOutcome {
  const result = object(value);

  return {
    requestId: uuid(result.requestId),
    state: member(result.state, Object.values(M.FinancialState)),
    businessRef: uuid(result.businessRef),
    wallet: decodeWallet(result.wallet),
    replayed: bool(result.replayed),
    ...(result.transactionId == null ? {} : { transactionId: uuid(result.transactionId) }),
    ...(result.reasonCode == null
      ? {}
      : { reasonCode: member(result.reasonCode, Object.values(M.ErrorCode)) }),
  };
}

export function decodeCommandResult(operation: string, value: unknown): M.IResult<M.RegisteredOutput> {
  const result = object(value);

  if (!bool(result.ok)) {
    const error = object(result.error);

    return {
      ok: false,
      error: {
        code: member(error.code, Object.values(M.ErrorCode)),
        message: text(error.message),
        correlationId: uuid(error.correlationId),
        retryable: bool(error.retryable),
        outcomeUnknown: bool(error.outcomeUnknown),
        ...(error.retryAfterMs == null ? {} : { retryAfterMs: int32(error.retryAfterMs) }),
      },
    };
  }

  const output = object(result.value);

  if (operation === 'CreateWallet') {
    return { ok: true, value: { wallet: decodeWallet(output.wallet), created: bool(output.created) } };
  }

  const outcome = decodeOutcome(output.outcome);

  if (operation === 'DepositTestFunds') {
    return { ok: true, value: { outcome } };
  }
  if (['ReserveStake', 'SettleWin', 'SettleLoss', 'CancelBet'].includes(operation)) {
    return { ok: true, value: { reservation: decodeReservation(output.reservation), outcome } };
  }
  if (['RequestWithdrawal', 'CompleteWithdrawal', 'RejectWithdrawal'].includes(operation)) {
    return { ok: true, value: { withdrawal: decodeWithdrawal(output.withdrawal), outcome } };
  }
  throw new LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
}

export function decodeStoredCommand(row: Record<string, unknown>): M.IStoredCommand {
  const operation = text(row.operation);

  return {
    requestId: uuid(row.request_id),
    operation,
    payloadHash: text(row.payload_hash),
    state: member(row.state, Object.values(M.CommandState)),
    actorId: uuid(row.actor_id),
    actorKind: member(row.actor_kind, Object.values(M.ActorKind)),
    updatedAt: timestamp(row.updated_at),
    semanticInput: decodeCommandInput(operation, row.semantic_input),
    stableChildIds: array(row.stable_child_ids).map(
      value => {
        const item = object(value);

        return { purpose: text(item.purpose), id: uuid(item.id) };
      },
    ),
    ...(row.player_id == null ? {} : { playerId: uuid(row.player_id) }),
    ...(row.response_snapshot == null
      ? {}
      : { outcome: decodeCommandResult(operation, row.response_snapshot) }),
  };
}

export function decodeEvent(value: unknown): M.IEventEnvelope {
  const envelope = object(value);
  const raw = object(envelope.payload);
  const payload: M.IEventPayload = {};

  for (const key of [
    'transactionId',
    'requestId',
    'businessRef',
    'walletId',
    'playerId',
    'withdrawalId',
    'resolutionTransactionId',
  ]) {
    if (raw[key] == null) {
      continue;
    }

    switch (key) {
      case 'transactionId': payload.transactionId = uuid(raw[key]);
        break;
      case 'requestId': payload.requestId = uuid(raw[key]);
        break;
      case 'businessRef': payload.businessRef = uuid(raw[key]);
        break;
      case 'walletId': payload.walletId = uuid(raw[key]);
        break;
      case 'playerId': payload.playerId = uuid(raw[key]);
        break;
      case 'withdrawalId': payload.withdrawalId = uuid(raw[key]);
        break;
      case 'resolutionTransactionId': payload.resolutionTransactionId = uuid(raw[key]);
        break;
    }
  }

  if (raw.currency != null) {
    payload.currency = text(raw.currency);
  }
  if (raw.amountMinor != null) {
    payload.amountMinor = integer(raw.amountMinor);
  }
  if (raw.transactionType != null) {
    payload.transactionType = member(raw.transactionType, Object.values(M.TransactionType));
  }
  if (raw.state != null) {
    payload.state = member(raw.state, Object.values(M.WithdrawalState));
  }
  if (raw.registeredAt != null) {
    payload.registeredAt = timestamp(raw.registeredAt);
  }

  return {
    messageId: uuid(envelope.messageId),
    source: member(envelope.source, Object.values(M.EventSource)),
    eventType: member(envelope.eventType, Object.values(M.EventType)),
    schemaVersion: int32(envelope.schemaVersion),
    operatorId: uuid(envelope.operatorId),
    correlationId: uuid(envelope.correlationId),
    occurredAt: timestamp(envelope.occurredAt),
    payload,
  };
}
