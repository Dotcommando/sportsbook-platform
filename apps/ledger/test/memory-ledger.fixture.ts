import { deriveChart } from '../src/domain/chart.policy.js';
import { failure, LedgerError } from '../src/domain/ledger.error.js';
import type { IAccountState, ICallContext, IEventEnvelope, IJournalView, IPageInput, IReconciliationReport, IReservationView, IResult, IStoredCommand, IWalletView, IWithdrawalView } from '../src/domain/ledger.model.js';
import { AccountKind, ActorKind, AuditState, ClaimKind, CommandState, ErrorCode, Side } from '../src/domain/ledger.model.js';
import { PostingPolicy } from '../src/domain/posting.policy.js';
import type { FinancialQueryPort, FinancialUnitOfWorkPort, IdGeneratorPort, IFinancialTransactionPorts, ReconciliationStorePort } from '../src/ports/outbound/financial.port.js';

export enum MemoryFault { NONE, BEFORE_COMMIT, AFTER_COMMIT }

export interface IMemoryState {
  wallets: Map<string, IWalletView>;
accounts: Map<string, IAccountState>;
journals: Map<string, IJournalView>;
  reservations: Map<string, IReservationView>;
withdrawals: Map<string, IWithdrawalView>;
  commands: Map<string, IStoredCommand>;
outbox: IEventEnvelope[];
}

export class MemoryLedger implements FinancialUnitOfWorkPort, FinancialQueryPort, ReconciliationStorePort {
  state: IMemoryState = { wallets:new Map(), accounts:new Map(), journals:new Map(), reservations:new Map(), withdrawals:new Map(), commands:new Map(), outbox:[] };
  fault = MemoryFault.NONE;
  readCalls = 0;

  constructor(private readonly ids:IdGeneratorPort, private readonly now:string) {}

  private key(context:ICallContext, id:string):string { return context.operatorId + ':' + id; }

  private owned(context:ICallContext, wallet:IWalletView | undefined):IWalletView | undefined { return wallet && (context.actorKind === ActorKind.SYSTEM || context.playerId === wallet.playerId) ? structuredClone(wallet) : undefined; }

  private wallet(context:ICallContext, id:string):IWalletView | undefined {
    const wallet = this.owned(context, this.state.wallets.get(this.key(context, id)));

    if (!wallet) return undefined;

    const chart = deriveChart(context.operatorId, id, wallet.currency, (op, identity, purpose)=>this.ids.derive(op, identity, purpose));
    const amounts = [chart.available, chart.reserved, chart.withdrawalHold].map(accountId=>this.state.accounts.get(this.key(context, accountId)));

    return {...wallet, availableMinor:amounts[0]?.balanceMinor ?? 0n, reservedMinor:amounts[1]?.balanceMinor ?? 0n, withdrawalHoldMinor:amounts[2]?.balanceMinor ?? 0n, version:amounts.reduce((total, a)=>total + (a?.version ?? 0n), 0n), observedAt:this.now};
  }

