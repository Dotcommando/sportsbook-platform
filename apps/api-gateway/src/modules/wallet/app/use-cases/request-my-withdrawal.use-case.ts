import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, checked, eligibility, owner, wallet} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {amount, failure, requireRule, validUuid} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {IdGeneratorPort} from '../../../../ports/outbound/gateway.port.js';
import type {PlayerQueryPort} from '../../../players/ports/outbound/players.port.js';
import type {WalletQueryPort} from '../../../wallet/ports/outbound/wallet.port.js';
import type {WalletCommandPort} from '../../../wallet/ports/outbound/wallet.port.js';
import type {RequestMyWithdrawalPort} from '../../ports/inbound/wallet-operations.port.js';

export class RequestMyWithdrawalUseCase implements RequestMyWithdrawalPort {constructor(private readonly policy:IGatewayPolicy, private readonly players:PlayerQueryPort, private readonly wallets:WalletQueryPort, private readonly commands:WalletCommandPort, private readonly ids:IdGeneratorPort) {}

async execute(input:M.IGatewayRequestMyWithdrawalInput):Promise<M.IResult<M.IGatewayRequestMyWithdrawalOutput>> {try {const settings = authorize(this.policy, input.context, M.Capability.WITHDRAW, true);

requireRule(Output.isIGatewayRequestMyWithdrawalInput(input));amount(settings, input.amount);const run = async():Promise<M.IGatewayRequestMyWithdrawalOutput>=>{const decision = await checked(this.players.checkEligibility({context:input.context, playerId:owner(input.context), capability:M.PlayerCapability.WITHDRAW}), Output.isIPlayerCheckEligibilityOutput);

eligibility(this.policy, decision.eligibility);const found = await checked(this.wallets.getWallet({context:input.context, playerId:owner(input.context), currency:input.amount.currency}), Output.isILedgerGetWalletOutput);

wallet(input.context, found.wallet, input.amount.currency);requireRule(found.wallet.status === M.WalletStatus.ACTIVE, M.ErrorCode.INVALID_STATE);const withdrawalId = this.ids.derive(input.context.operatorId, input.requestId, 'WITHDRAWAL');

requireRule(validUuid(withdrawalId), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);const result = await checked(this.commands.requestWithdrawal({context:input.context, requestId:input.requestId, withdrawalId, walletId:found.wallet.walletId, amount:input.amount}), Output.isILedgerRequestWithdrawalOutput);

wallet(input.context, result.outcome.wallet, input.amount.currency);requireRule(result.outcome.requestId === input.requestId && result.withdrawal.withdrawalId === withdrawalId && result.withdrawal.walletId === found.wallet.walletId && result.withdrawal.amount.currency === input.amount.currency && result.withdrawal.amount.amountMinor === input.amount.amountMinor, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, true);}}}
