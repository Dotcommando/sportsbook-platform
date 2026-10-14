import { CapabilityPolicy } from '../../domain/capability.policy.js';
import { failure, success, validInstant, validUuid } from '../../domain/ledger.error.js';
import type { ILedgerProvisionPlayerWalletInput, ILedgerProvisionPlayerWalletOutput, IOperatorFinancialPolicy, IResult, IWalletView } from '../../domain/ledger.model.js';
import { Capability, ErrorCode, EventSource, EventType } from '../../domain/ledger.model.js';
import type { CreateWalletPort, ProvisionPlayerWalletPort } from '../../ports/inbound/ledger-operations.port.js';
import type { ClockPort, IdGeneratorPort } from '../../ports/outbound/financial.port.js';

export class ProvisionPlayerWalletUseCase implements ProvisionPlayerWalletPort {
  constructor(private readonly createWallet: CreateWalletPort, private readonly ids: IdGeneratorPort, private readonly clock: ClockPort, private readonly policies: readonly IOperatorFinancialPolicy[]) {}

  async execute(input: ILedgerProvisionPlayerWalletInput): Promise<IResult<ILedgerProvisionPlayerWalletOutput>> {
    const authorized = CapabilityPolicy.authorize(input.context, Capability.CREATE_WALLET);

    if (!authorized.ok) return authorized;

    const currencies = this.policies.find(policy => policy.operatorId === input.context.operatorId)?.currencies.map(policy => policy.currency).sort();
    const envelope = input.envelope;

    if (Date.parse(input.context.deadlineAt) <= Date.parse(this.clock.now())) return failure(ErrorCode.DEADLINE_EXCEEDED, input.context.correlationId);
    if (!currencies || !validUuid(input.playerId) || !validUuid(envelope.messageId) || envelope.operatorId !== input.context.operatorId || envelope.source !== EventSource.PLAYER || envelope.eventType !== EventType.PLAYER_REGISTERED || envelope.schemaVersion !== 1 || envelope.payload.playerId !== input.playerId || !validInstant(envelope.occurredAt) || !validInstant(envelope.payload.registeredAt) || new Set(input.currencies).size !== input.currencies.length || [...input.currencies].sort().join(',') !== currencies.join(',')) return failure(ErrorCode.INVALID_INPUT, input.context.correlationId);

    const wallets: IWalletView[] = [];

    for (const currency of currencies) {
      const created = await this.createWallet.execute({ context: input.context, requestId: this.ids.derive(input.context.operatorId, envelope.messageId, 'ledger:provision-wallet:' + currency), playerId: input.playerId, currency });

      if (!created.ok) return created;
      wallets.push(created.value.wallet);
    }

    return success({ wallets });
  }
}
