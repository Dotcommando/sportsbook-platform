import { deriveChart } from '../../../domain/chart.policy.js';
import { LedgerError, validUuid } from '../../../domain/ledger.error.js';
import type {
  ICallContext,
  IEntry,
  IJournalView,
  IPageInput,
  IReservationView,
  IWalletView,
  IWithdrawalView,
} from '../../../domain/ledger.model.js';
import { AccountKind, ActorKind, ClaimKind, CommandState, ErrorCode, Side } from '../../../domain/ledger.model.js';
import type {
  ClockPort,
  IdGeneratorPort,
  IFinancialTransactionPorts,
  IPageResult,
} from '../../../ports/outbound/financial.port.js';
import { losslessJson } from '../ids/command-fingerprint.js';
import type { IAccountWriter } from './account-writers.js';
import {
  decodeEntry,
  decodeJournal,
  decodeReservation,
  decodeStoredCommand,
  decodeWallet,
  decodeWithdrawal,
  timestamp,
  uuid,
} from './ledger.codec.js';
import type { ISqlSession, SqlParameter } from './sql-session.js';
import { object } from './sql-session.js';

export const WALLET_SELECT =
  `SELECT jsonb_build_object('walletId',w.wallet_id,'playerId',w.player_id,'currency',w.currency,'status',w.status,
  'availableMinor',COALESCE(max(b.balance_minor) FILTER (WHERE a.account_kind='AVAILABLE'),0)::text,
  'reservedMinor',COALESCE(max(b.balance_minor) FILTER (WHERE a.account_kind='RESERVED'),0)::text,
  'withdrawalHoldMinor',COALESCE(max(b.balance_minor) FILTER (WHERE a.account_kind='WITHDRAWAL_HOLD'),0)::text,
  'version',COALESCE(sum(b.version),0)::text,'observedAt',transaction_timestamp()) AS value
  FROM wallets w JOIN ledger_accounts a ON a.operator_id=w.operator_id AND a.wallet_id=w.wallet_id AND a.currency=w.currency
  JOIN ledger_account_balances b ON b.operator_id=a.operator_id AND b.account_id=a.account_id
  WHERE w.operator_id=$1::uuid AND ($3::uuid IS NULL OR w.player_id=$3::uuid)`;

const WALLET_GROUP = ' GROUP BY w.wallet_id,w.player_id,w.currency,w.status HAVING count(*)=3';

const ENTRY_JSON =
  'jsonb_build_object(\'entryId\',e.ledger_entry_id,\'accountId\',e.account_id,\'transactionId\',e.ledger_transaction_id,\'entryNo\',e.entry_no,\'side\',e.side,\'amountMinor\',e.amount_minor::text,\'currency\',e.currency,\'postedAt\',e.posted_at)';

const JOURNAL_JSON =
  `jsonb_build_object('transactionId',h.ledger_transaction_id,'requestId',h.request_id,'transactionType',h.transaction_type,'businessRef',h.business_ref,'currency',h.currency,'status',h.status,'postedAt',h.posted_at,'entries',COALESCE((SELECT jsonb_agg(${ENTRY_JSON} ORDER BY e.entry_no) FROM ledger_entries e WHERE e.operator_id=h.operator_id AND e.ledger_transaction_id=h.ledger_transaction_id),'[]'::jsonb))`;

const RESERVATION_SELECT =
  `SELECT jsonb_build_object('betId',r.bet_id,'walletId',r.wallet_id,'stake',jsonb_build_object('amountMinor',r.stake_minor::text,'currency',r.currency),'state',r.status,'reservationTransactionId',r.reservation_transaction_id,'settlementTransactionId',r.settlement_transaction_id,'settlementSeq',r.settlement_seq::text,'grossPayoutMinor',r.gross_payout_minor::text) AS value
  FROM ledger_bet_reservations r JOIN wallets w ON w.wallet_id=r.wallet_id AND w.operator_id=r.operator_id
  WHERE r.operator_id=$1::uuid AND r.bet_id=$2::uuid AND ($3::uuid IS NULL OR w.player_id=$3::uuid)`;

