import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, checked, eligibility, owner, wallet} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {amount, failure, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {PlayerQueryPort} from '../../../players/ports/outbound/players.port.js';
import type {WalletQueryPort} from '../../../wallet/ports/outbound/wallet.port.js';
import type {WalletCommandPort} from '../../../wallet/ports/outbound/wallet.port.js';
import type {TopUpTestWalletPort} from '../../ports/inbound/wallet-operations.port.js';

export class TopUpTestWalletUseCase implements TopUpTestWalletPort {constructor(private readonly policy:IGatewayPolicy, private readonly players:PlayerQueryPort, private readonly wallets:WalletQueryPort, private readonly commands:WalletCommandPort) {}

async execute(input:M.IGatewayTopUpTestWalletInput):Promise<M.IResult<M.IGatewayTopUpTestWalletOutput>> {try {const settings = authorize(this.policy, input.context, M.Capability.FUND_SYNTHETIC, true);

requireRule(Output.isIGatewayTopUpTestWalletInput(input));amount(settings, input.amount);requireRule(input.providerRef.length <= 128 && input.providerRef.startsWith(settings.syntheticProvider + ':') && /^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(input.providerRef) && input.providerRef.length > settings.syntheticProvider.length + 1);const run = async():Promise<M.IGatewayTopUpTestWalletOutput>=>{const decision = await checked(this.players.checkEligibility({context:input.context, playerId:owner(input.context), capability:M.PlayerCapability.DEPOSIT}), Output.isIPlayerCheckEligibilityOutput);

eligibility(this.policy, decision.eligibility);const found = await checked(this.wallets.getWallet({context:input.context, playerId:owner(input.context), currency:input.amount.currency}), Output.isILedgerGetWalletOutput);

wallet(input.context, found.wallet, input.amount.currency);requireRule(found.wallet.status === M.WalletStatus.ACTIVE, M.ErrorCode.INVALID_STATE);const result = await checked(this.commands.deposit({context:input.context, requestId:input.requestId, walletId:found.wallet.walletId, amount:input.amount, providerRef:input.providerRef}), Output.isILedgerDepositTestFundsOutput);

wallet(input.context, result.outcome.wallet, input.amount.currency);requireRule(result.outcome.requestId === input.requestId && result.outcome.wallet.walletId === found.wallet.walletId, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, true);}}}
