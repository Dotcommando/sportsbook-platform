import { CapabilityPolicy } from '../../domain/capability.policy.js';
import { failure, LedgerError, MAX_INT64, success, validInstant, validUuid } from '../../domain/ledger.error.js';
import type {
  ICallContext,
  IFinancialOutcome,
  IJournalView,
  IMoney,
  IOperatorFinancialPolicy,
  IResult,
  IStableChildId,
  IWalletView,
  RegisteredInput,
  RegisteredOutput,
  UUID,
} from '../../domain/ledger.model.js';
import {
  AccountKind,
  ActorKind,
  Capability,
  ClaimKind,
  ErrorCode,
  EventSource,
  EventType,
  FinancialState,
  WalletState,
} from '../../domain/ledger.model.js';
import { PostingPolicy } from '../../domain/posting.policy.js';
import type {
  ClockPort,
  CommandFingerprintPort,
  FinancialUnitOfWorkPort,
  IdGeneratorPort,
  IFinancialTransactionPorts,
} from '../../ports/outbound/financial.port.js';
import { chartIds, POSTING_ACCOUNTS } from '../financial-command.factory.js';
import { validReservation, validWithdrawal } from './financial-query.service.js';

export interface ILedgerCommandDependencies {
  unitOfWork: FinancialUnitOfWorkPort;
  clock: ClockPort;
  ids: IdGeneratorPort;
  fingerprint: CommandFingerprintPort;
  policies: readonly IOperatorFinancialPolicy[];
}

export interface IPreparedCommand {
  transactionId: UUID;
  walletId: UUID;
  eventId: UUID;
  entryIds: UUID[];
  occurredAt: string;
}

export class FinancialCommandService {
  constructor(readonly dependencies: ILedgerCommandDependencies) { }

  authorize(context: ICallContext, capability: Capability, kind?: ActorKind): IResult<void> {
    const authorized = CapabilityPolicy.authorize(context, capability);

    if (!authorized.ok) {
      return authorized;
    }
    if (Date.parse(context.deadlineAt) <= Date.parse(this.dependencies.clock.now())) {
      return failure(ErrorCode.DEADLINE_EXCEEDED, context.correlationId);
    }
    if (kind !== undefined && context.actorKind !== kind) {
      return failure(ErrorCode.PERMISSION_DENIED, context.correlationId);
    }

    const policy = this.policy(context);

    if (!policy) {
      return failure(ErrorCode.PERMISSION_DENIED, context.correlationId);
    }
    if (context.actorKind !== ActorKind.PLAYER
      && !policy.trustedActors.some(
        actor =>
          actor.actorId === context.actorId && actor.actorKind === context.actorKind
          && actor.capabilities.includes(capability),
      )) {
      return failure(ErrorCode.PERMISSION_DENIED, context.correlationId);
    }

    return success(undefined);
  }

  policy(context: ICallContext): IOperatorFinancialPolicy | undefined {
    return this.dependencies.policies.find(policy => policy.operatorId === context.operatorId);
  }

  checkMoney(context: ICallContext, money: IMoney, currency: string): IResult<void> {
    if (money === null || typeof money !== 'object'
      || Object.keys(money).some(key => !['amountMinor', 'currency'].includes(key))) {
      return failure(ErrorCode.INVALID_INPUT, context.correlationId);
    }

    const policy = this.policy(context)?.currencies.find(item => item.currency === money.currency);

    if (!policy || money.currency !== currency) {
      return failure(ErrorCode.CURRENCY_MISMATCH, context.correlationId);
    }
    if (typeof money.amountMinor !== 'bigint' || money.amountMinor < policy.minimumMinor
      || money.amountMinor > policy.maximumMinor
      || money.amountMinor <= 0n
      || money.amountMinor > MAX_INT64) {
      return failure(ErrorCode.AMOUNT_OUT_OF_RANGE, context.correlationId);
    }

    return success(undefined);
  }

  checkProvider(context: ICallContext, providerRef: string): IResult<void> {
    const policy = this.policy(context);
    const binding = policy?.trustedActors.find(
      actor => actor.actorId === context.actorId && actor.actorKind === context.actorKind,
    )?.providerName;

    if (!binding || !policy?.providerNames.includes(binding) || typeof providerRef !== 'string'
      || providerRef.length > 128
      || !/^[A-Za-z0-9][A-Za-z0-9._-]*:[A-Za-z0-9._:-]+$/.test(providerRef)
      || !providerRef.startsWith(binding + ':')) {
      return failure(ErrorCode.INVALID_INPUT, context.correlationId);
    }

    return success(undefined);
  }