const WITHDRAWAL_SELECT =
  `SELECT jsonb_build_object('withdrawalId',r.withdrawal_id,'walletId',r.wallet_id,'amount',jsonb_build_object('amountMinor',r.amount_minor::text,'currency',r.currency),'state',r.status,'holdTransactionId',r.hold_transaction_id,'resolutionTransactionId',r.completion_transaction_id,'providerRef',r.provider_ref,'reasonCode',r.reason_code,'createdAt',r.created_at,'resolvedAt',r.resolved_at) AS value
  FROM ledger_withdrawals r JOIN wallets w ON w.wallet_id=r.wallet_id AND w.operator_id=r.operator_id
  WHERE r.operator_id=$1::uuid AND r.withdrawal_id=$2::uuid AND ($3::uuid IS NULL OR w.player_id=$3::uuid)`;

export function playerScope(context: ICallContext): string | null {
  if (context.actorKind === ActorKind.SYSTEM) {
    return null;
  }
  if (!validUuid(context.playerId)) {
    throw new LedgerError(ErrorCode.NOT_FOUND);
  }

  return context.playerId;
}

export async function walletById(
  session: ISqlSession,
  context: ICallContext,
  id: string,
): Promise<
  IWalletView | undefined
> {
  const result = await session.query(
    WALLET_SELECT + ' AND w.wallet_id=$2::uuid' + WALLET_GROUP,
    [context.operatorId, id, playerScope(context)],
  );

  return result[0] ? decodeWallet(result[0].value) : undefined;
}

export async function walletByOwner(
  session: ISqlSession,
  context: ICallContext,
  playerId: string,
  currency: string,
): Promise<IWalletView | undefined> {
  const result = await session.query(
    WALLET_SELECT + ' AND w.player_id=$2::uuid AND w.currency=$4' + WALLET_GROUP,
    [context.operatorId, playerId, playerScope(context), currency],
  );

  return result[0] ? decodeWallet(result[0].value) : undefined;
}

export async function journalById(
  session: ISqlSession,
  context: ICallContext,
  id: string,
): Promise<
  IJournalView | undefined
> {
  const result =
    await session.query(
      `SELECT ${JOURNAL_JSON} AS value FROM ledger_transactions h WHERE h.operator_id=$1::uuid AND h.ledger_transaction_id=$2::uuid
    AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM ledger_entries e JOIN ledger_accounts a ON a.account_id=e.account_id AND a.operator_id=e.operator_id JOIN wallets w ON w.wallet_id=a.wallet_id AND w.operator_id=a.operator_id WHERE e.operator_id=h.operator_id AND e.ledger_transaction_id=h.ledger_transaction_id AND w.player_id=$3::uuid))`,
      [context.operatorId, id, playerScope(context)],
    );

  return result[0] ? decodeJournal(result[0].value) : undefined;
}

export async function reservationById(
  session: ISqlSession,
  context: ICallContext,
  id: string,
): Promise<
  IReservationView | undefined
> {
  const result = await session.query(RESERVATION_SELECT, [context.operatorId, id, playerScope(context)]);

  return result[0] ? decodeReservation(result[0].value) : undefined;
}

export async function withdrawalById(
  session: ISqlSession,
  context: ICallContext,
  id: string,
): Promise<
  IWithdrawalView | undefined
> {
  const result = await session.query(WITHDRAWAL_SELECT, [context.operatorId, id, playerScope(context)]);

  return result[0] ? decodeWithdrawal(result[0].value) : undefined;
}

async function advisory(session: ISqlSession, context: ICallContext, purpose: string): Promise<void> {
  await session.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1,0))::text AS locked',
    [context.operatorId + ':' + purpose],
  );
}

