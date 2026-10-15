import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, bet, checked, owner} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {failure, page, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {BetQueryPort} from '../../../bets/ports/outbound/bets.port.js';
import type {ListMyBetsPort} from '../../ports/inbound/bets-operations.port.js';

export class ListMyBetsUseCase implements ListMyBetsPort {constructor(private readonly policy:IGatewayPolicy, private readonly bets:BetQueryPort) {}

async execute(input:M.IGatewayListMyBetsInput):Promise<M.IResult<M.IGatewayListMyBetsOutput>> {try {authorize(this.policy, input.context, M.Capability.BET_READ, true);requireRule(Output.isIGatewayListMyBetsInput(input));page(input.page);const run = async():Promise<M.IGatewayListMyBetsOutput>=>{const result = await checked(this.bets.list({...input, playerId:owner(input.context)}), Output.isIBettingListPlayerBetsOutput);

requireRule(result.bets.length <= input.page.limit, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

for (const item of result.bets)bet(input.context, item);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, false);}}}
