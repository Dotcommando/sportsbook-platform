import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, bet, checked, owner} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {failure, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {BetCommandPort} from '../../../bets/ports/outbound/bets.port.js';
import type {CancelMyBetPort} from '../../ports/inbound/bets-operations.port.js';

export class CancelMyBetUseCase implements CancelMyBetPort {constructor(private readonly policy:IGatewayPolicy, private readonly commands:BetCommandPort) {}

async execute(input:M.IGatewayCancelMyBetInput):Promise<M.IResult<M.IGatewayCancelMyBetOutput>> {try {authorize(this.policy, input.context, M.Capability.CANCEL_BET, true);requireRule(Output.isIGatewayCancelMyBetInput(input));requireRule(input.expectedVersion >= 1n);const run = async():Promise<M.IGatewayCancelMyBetOutput>=>{const result = await checked(this.commands.cancel({...input, playerId:owner(input.context)}), Output.isIBettingCancelBetOutput);

bet(input.context, result.bet, input.betId);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, true);}}}