  async run<T>(context:ICallContext, work:(ports:IFinancialTransactionPorts)=>Promise<IResult<T>>):Promise<IResult<T>> {
    const before = structuredClone(this.state);
    let active = true;
    const ensure = ():void=>{if (!active) throw new Error('Escaped transaction store');};
    const ports:IFinancialTransactionPorts = {
      accounts:{
        findWallet:async(ctx, id)=>{ensure();

return this.wallet(ctx, id);},
        createWallet:async(ctx, wallet, accountIds)=>{
          ensure();
          const existing = [...this.state.wallets.entries()].find(([key, item])=>key.startsWith(ctx.operatorId + ':') && item.playerId === wallet.playerId && item.currency === wallet.currency);

          if (existing) return existing[1];
          this.state.wallets.set(this.key(ctx, wallet.walletId), structuredClone(wallet));
          const chart = deriveChart(ctx.operatorId, wallet.walletId, wallet.currency, (op, identity, purpose)=>this.ids.derive(op, identity, purpose));
          const kinds = [AccountKind.AVAILABLE, AccountKind.RESERVED, AccountKind.WITHDRAWAL_HOLD, AccountKind.CLEARING, AccountKind.REVENUE, AccountKind.EXPENSE];
          const allIds = [...accountIds, chart.clearing, chart.revenue, chart.expense];

          for (const [index, kind] of kinds.entries()) {
            const accountId = allIds[index];

            if (!accountId) throw new Error('Missing account identity');

            const key = this.key(ctx, accountId);

            if (!this.state.accounts.has(key)) this.state.accounts.set(key, {accountId, currency:wallet.currency, accountKind:kind, normalSide:kind === AccountKind.CLEARING || kind === AccountKind.EXPENSE ? Side.DEBIT : Side.CREDIT, balanceMinor:0n, version:1n, ...(index < 3 ? {walletId:wallet.walletId} : {})});
          }

          return this.wallet(ctx, wallet.walletId) ?? wallet;
        },
        loadAccounts:async(ctx, ids)=>{ensure();

return ids.map(id=>{const item = this.state.accounts.get(this.key(ctx, id));

if (!item) throw new LedgerError(ErrorCode.NOT_FOUND);

return structuredClone(item);});},
        applyDeltas:async(ctx, deltas, versions)=>{
          ensure();

          return deltas.map((delta, index)=>{
            const key = this.key(ctx, delta.accountId);
            const old = this.state.accounts.get(key);

            if (!old || old.version !== versions[index]) throw new LedgerError(ErrorCode.VERSION_CONFLICT);
            if (old.walletId && old.balanceMinor + delta.deltaMinor < 0n) throw new LedgerError(ErrorCode.VERSION_CONFLICT);

            const next = {...old, balanceMinor:old.balanceMinor + delta.deltaMinor, version:old.version + 1n};

            this.state.accounts.set(key, next);

return structuredClone(next);
          });
        },
      },
      journal:{append:async(ctx, posting)=>{ensure();

if (!PostingPolicy.validate(posting).ok) throw new LedgerError(ErrorCode.INVARIANT_VIOLATION);this.state.journals.set(this.key(ctx, posting.transactionId), structuredClone(posting));

return posting;},
find:async(ctx, id)=>{ensure();

return this.getTransaction(ctx, id);}},
      reservations:{find:async(ctx, id)=>{ensure();

return this.getReservation(ctx, id);},
create:async(ctx, value)=>{ensure();const key = this.key(ctx, value.betId);

if (this.state.reservations.has(key)) throw new LedgerError(ErrorCode.IDEMPOTENCY_CONFLICT);this.state.reservations.set(key, structuredClone(value));

return value;},
transition:async(ctx, id, expected, next)=>{ensure();const key = this.key(ctx, id);

if (this.state.reservations.get(key)?.state !== expected) throw new LedgerError(ErrorCode.INVALID_STATE);this.state.reservations.set(key, structuredClone(next));

return next;}},
      withdrawals:{find:async(ctx, id)=>{ensure();

return this.getWithdrawal(ctx, id);},
create:async(ctx, value)=>{ensure();const key = this.key(ctx, value.withdrawalId);

if (this.state.withdrawals.has(key)) throw new LedgerError(ErrorCode.IDEMPOTENCY_CONFLICT);this.state.withdrawals.set(key, structuredClone(value));

return value;},
transition:async(ctx, id, expected, next)=>{ensure();const key = this.key(ctx, id);

if (this.state.withdrawals.get(key)?.state !== expected) throw new LedgerError(ErrorCode.INVALID_STATE);this.state.withdrawals.set(key, structuredClone(next));

return next;},
listHeld:async()=>[]},
      idempotency:{
        find:async(ctx, id)=>{ensure();

return this.state.commands.get(this.key(ctx, id));},
        claim:async(ctx, id, operation, payloadHash, semanticInput, stableChildIds)=>{
          ensure();
          const key = this.key(ctx, id);
          const existing = this.state.commands.get(key);

          if (existing) {if (existing.payloadHash !== payloadHash || existing.operation !== operation || existing.actorId !== ctx.actorId || existing.playerId !== ctx.playerId) throw new LedgerError(ErrorCode.IDEMPOTENCY_CONFLICT);

return {kind:existing.outcome ? ClaimKind.REPLAY : ClaimKind.IN_PROGRESS, command:existing};}

          const command:IStoredCommand = {requestId:id, operation, payloadHash, state:CommandState.IN_PROGRESS, actorId:ctx.actorId, actorKind:ctx.actorKind, updatedAt:this.now, semanticInput:structuredClone(semanticInput), stableChildIds:structuredClone(stableChildIds), ...(ctx.playerId === undefined ? {} : {playerId:ctx.playerId})};

          this.state.commands.set(key, command);

return {kind:ClaimKind.NEW, command};
        },
        complete:async(ctx, id, outcome)=>{ensure();const item = this.state.commands.get(this.key(ctx, id));

if (!item) throw new Error('No claim');item.outcome = structuredClone(outcome);item.state = outcome.ok ? CommandState.COMPLETED : CommandState.FAILED_FINAL;},
      },
      outbox:{append:async(_ctx, event)=>{ensure();this.state.outbox.push(structuredClone(event));}},
    };

    try {
      const result = await work(ports);

      if (!result.ok && (result.error.retryable || result.error.outcomeUnknown)) {this.state = before;

return result;}
      if (this.fault === MemoryFault.BEFORE_COMMIT) {this.fault = MemoryFault.NONE;this.state = before;

return failure(ErrorCode.DEPENDENCY_UNAVAILABLE, context.correlationId, true);}
      if (this.fault === MemoryFault.AFTER_COMMIT) {this.fault = MemoryFault.NONE;

return failure(ErrorCode.DEPENDENCY_UNAVAILABLE, context.correlationId, true, true);}

      return result;
    } catch(error) {this.state = before;

return failure(error instanceof LedgerError ? error.code : ErrorCode.DEPENDENCY_UNAVAILABLE, context.correlationId);}
    finally {active = false;}
  }

