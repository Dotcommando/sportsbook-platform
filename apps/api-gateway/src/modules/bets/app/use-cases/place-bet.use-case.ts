import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, bet, checked, owner} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {amount, failure, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {BetCommandPort} from '../../../bets/ports/outbound/bets.port.js';
import type {PlaceBetPort} from '../../ports/inbound/bets-operations.port.js';

export class PlaceBetUseCase implements PlaceBetPort {constructor(private readonly policy:IGatewayPolicy, private readonly commands:BetCommandPort) {}

async execute(input:M.IGatewayPlaceBetInput):Promise<M.IResult<M.IGatewayPlaceBetOutput>> {try {const settings = authorize(this.policy, input.context, M.Capability.PLACE_BET, true);

requireRule(Output.isIGatewayPlaceBetInput(input));amount(settings, input.stake);requireRule(input.selection.quoteVersion >= 1n);const run = async():Promise<M.IGatewayPlaceBetOutput>=>{const result = await checked(this.commands.place({...input, playerId:owner(input.context)}), Output.isIBettingPlaceBetOutput);

bet(input.context, result.bet);requireRule(result.bet.stake.amountMinor === input.stake.amountMinor && result.bet.stake.currency === input.stake.currency && result.bet.legs[0]?.eventId === input.selection.eventId && result.bet.legs[0]?.marketId === input.selection.marketId && result.bet.legs[0]?.selectionId === input.selection.selectionId, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, true);}}}
