import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, checked} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {currency, failure, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {WalletQueryPort} from '../../../wallet/ports/outbound/wallet.port.js';
import type {GetMyWithdrawalPort} from '../../ports/inbound/wallet-operations.port.js';

export class GetMyWithdrawalUseCase implements GetMyWithdrawalPort {constructor(private readonly policy:IGatewayPolicy, private readonly wallets:WalletQueryPort) {}

async execute(input:M.IGatewayGetMyWithdrawalInput):Promise<M.IResult<M.IGatewayGetMyWithdrawalOutput>> {try {const settings = authorize(this.policy, input.context, M.Capability.WITHDRAW, true);

requireRule(Output.isIGatewayGetMyWithdrawalInput(input));const run = async():Promise<M.IGatewayGetMyWithdrawalOutput>=>{const result = await checked(this.wallets.getWithdrawal(input), Output.isILedgerGetWithdrawalOutput);

requireRule(result.withdrawal.withdrawalId === input.withdrawalId, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);currency(settings, result.withdrawal.amount.currency);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, false);}}}