export function transactionStores(
  session: ISqlSession,
  writer: IAccountWriter,
  context: ICallContext,
  ids: IdGeneratorPort,
  clock: ClockPort,
): IFinancialTransactionPorts {
  let claimedRequestId: string | undefined;
  const guard = <T extends IFinancialTransactionPorts[keyof IFinancialTransactionPorts]>(
    port: T,
  ): T =>
    new Proxy(
      port,
      {
        get(target, key, receiver): unknown {
          const value: unknown = Reflect.get(target, key, receiver);

          return typeof value !== 'function'
            ? value
            : new Proxy(
              value,
              {
                apply(method, owner, args): unknown {
                  const supplied = object(args[0]);

                  if (supplied.operatorId !== context.operatorId || supplied.actorId !== context.actorId
                    || supplied.actorKind !== context.actorKind
                    || supplied.playerId !== context.playerId) {
                    throw new LedgerError(ErrorCode.PERMISSION_DENIED);
                  }

                  return Reflect.apply(method, owner, args);
                },
              },
            );
        },
      },
    );
  const ports: IFinancialTransactionPorts = {
    accounts: {
      findWallet: (ctx, id) => walletById(session, ctx, id),
      createWallet: async (ctx, wallet, accountIds) => {
        await advisory(session, ctx, 'wallet:' + wallet.playerId + ':' + wallet.currency);
        const existing = await walletByOwner(session, ctx, wallet.playerId, wallet.currency);

        if (existing) {
          return existing;
        }

        const now = clock.now();

        await session.query(
          'INSERT INTO wallets (wallet_id,operator_id,player_id,currency,status,created_at,updated_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::timestamptz,$6::timestamptz) RETURNING wallet_id',
          [wallet.walletId, ctx.operatorId, wallet.playerId, wallet.currency, wallet.status, now],
        );
        const chart = deriveChart(
          ctx.operatorId,
          wallet.walletId,
          wallet.currency,
          (op, identity, purpose) => ids.derive(op, identity, purpose),
        );

        if (accountIds.join(',') !== [chart.available, chart.reserved, chart.withdrawalHold].join(',')) {
          throw new LedgerError(ErrorCode.INVARIANT_VIOLATION);
        }

        const accounts = [
          {
            id: chart.available,
            kind: AccountKind.AVAILABLE,
            walletId: wallet.walletId,
            side: Side.CREDIT,
          },
          {
            id: chart.reserved,
            kind: AccountKind.RESERVED,
            walletId: wallet.walletId,
            side: Side.CREDIT,
          },
          {
            id: chart.withdrawalHold,
            kind: AccountKind.WITHDRAWAL_HOLD,
            walletId: wallet.walletId,
            side: Side.CREDIT,
          },
          { id: chart.clearing, kind: AccountKind.CLEARING, walletId: null, side: Side.DEBIT },
          { id: chart.revenue, kind: AccountKind.REVENUE, walletId: null, side: Side.CREDIT },
          { id: chart.expense, kind: AccountKind.EXPENSE, walletId: null, side: Side.DEBIT },
        ].sort(
          (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
        );

        for (const account of accounts) {
          await session.query(
            "INSERT INTO ledger_accounts (account_id,operator_id,wallet_id,currency,account_kind,normal_side,status,created_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,'ACTIVE',$7::timestamptz) ON CONFLICT(account_id) DO NOTHING RETURNING account_id",
            [
              account.id,
              ctx.operatorId,
              account.walletId,
              wallet.currency,
              account.kind,
              account.side,
              now,
            ],
          );
          await session.query(
            'INSERT INTO ledger_account_balances (account_id,operator_id,balance_minor,version,updated_at) VALUES($1::uuid,$2::uuid,0,1,$3::timestamptz) ON CONFLICT(account_id) DO NOTHING RETURNING account_id',
            [account.id, ctx.operatorId, now],
          );
        }
        const saved = await walletById(session, ctx, wallet.walletId);

        if (!saved) {
          throw new LedgerError(ErrorCode.INVARIANT_VIOLATION);
        }

        return saved;
      },
      loadAccounts: (ctx, accounts) => writer.load(session, ctx, accounts),
      applyDeltas: (ctx, deltas, versions) => writer.apply(session, ctx, deltas, versions, clock.now()),
    },
    journal: {
      append: async (ctx, posting) => {
        const header = { ...posting, operatorId: ctx.operatorId, correlationId: ctx.correlationId };
        const lines = posting.entries.map(entry => ({ ...entry, amount: entry.amountMinor.toString() }));

        await session.query(
          'SELECT public.ledger_append_posting($1::jsonb,$2::jsonb)::text AS appended',
          [losslessJson(header), losslessJson(lines)],
        );

        return posting;
      },
      find: (ctx, id) => journalById(session, ctx, id),
    },
    reservations: {
      find: async (ctx, id) => {
        await advisory(session, ctx, 'bet:' + id);

        return reservationById(session, ctx, id);
      },
      create: async (ctx, value) => {
        await session.query(
          'INSERT INTO ledger_bet_reservations (bet_reservation_id,operator_id,bet_id,wallet_id,stake_minor,currency,status,reservation_transaction_id,version,created_at,updated_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::bigint,$6,$7,$8::uuid,1,$9::timestamptz,$9::timestamptz) RETURNING bet_id',
          [
            ids.derive(ctx.operatorId, value.betId, 'ledger:reservation'),
            ctx.operatorId,
            value.betId,
            value.walletId,
            value.stake.amountMinor.toString(),
            value.stake.currency,
            value.state,
            value.reservationTransactionId,
            clock.now(),
          ],
        );

        return value;
      },
      transition: async (ctx, id, expected, next) => {
        const result = await session.query(
          'UPDATE ledger_bet_reservations SET status=$3,settlement_transaction_id=$4::uuid,settlement_seq=$5::bigint,gross_payout_minor=$6::bigint,version=version+1,updated_at=$7::timestamptz WHERE operator_id=$1::uuid AND bet_id=$2::uuid AND status=$8 RETURNING bet_id',
          [
            ctx.operatorId,
            id,
            next.state,
            next.settlementTransactionId ?? null,
            next.settlementSeq?.toString() ?? null,
            next.grossPayoutMinor?.toString() ?? null,
            clock.now(),
            expected,
          ],
        );

        if (result.length !== 1) {
          throw new LedgerError(ErrorCode.INVALID_STATE);
        }

        return next;
      },
    },
    withdrawals: {
      find: async (ctx, id) => {
        await advisory(session, ctx, 'withdrawal:' + id);

        return withdrawalById(session, ctx, id);
      },
      create: async (ctx, value) => {
        if (!validUuid(claimedRequestId)) {
          throw new LedgerError(ErrorCode.INVARIANT_VIOLATION);
        }
        await session.query(
          'INSERT INTO ledger_withdrawals (withdrawal_id,operator_id,request_id,wallet_id,amount_minor,currency,status,hold_transaction_id,created_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::bigint,$6,$7,$8::uuid,$9::timestamptz) RETURNING withdrawal_id',
          [
            value.withdrawalId,
            ctx.operatorId,
            claimedRequestId,
            value.walletId,
            value.amount.amountMinor.toString(),
            value.amount.currency,
            value.state,
            value.holdTransactionId,
            value.createdAt,
          ],
        );

        return value;
      },
      transition: async (ctx, id, expected, next) => {
        const result = await session.query(
          'UPDATE ledger_withdrawals SET status=$3,completion_transaction_id=$4::uuid,provider_ref=$5,reason_code=$6,resolved_at=$7::timestamptz WHERE operator_id=$1::uuid AND withdrawal_id=$2::uuid AND status=$8 RETURNING withdrawal_id',
          [
            ctx.operatorId,
            id,
            next.state,
            next.resolutionTransactionId ?? null,
            next.providerRef ?? null,
            next.reasonCode ?? null,
            next.resolvedAt ?? null,
            expected,
          ],
        );

        if (result.length !== 1) {
          throw new LedgerError(ErrorCode.INVALID_STATE);
        }

        return next;
      },
      listHeld: async (ctx, page, before) => {
        const result = await session.query(
          "SELECT withdrawal_id FROM ledger_withdrawals WHERE operator_id=$1::uuid AND status='HELD' AND created_at<=$2::timestamptz ORDER BY created_at,withdrawal_id LIMIT $3",
          [ctx.operatorId, before, page.limit],
        );
        const found: IWithdrawalView[] = [];

        for (const row of result) {
          const value = await withdrawalById(session, ctx, uuid(row.withdrawal_id));

          if (value) {
            found.push(value);
          }
        }

        return found;
      },
    },
    idempotency: {
      find: async (ctx, id) => {
        const result = await session.query(
          'SELECT * FROM ledger_idempotency_records WHERE operator_id=$1::uuid AND request_id=$2::uuid',
          [ctx.operatorId, id],
        );

        return result[0] ? decodeStoredCommand(result[0]) : undefined;
      },
      claim: async (ctx, id, operation, hash, input, stable) => {
        if (claimedRequestId !== undefined && claimedRequestId !== id) {
          throw new LedgerError(ErrorCode.INVARIANT_VIOLATION);
        }
        claimedRequestId = id;
        await advisory(session, ctx, 'command:' + id);
        const existing = await session.query(
          'SELECT * FROM ledger_idempotency_records WHERE operator_id=$1::uuid AND request_id=$2::uuid',
          [ctx.operatorId, id],
        );

        if (existing[0]) {
          const command = decodeStoredCommand(existing[0]);

          if (command.operation !== operation || command.payloadHash !== hash
            || command.actorId !== ctx.actorId
            || command.actorKind !== ctx.actorKind
            || command.playerId !== ctx.playerId) {
            throw new LedgerError(ErrorCode.IDEMPOTENCY_CONFLICT);
          }

          return { kind: command.outcome === undefined ? ClaimKind.IN_PROGRESS : ClaimKind.REPLAY, command };
        }

        const now = clock.now();

        await session.query(
          "INSERT INTO ledger_idempotency_records (idempotency_record_id,operator_id,request_id,operation,payload_hash,actor_id,actor_kind,player_id,semantic_input,stable_child_ids,state,created_at,updated_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::uuid,$7,$8::uuid,$9::jsonb,$10::jsonb,'IN_PROGRESS',$11::timestamptz,$11::timestamptz) RETURNING request_id",
          [
            ids.derive(ctx.operatorId, id, 'ledger:command'),
            ctx.operatorId,
            id,
            operation,
            hash,
            ctx.actorId,
            ctx.actorKind,
            ctx.playerId ?? null,
            losslessJson(input),
            losslessJson(stable),
            now,
          ],
        );

        return {
          kind: ClaimKind.NEW,
          command: {
            requestId: id,
            operation,
            payloadHash: hash,
            actorId: ctx.actorId,
            actorKind: ctx.actorKind,
            state: CommandState.IN_PROGRESS,
            semanticInput: input,
            stableChildIds: stable,
            updatedAt: now,
            ...(ctx.playerId === undefined ? {} : { playerId: ctx.playerId }),
          },
        };
      },
      complete: async (ctx, id, result) => {
        const changed = await session.query(
          "UPDATE ledger_idempotency_records SET response_snapshot=$3::jsonb,state=$4,updated_at=$5::timestamptz WHERE operator_id=$1::uuid AND request_id=$2::uuid AND actor_id=$6::uuid AND state='IN_PROGRESS' RETURNING request_id",
          [
            ctx.operatorId,
            id,
            losslessJson(result),
            result.ok ? CommandState.COMPLETED : CommandState.FAILED_FINAL,
            clock.now(),
            ctx.actorId,
          ],
        );

        if (changed.length !== 1) {
          throw new LedgerError(ErrorCode.IDEMPOTENCY_CONFLICT);
        }
      },
    },
    outbox: {
      append: async (ctx, event) => {
        if (event.operatorId !== ctx.operatorId) {
          throw new LedgerError(ErrorCode.INVARIANT_VIOLATION);
        }
        await session.query(
          'INSERT INTO ledger_outbox_events (ledger_outbox_event_id,operator_id,message_id,event_type,subject_id,payload,occurred_at,attempt_count,next_attempt_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6::jsonb,$7::timestamptz,0,$7::timestamptz) RETURNING message_id',
          [
            event.messageId,
            ctx.operatorId,
            event.messageId,
            event.eventType,
            event.payload.transactionId ?? event.payload.walletId ?? event.payload.withdrawalId
            ?? ctx.actorId,
            losslessJson(event),
            event.occurredAt,
          ],
        );
      },
    },
  };

  return {
    accounts: guard(ports.accounts),
    journal: guard(ports.journal),
    reservations: guard(ports.reservations),
    withdrawals: guard(ports.withdrawals),
    idempotency: guard(ports.idempotency),
    outbox: guard(ports.outbox),
  };
}

interface IHistoryCursor {
  version: number;
  scope: string;
  cutoff: string;
  time: string;
  id: string;
}

function historyScope(context: ICallContext, walletId: string, page: IPageInput, kind: string): string {
  return createHash('sha256').update(
    losslessJson(
      [
        context.operatorId,
        context.actorId,
        context.playerId ?? null,
        walletId,
        page.from ?? null,
        page.to ?? null,
        kind,
      ],
    ),
  ).digest(
    'hex',
  );
}

export async function historyPage<T extends IEntry | IJournalView>(
  session: ISqlSession,
  context: ICallContext,
  walletId: string,
  page: IPageInput,
  kind: 'entries' | 'transactions',
  decode: (value: unknown) => T,
): Promise<IPageResult<T>> {
  const scope = historyScope(context, walletId, page, kind);
  const observed = (await session.query('SELECT transaction_timestamp() AS observed_at'))[0];

  if (!observed) {
    throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  let cursor: IHistoryCursor | undefined;

  if (page.cursor !== undefined) {
    try {
      if (Buffer.from(page.cursor, 'base64url').toString('base64url') !== page.cursor) {
        throw new Error('Invalid encoding');
      }

      const value: unknown = JSON.parse(Buffer.from(page.cursor, 'base64url').toString('utf8'));
      const record = object(value);

      if (record.version !== 1 || record.scope !== scope) {
        throw new Error('Cursor scope mismatch');
      }
      cursor =
        {
          version: 1,
          scope,
          cutoff: timestamp(record.cutoff),
          time: timestamp(record.time),
          id: uuid(record.id),
        };
    } catch {
      throw new LedgerError(ErrorCode.INVALID_INPUT);
    }
  }

  const cutoff = cursor?.cutoff ?? timestamp(observed.observed_at);
  const parameters: SqlParameter[] = [
    context.operatorId,
    walletId,
    playerScope(context),
    cutoff,
    cursor?.time ?? null,
    cursor?.id ?? null,
    page.from ?? null,
    page.to ?? null,
    page.limit + 1,
  ];
  const predicate =
    `AND ($5::timestamptz IS NULL OR (${kind
      === 'entries'
      ? 'e.posted_at,e.ledger_entry_id'
      : 'h.created_at,h.ledger_transaction_id'})>($5::timestamptz,$6::uuid))`;
  const query =
    kind === 'entries'
      ? `SELECT ${ENTRY_JSON} AS value,e.posted_at AS page_time,e.ledger_entry_id AS page_id FROM ledger_entries e
    JOIN ledger_accounts a ON a.account_id=e.account_id AND a.operator_id=e.operator_id JOIN wallets w ON w.wallet_id=a.wallet_id AND w.operator_id=a.operator_id
    WHERE e.operator_id=$1::uuid AND w.wallet_id=$2::uuid AND ($3::uuid IS NULL OR w.player_id=$3::uuid) AND e.posted_at<=$4::timestamptz
    AND ($7::timestamptz IS NULL OR e.posted_at>=$7::timestamptz) AND ($8::timestamptz IS NULL OR e.posted_at<=$8::timestamptz) ${predicate} ORDER BY e.posted_at,e.ledger_entry_id LIMIT $9`
      : `SELECT ${JOURNAL_JSON} AS value,h.created_at AS page_time,h.ledger_transaction_id AS page_id FROM ledger_transactions h
    WHERE h.operator_id=$1::uuid AND h.created_at<=$4::timestamptz AND ($7::timestamptz IS NULL OR h.created_at>=$7::timestamptz) AND ($8::timestamptz IS NULL OR h.created_at<=$8::timestamptz)
    AND EXISTS(SELECT 1 FROM ledger_entries e JOIN ledger_accounts a ON a.account_id=e.account_id AND a.operator_id=e.operator_id JOIN wallets w ON w.wallet_id=a.wallet_id AND w.operator_id=a.operator_id WHERE e.operator_id=h.operator_id AND e.ledger_transaction_id=h.ledger_transaction_id AND w.wallet_id=$2::uuid AND ($3::uuid IS NULL OR w.player_id=$3::uuid)) ${predicate} ORDER BY h.created_at,h.ledger_transaction_id LIMIT $9`;
  const result = await session.query(query, parameters);
  const selected = result.slice(0, page.limit);
  const last = selected.at(-1);

  return {
    items: selected.map(row => decode(row.value)),
    observedAt: cutoff,
    ...(result.length > page.limit && last
      ? {
        nextCursor: Buffer.from(
          losslessJson(
            { version: 1, scope, cutoff, time: timestamp(last.page_time), id: uuid(last.page_id) },
          ),
        ).toString(
          'base64url',
        ),
      }
      : {}),
  };
}

export { decodeEntry, decodeJournal };

import { createHash } from 'node:crypto';
