import * as D from '../../domain/ledger.error.js';
import * as M from '../../domain/ledger.model.js';
import type { CreateWalletPort } from '../../ports/inbound/ledger-operations.port.js';
import { chartIds } from '../financial-command.factory.js';
import type { ILedgerCommandDependencies } from '../services/financial-command.service.js';
import { FinancialCommandService, validWallet } from '../services/financial-command.service.js';

export class CreateWalletUseCase implements CreateWalletPort {
  private readonly commands:FinancialCommandService;

  constructor(dependencies:ILedgerCommandDependencies) { this.commands = new FinancialCommandService(dependencies); }

  async execute(input:M.ILedgerCreateWalletInput):Promise<M.IResult<M.ILedgerCreateWalletOutput>> {
    const result = await this.commands.execute(input, 'CreateWallet', M.Capability.CREATE_WALLET, M.ActorKind.SYSTEM, ['context', 'requestId', 'playerId', 'currency'], async (ports, prepared) => {
      if (!D.validUuid(input.playerId) || !this.commands.policy(input.context)?.currencies.some(item => item.currency === input.currency)) return D.failure(M.ErrorCode.INVALID_INPUT);

      const wallet: M.IWalletView = { walletId: prepared.walletId, playerId: input.playerId, currency: input.currency, status: M.WalletState.ACTIVE, availableMinor: 0n, reservedMinor: 0n, withdrawalHoldMinor: 0n, version: 1n, observedAt: prepared.occurredAt };
      const chart = chartIds(this.commands.dependencies.ids, input.context.operatorId, wallet.walletId, input.currency);
      const saved = await ports.accounts.createWallet(input.context, wallet, [chart.available, chart.reserved, chart.withdrawalHold]);

      if (!validWallet(saved) || saved.playerId !== input.playerId || saved.currency !== input.currency) throw new D.LedgerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

      const created = saved.walletId === wallet.walletId;

      if (created) await ports.outbox.append(input.context, { messageId:prepared.eventId, source:M.EventSource.LEDGER, eventType:M.EventType.WALLET_CREATED, schemaVersion:1, operatorId:input.context.operatorId, correlationId:input.context.correlationId, occurredAt:prepared.occurredAt, payload:{walletId:saved.walletId, playerId:saved.playerId, currency:saved.currency} });

      return D.success({wallet:saved, created});
    });

    if (!result.ok) return result;
    if ('wallet' in result.value && 'created' in result.value) return D.success({wallet:result.value.wallet, created:result.value.created});

    return D.failure(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, input.context.correlationId);
  }
}