  async wallet(
    ports: IFinancialTransactionPorts,
    context: ICallContext,
    walletId: UUID,
  ): Promise<
    IResult<
      IWalletView
    >
  > {
    const wallet = await ports.accounts.findWallet(context, walletId);

    if (!wallet) {
      return failure(ErrorCode.NOT_FOUND, context.correlationId);
    }

    const ownership = CapabilityPolicy.authorize(
      context,
      context.capabilities[0] ?? Capability.READ_WALLET,
      wallet.playerId,
    );

    if (!ownership.ok) {
      return ownership;
    }
    if (!validWallet(wallet) || wallet.walletId !== walletId) {
      return failure(ErrorCode.ADAPTER_CONTRACT_VIOLATION, context.correlationId);
    }
    if (wallet.status !== WalletState.ACTIVE) {
      return failure(ErrorCode.INVALID_STATE, context.correlationId);
    }

    return success(wallet);
  }

  async execute(
    input: RegisteredInput & { context: ICallContext; requestId: UUID },
    operation: string,
    capability: Capability,
    kind: ActorKind | undefined,
    fields: readonly string[],
    work: (ports: IFinancialTransactionPorts, prepared: IPreparedCommand) => Promise<IResult<RegisteredOutput>>,
  ): Promise<IResult<RegisteredOutput>> {
    const context = input.context;
    const authority = this.authorize(context, capability, kind);

    if (!authority.ok) {
      return authority;
    }
    if (!validUuid(input.requestId) || Object.keys(input).some(key => !fields.includes(key))) {
      return failure(ErrorCode.INVALID_INPUT, context.correlationId);
    }

    const ids = this.dependencies.ids;
    const prepared: IPreparedCommand = {
      transactionId: ids.derive(context.operatorId, input.requestId, 'ledger:transaction'),
      walletId: ids.derive(context.operatorId, input.requestId, 'ledger:wallet'),
      eventId: ids.derive(context.operatorId, input.requestId, 'ledger:event:' + operation),
      entryIds: [0, 1, 2].map(
        index => ids.derive(context.operatorId, input.requestId, 'ledger:entry:' + index),
      ),
      occurredAt: this.dependencies.clock.now(),
    };
    const stable: IStableChildId[] = [
      { purpose: 'ledger:transaction', id: prepared.transactionId },
      { purpose: 'ledger:wallet', id: prepared.walletId },
      { purpose: 'ledger:event:' + operation, id: prepared.eventId },
      ...prepared.entryIds.map((id, index) => ({ purpose: 'ledger:entry:' + index, id })),
      {
        purpose: 'ledger:event:withdrawal-resolved',
        id: ids.derive(context.operatorId, input.requestId, 'ledger:event:withdrawal-resolved'),
      },
    ];

    if (stable.some(item => !validUuid(item.id)) || !validInstant(prepared.occurredAt)) {
      return failure(ErrorCode.ADAPTER_CONTRACT_VIOLATION, context.correlationId);
    }

    const hash = this.dependencies.fingerprint.hash(operation, input);

    return this.dependencies.unitOfWork.run(
      context,
      async ports => {
        const claim = await ports.idempotency.claim(context, input.requestId, operation, hash, input, stable);

        if (claim.kind === ClaimKind.IN_PROGRESS) {
          return failure(ErrorCode.IN_PROGRESS, context.correlationId, true);
        }
        if (claim.kind === ClaimKind.REPLAY) {
          const saved = claim.command.outcome;

          if (!saved) {
            return failure(ErrorCode.ADAPTER_CONTRACT_VIOLATION, context.correlationId);
          }
          if (saved.ok && 'outcome' in saved.value) {
            return success({ ...saved.value, outcome: { ...saved.value.outcome, replayed: true } });
          }

          return saved;
        }

        const result = await work(ports, prepared);

        if (result.ok) {
          const value = result.value;

          if ('wallet' in value && !validWallet(value.wallet)) {
            throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);
          }
          if ('outcome' in value
            && (!validWallet(value.outcome.wallet) || value.outcome.requestId !== input.requestId
              || !validUuid(value.outcome.transactionId)
              || !validUuid(value.outcome.businessRef)
              || value.outcome.state !== FinancialState.COMPLETED)) {
            throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);
          }
          if ('reservation' in value && value.reservation && !validReservation(value.reservation)) {
            throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);
          }
          if ('withdrawal' in value && !validWithdrawal(value.withdrawal)) {
            throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);
          }
        }

        const contextual: IResult<RegisteredOutput> = result.ok
          ? result
          : { ok: false, error: { ...result.error, correlationId: context.correlationId } };

        await ports.idempotency.complete(context, input.requestId, contextual);

        return contextual;
      },
    );
  }

  async post(
    ports: IFinancialTransactionPorts,
    context: ICallContext,
    wallet: IWalletView,
    prepared: IPreparedCommand,
    requestId: UUID,
    transactionType: IJournalView['transactionType'],
    businessRef: string,
    amount: bigint,
    stake?: bigint,
  ): Promise<IResult<IFinancialOutcome>> {
    const chart = chartIds(this.dependencies.ids, context.operatorId, wallet.walletId, wallet.currency);
    const accountMap: Record<AccountKind, UUID> = {
      [AccountKind.AVAILABLE]: chart.available,
      [AccountKind.RESERVED]: chart.reserved,
      [AccountKind.WITHDRAWAL_HOLD]: chart.withdrawalHold,
      [AccountKind.CLEARING]: chart.clearing,
      [AccountKind.REVENUE]: chart.revenue,
      [AccountKind.EXPENSE]: chart.expense,
    };
    const accounts = await ports.accounts.loadAccounts(
      context,
      POSTING_ACCOUNTS[transactionType].map(kind => accountMap[kind]).sort(),
    );
    const posting = PostingPolicy.build(
      {
        requestId,
        correlationId: context.correlationId,
        transactionType,
        businessRef,
        currency: wallet.currency,
        amountMinor: amount,
        ...(stake === undefined ? {} : { stakeMinor: stake }),
        entryIds: prepared.entryIds,
      },
      accounts,
      prepared.transactionId,
      prepared.occurredAt,
    );

    if (!posting.ok) {
      return posting;
    }

    const projected = PostingPolicy.project(posting.value, accounts);

    if (!projected.ok) {
      return projected;
    }

    const versions = projected.value.map(
      delta => {
        const account = accounts.find(item => item.accountId === delta.accountId);

        if (!account) {
          throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);
        }

        return account.version;
      },
    );

    await ports.accounts.applyDeltas(context, projected.value, versions);
    await ports.journal.append(context, posting.value);
    const businessId = validUuid(businessRef) ? businessRef : wallet.walletId;

    await ports.outbox.append(
      context,
      {
        messageId: prepared.eventId,
        source: EventSource.LEDGER,
        eventType: EventType.LEDGER_POSTED,
        schemaVersion: 1,
        operatorId: context.operatorId,
        correlationId: context.correlationId,
        occurredAt: prepared.occurredAt,
        payload: {
          transactionId: prepared.transactionId,
          requestId,
          businessRef: businessId,
          transactionType,
          currency: wallet.currency,
          amountMinor: amount,
        },
      },
    );
    const updated = await this.wallet(ports, context, wallet.walletId);

    if (!updated.ok) {
      throw new LedgerError(ErrorCode.ADAPTER_CONTRACT_VIOLATION);
    }

    return success(
      {
        requestId,
        state: FinancialState.COMPLETED,
        transactionId: prepared.transactionId,
        businessRef: businessId,
        wallet: updated.value,
        replayed: false,
      },
    );
  }
}

export function validWallet(wallet: IWalletView): boolean {
  return validUuid(wallet.walletId) && validUuid(wallet.playerId) && /^[A-Z]{3}$/.test(wallet.currency)
    && Object.values(WalletState).includes(wallet.status)
    && [wallet.availableMinor, wallet.reservedMinor, wallet.withdrawalHoldMinor].every(
      value => typeof value === 'bigint' && value >= 0n && value <= MAX_INT64,
    )
    && typeof wallet.version === 'bigint'
    && wallet.version >= 1n
    && wallet.version <= MAX_INT64
    && validInstant(wallet.observedAt);
}
