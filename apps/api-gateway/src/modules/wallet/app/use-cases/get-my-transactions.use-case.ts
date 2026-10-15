import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, checked, owner, wallet} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {currency, failure, page, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {WalletQueryPort} from '../../../wallet/ports/outbound/wallet.port.js';
import type {GetMyTransactionsPort} from '../../ports/inbound/wallet-operations.port.js';

export class GetMyTransactionsUseCase implements GetMyTransactionsPort {constructor(private readonly policy:IGatewayPolicy, private readonly wallets:WalletQueryPort) {}

async execute(input:M.IGatewayGetMyTransactionsInput):Promise<M.IResult<M.IGatewayGetMyTransactionsOutput>> {try {const settings = authorize(this.policy, input.context, M.Capability.READ_JOURNAL, true);

requireRule(Output.isIGatewayGetMyTransactionsInput(input));currency(settings, input.currency);page(input.page);const run = async():Promise<M.IGatewayGetMyTransactionsOutput>=>{const found = await checked(this.wallets.getWallet({context:input.context, playerId:owner(input.context), currency:input.currency}), Output.isILedgerGetWalletOutput);

wallet(input.context, found.wallet, input.currency);const result = await checked(this.wallets.listTransactions({context:input.context, walletId:found.wallet.walletId, page:input.page}), Output.isILedgerGetWalletTransactionsOutput);

requireRule(result.transactions.length <= input.page.limit && result.transactions.every(t=>t.currency === input.currency), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, false);}}}