  async getBalance(context:ICallContext, walletId:string):Promise<IWalletView | undefined> { this.readCalls++;

return this.wallet(context, walletId); }

  async getWallet(context:ICallContext, playerId:string, currency:string):Promise<IWalletView | undefined> {
    const item = [...this.state.wallets.entries()].find(([key, wallet])=>key.startsWith(context.operatorId + ':') && wallet.playerId === playerId && wallet.currency === currency);

    return item ? this.wallet(context, item[1].walletId) : undefined;
  }

  async getTransaction(context:ICallContext, id:string):Promise<IJournalView | undefined> {
    const item = this.state.journals.get(this.key(context, id));

    if (!item) return undefined;
    if (context.actorKind !== ActorKind.SYSTEM && !item.entries.some(entry=>{const account = this.state.accounts.get(this.key(context, entry.accountId));

return account?.walletId && this.wallet(context, account.walletId);} )) return undefined;

    return structuredClone(item);
  }

  async listEntries(context:ICallContext, walletId:string, page:IPageInput):Promise<{items:IJournalView['entries'];observedAt:string}> {
    const wallet = this.wallet(context, walletId);
    const items = wallet ? [...this.state.journals.entries()].filter(([key])=>key.startsWith(context.operatorId + ':')).flatMap(([,j])=>j.entries).filter(entry=>this.state.accounts.get(this.key(context, entry.accountId))?.walletId === walletId).slice(0, page.limit) : [];

    return {items, observedAt:this.now};
  }

  async listTransactions(context:ICallContext, walletId:string, page:IPageInput):Promise<{items:IJournalView[];observedAt:string}> {
    const items = this.wallet(context, walletId) ? [...this.state.journals.entries()].filter(([key, j])=>key.startsWith(context.operatorId + ':') && j.entries.some(entry=>this.state.accounts.get(this.key(context, entry.accountId))?.walletId === walletId)).map(([,j])=>structuredClone(j)).slice(0, page.limit) : [];

    return {items, observedAt:this.now};
  }

  async getReservation(context:ICallContext, id:string):Promise<IReservationView | undefined> { const item = this.state.reservations.get(this.key(context, id));

return item && this.wallet(context, item.walletId) ? structuredClone(item) : undefined; }

  async getWithdrawal(context:ICallContext, id:string):Promise<IWithdrawalView | undefined> { const item = this.state.withdrawals.get(this.key(context, id));

return item && this.wallet(context, item.walletId) ? structuredClone(item) : undefined; }

  async getCommandOutcome(context:ICallContext, id:string):Promise<IStoredCommand | undefined> { const item = this.state.commands.get(this.key(context, id));

return item && (item.actorId === context.actorId || item.playerId === context.playerId) ? structuredClone(item) : undefined; }

  async scan(context:ICallContext, cutoff:string, page:IPageInput):Promise<IReconciliationReport> {
    const journals = [...this.state.journals.entries()].filter(([key])=>key.startsWith(context.operatorId + ':')).map(([,j])=>j);
    const sums = new Map<string, bigint>();
    let violations = 0n;

    for (const journal of journals) {let total = 0n;

for (const entry of journal.entries) {total += entry.side === Side.DEBIT ? entry.amountMinor : -entry.amountMinor;const a = this.state.accounts.get(this.key(context, entry.accountId));

if (!a) {violations++;continue;}sums.set(entry.accountId, (sums.get(entry.accountId) ?? 0n) + (entry.side === a.normalSide ? entry.amountMinor : -entry.amountMinor));}

 if (total !== 0n)violations++;}

    for (const [key, account] of this.state.accounts) {if (key.startsWith(context.operatorId + ':') && account.balanceMinor !== (sums.get(account.accountId) ?? 0n))violations++;}

    return {runId:this.ids.next('reconcile'), snapshotAt:cutoff, status:violations === 0n ? AuditState.PASS : AuditState.FAIL, counts:{transactions:BigInt(journals.length), entries:BigInt(journals.flatMap(j=>j.entries).length), violations}, violations:Array.from({length:Math.min(Number(violations), page.limit)}, ()=>({code:'PROJECTION_MISMATCH'}))};
  }

  async record():Promise<void> {}
}
