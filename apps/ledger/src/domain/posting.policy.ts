import { checkedInt64, failure, LedgerError, success } from './ledger.error.js';
import type { IAccountDelta, IAccountState, IJournalView, Instant, IResult, UUID } from './ledger.model.js';
import { AccountKind, ErrorCode, JournalStatus, Side, TransactionType } from './ledger.model.js';

export interface IPostingCommand {
  requestId: UUID;
  correlationId: UUID;
  transactionType: TransactionType;
  businessRef: string;
  currency: string;
  amountMinor: bigint;
  stakeMinor?: bigint;
  entryIds: UUID[];
}

export class PostingPolicy {
  static build(
    command: IPostingCommand,
    accounts: IAccountState[],
    postingId: UUID,
    now: Instant,
  ): IResult<IJournalView> {
    const lines: { kind: AccountKind; side: Side; amount: bigint }[] = [];
    const move = (debit: AccountKind, credit: AccountKind, amount: bigint): void => {
      lines.push(
        { kind: debit, side: Side.DEBIT, amount },
        { kind: credit, side: Side.CREDIT, amount },
      );
    };

    switch (command.transactionType) {
      case TransactionType.DEPOSIT: move(AccountKind.CLEARING, AccountKind.AVAILABLE, command.amountMinor);
        break;
      case TransactionType.RESERVE_STAKE: move(AccountKind.AVAILABLE, AccountKind.RESERVED, command.amountMinor);
        break;
      case TransactionType.SETTLE_LOSS: move(AccountKind.RESERVED, AccountKind.REVENUE, command.amountMinor);
        break;
      case TransactionType.CANCEL_RESERVATION: move(AccountKind.RESERVED, AccountKind.AVAILABLE, command.amountMinor);
        break;
      case TransactionType.WITHDRAWAL_HOLD:
        move(
          AccountKind.AVAILABLE,
          AccountKind.WITHDRAWAL_HOLD,
          command.amountMinor,
        );
        break;
      case TransactionType.WITHDRAWAL_COMPLETE:
        move(
          AccountKind.WITHDRAWAL_HOLD,
          AccountKind.CLEARING,
          command.amountMinor,
        );
        break;
      case TransactionType.WITHDRAWAL_REJECT:
        move(
          AccountKind.WITHDRAWAL_HOLD,
          AccountKind.AVAILABLE,
          command.amountMinor,
        );
        break;
      case TransactionType.SETTLE_WIN: {
        const stake = command.stakeMinor;

        if (stake === undefined || command.amountMinor < stake || stake <= 0n) {
          return failure(ErrorCode.INVALID_INPUT);
        }
        lines.push({ kind: AccountKind.RESERVED, side: Side.DEBIT, amount: stake });

        if (command.amountMinor > stake) {
          lines.push(
            { kind: AccountKind.EXPENSE, side: Side.DEBIT, amount: command.amountMinor - stake },
          );
        }
        lines.push({ kind: AccountKind.AVAILABLE, side: Side.CREDIT, amount: command.amountMinor });
        break;
      }
    }
    const posting: IJournalView = {
      transactionId: postingId,
      requestId: command.requestId,
      transactionType: command.transactionType,
      businessRef: command.businessRef,
      currency: command.currency,
      status: JournalStatus.POSTED,
      postedAt: now,
      entries: [],
    };

    for (const [index, line] of lines.entries()) {
      const account = accounts.find(item => item.accountKind === line.kind);
      const entryId = command.entryIds[index];

      if (!account || !entryId || account.currency !== command.currency) {
        return failure(ErrorCode.INVARIANT_VIOLATION);
      }
      posting.entries.push(
        {
          entryId,
          accountId: account.accountId,
          transactionId: postingId,
          entryNo: index + 1,
          side: line.side,
          amountMinor: line.amount,
          currency: command.currency,
          postedAt: now,
        },
      );
    }
    const validated = PostingPolicy.validate(posting);

    return validated.ok ? success(posting) : validated;
  }

  static validate(posting: IJournalView): IResult<void> {
    const totals = new Map<string, bigint>();
    const entries = new Set<string>();
    const numbers = new Set<number>();

    if (posting.status !== JournalStatus.POSTED || !posting.postedAt || posting.entries.length < 2) {
      return failure(ErrorCode.INVARIANT_VIOLATION);
    }

    for (const entry of posting.entries) {
      if (typeof entry.amountMinor !== 'bigint' || entry.amountMinor <= 0n
        || entry.amountMinor > 9223372036854775807n
        || !Object.values(Side).includes(entry.side)
        || entry.currency !== posting.currency
        || entry.transactionId !== posting.transactionId
        || entry.postedAt !== posting.postedAt
        || !Number.isInteger(entry.entryNo)
        || entry.entryNo < 1
        || entries.has(entry.entryId)
        || numbers.has(entry.entryNo)) {
        return failure(ErrorCode.INVARIANT_VIOLATION);
      }
      entries.add(entry.entryId);
      numbers.add(entry.entryNo);
      totals.set(
        entry.currency,
        (totals.get(entry.currency) ?? 0n)
        + (entry.side === Side.DEBIT ? entry.amountMinor : -entry.amountMinor),
      );
    }

    return [...totals.values()].every(value => value === 0n)
      ? success(undefined)
      : failure(ErrorCode.INVARIANT_VIOLATION);
  }

  static project(posting: IJournalView, accounts: IAccountState[]): IResult<IAccountDelta[]> {
    const deltas = new Map<string, bigint>();
    const validated = PostingPolicy.validate(posting);

    if (!validated.ok) {
      return validated;
    }

    try {
      for (const entry of posting.entries) {
        const account = accounts.find(item => item.accountId === entry.accountId);

        if (account?.currency !== entry.currency) {
          return failure(ErrorCode.INVARIANT_VIOLATION);
        }
        deltas.set(
          account.accountId,
          checkedInt64(
            (deltas.get(account.accountId) ?? 0n)
            + (entry.side === account.normalSide ? entry.amountMinor : -entry.amountMinor),
          ),
        );
      }

      for (const account of accounts) {
        const balance = checkedInt64(account.balanceMinor + (deltas.get(account.accountId) ?? 0n));

        if (account.walletId && balance < 0n) {
          return failure(ErrorCode.INSUFFICIENT_FUNDS);
        }
      }

      return success(
        [...deltas.entries()].filter(([, delta]) => delta !== 0n).sort(
          ([a], [b]) => a.localeCompare(b),
        ).map(
          ([accountId, deltaMinor]) => ({ accountId, currency: posting.currency, deltaMinor }),
        ),
      );
    } catch (error) {
      if (error instanceof LedgerError) {
        return failure(error.code);
      }
      throw error;
    }
  }
}
