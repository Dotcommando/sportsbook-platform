import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, checked, owner} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {failure, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {BetQueryPort} from '../../../bets/ports/outbound/bets.port.js';
import type {GetMyBetStatusPort} from '../../ports/inbound/bets-operations.port.js';

export class GetMyBetStatusUseCase implements GetMyBetStatusPort {constructor(private readonly policy:IGatewayPolicy, private readonly bets:BetQueryPort) {}

async execute(input:M.IGatewayGetMyBetStatusInput):Promise<M.IResult<M.IGatewayGetMyBetStatusOutput>> {try {authorize(this.policy, input.context, M.Capability.BET_READ, true);requireRule(Output.isIGatewayGetMyBetStatusInput(input));const run = async():Promise<M.IGatewayGetMyBetStatusOutput>=>{const result = await checked(this.bets.status({...input, playerId:owner(input.context)}), Output.isIBettingGetBetStatusOutput);

requireRule(result.betId === input.betId, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, false);}}}
