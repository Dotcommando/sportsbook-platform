import { CommandFingerprint } from '../src/adapters/outbound/ids/command-fingerprint.js';
import { UuidGenerator } from '../src/adapters/outbound/ids/uuid-generator.js';
import { CancelBetUseCase } from '../src/app/use-cases/cancel-bet.use-case.js';
import { CompleteWithdrawalUseCase } from '../src/app/use-cases/complete-withdrawal.use-case.js';
import { CreateWalletUseCase } from '../src/app/use-cases/create-wallet.use-case.js';
import { DepositTestFundsUseCase } from '../src/app/use-cases/deposit-test-funds.use-case.js';
import { GetBalanceUseCase } from '../src/app/use-cases/get-balance.use-case.js';
import { GetBetFinancialStatusUseCase } from '../src/app/use-cases/get-bet-financial-status.use-case.js';
import { GetCommandOutcomeUseCase } from '../src/app/use-cases/get-command-outcome.use-case.js';
import { GetLedgerEntriesUseCase } from '../src/app/use-cases/get-ledger-entries.use-case.js';
import { GetTransactionUseCase } from '../src/app/use-cases/get-transaction.use-case.js';
import { GetWalletUseCase } from '../src/app/use-cases/get-wallet.use-case.js';
import { GetWalletTransactionsUseCase } from '../src/app/use-cases/get-wallet-transactions.use-case.js';
import { GetWithdrawalUseCase } from '../src/app/use-cases/get-withdrawal.use-case.js';
import { ReconcileLedgerUseCase } from '../src/app/use-cases/reconcile-ledger.use-case.js';
import { RejectWithdrawalUseCase } from '../src/app/use-cases/reject-withdrawal.use-case.js';
import { RequestWithdrawalUseCase } from '../src/app/use-cases/request-withdrawal.use-case.js';
import { ReserveStakeUseCase } from '../src/app/use-cases/reserve-stake.use-case.js';
import { SettleLossUseCase } from '../src/app/use-cases/settle-loss.use-case.js';
import { SettleWinUseCase } from '../src/app/use-cases/settle-win.use-case.js';
import type { ICallContext, IOperatorFinancialPolicy } from '../src/domain/ledger.model.js';
import { ActorKind, Capability } from '../src/domain/ledger.model.js';
import type { ILedgerOperationPorts } from '../src/ports/inbound/ledger-application.port.js';
import { MemoryLedger } from './memory-ledger.fixture.js';

export function transportFixture(now: string): {
  operations: ILedgerOperationPorts;
  store: MemoryLedger;
  system: ICallContext;
  playerId: string;
  betting: ICallContext;
  player: ICallContext;
  ids: UuidGenerator
} {
  const ids = new UuidGenerator('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  const operatorId = '00000000-0000-4000-8000-000000000001';
  const playerId = '00000000-0000-4000-8000-000000000002';
  const system: ICallContext = {
    operatorId,
    actorId: '00000000-0000-4000-8000-000000000003',
    actorKind: ActorKind.SYSTEM,
    capabilities: Object.values(Capability),
    correlationId: '00000000-0000-4000-8000-000000000004',
    deadlineAt: new Date(Date.parse(now) + 60000).toISOString(),
  };
  const betting: ICallContext = {
    ...system,
    actorId: '00000000-0000-4000-8000-000000000005',
    actorKind: ActorKind.SERVICE,
    playerId,
    capabilities: [Capability.RESERVE_STAKE, Capability.SETTLE_BET, Capability.CANCEL_RESERVATION],
  };
  const player: ICallContext = {
    ...system,
    actorId: playerId,
    actorKind: ActorKind.PLAYER,
    playerId,
    capabilities: [Capability.READ_WALLET, Capability.READ_JOURNAL, Capability.WITHDRAW],
  };
  const policy: IOperatorFinancialPolicy = {
    operatorId,
    currencies: [{ currency: 'USD', minimumMinor: 1n, maximumMinor: 9223372036854775807n }],
    providerNames: ['synthetic'],
    rejectionReasons: ['PAYMENT_REJECTED'],
    trustedActors: [{ ...system, providerName: 'synthetic' }, betting],
  };
  const store = new MemoryLedger(ids, now);
  const commands = {
    unitOfWork: store,
    ids,
    clock: { now: () => now },
    fingerprint: new CommandFingerprint(),
    policies: [policy],
  };
  const reads = { queries: store, reconciliation: store, clock: { now: () => now }, policies: [policy] };

  return {
    store,
    system,
    playerId,
    betting,
    player,
    ids,
    operations: {
      createWallet: new CreateWalletUseCase(commands),
      depositTestFunds: new DepositTestFundsUseCase(commands),
      requestWithdrawal: new RequestWithdrawalUseCase(commands),
      completeWithdrawal: new CompleteWithdrawalUseCase(commands),
      rejectWithdrawal: new RejectWithdrawalUseCase(commands),
      reserveStake: new ReserveStakeUseCase(commands),
      settleWin: new SettleWinUseCase(commands),
      settleLoss: new SettleLossUseCase(commands),
      cancelBet: new CancelBetUseCase(commands),
      getBalance: new GetBalanceUseCase(reads),
      getTransaction: new GetTransactionUseCase(reads),
      getLedgerEntries: new GetLedgerEntriesUseCase(reads),
      getWalletTransactions: new GetWalletTransactionsUseCase(reads),
      getBetFinancialStatus: new GetBetFinancialStatusUseCase(reads),
      getWithdrawal: new GetWithdrawalUseCase(reads),
      getCommandOutcome: new GetCommandOutcomeUseCase(reads),
      getWallet: new GetWalletUseCase(reads),
      reconcileLedger: new ReconcileLedgerUseCase(reads),
      publishOutboxBatch: {
        execute: async () =>
          ({
            ok: true,
            value: { report: { selected: 0, applied: 0, replayed: 0, rejected: 0, pending: 0, failed: 0 } },
          }),
      },
      provisionPlayerWallet: { execute: async () => ({ ok: true, value: { wallets: [], replayed: false } }) },
    },
  };
}
