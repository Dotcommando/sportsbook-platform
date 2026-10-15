import type { IGatewayPolicy } from '../../../../app/services/gateway-operation.service.js';
import { authorize, checked, owner, wallet } from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import { currency, failure, requireRule } from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type { WalletQueryPort } from '../../../wallet/ports/outbound/wallet.port.js';
import type { GetMyBalancePort } from '../../ports/inbound/wallet-operations.port.js';

export class GetMyBalanceUseCase implements GetMyBalancePort {
  constructor(
    private readonly policy: IGatewayPolicy,
    private readonly wallets: WalletQueryPort,
  ) { }

  async execute(input: M.IGatewayGetMyBalanceInput): Promise<M.IResult<M.IGatewayGetMyBalanceOutput>> {
    try {
      const settings = authorize(this.policy, input.context, M.Capability.READ_WALLET, true);

      requireRule(Output.isIGatewayGetMyBalanceInput(input));
      currency(settings, input.currency);
      const run = async (): Promise<M.IGatewayGetMyBalanceOutput> => {
        const result = await checked(
          this.wallets.getWallet(
            { context: input.context, playerId: owner(input.context), currency: input.currency },
          ),
          Output.isILedgerGetWalletOutput,
        );

        wallet(input.context, result.wallet, input.currency);

        return result;
      };

      return { ok: true, value: await run() };
    } catch (error) {
      return failure(error, input.context, false);
    }
  }
}
