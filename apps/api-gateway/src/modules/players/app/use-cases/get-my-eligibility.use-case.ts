import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, checked, owner} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {failure, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {PlayerQueryPort} from '../../../players/ports/outbound/players.port.js';
import type {GetMyEligibilityPort} from '../../ports/inbound/players-operations.port.js';

export class GetMyEligibilityUseCase implements GetMyEligibilityPort {constructor(private readonly policy:IGatewayPolicy, private readonly players:PlayerQueryPort) {}

async execute(input:M.IGatewayGetMyEligibilityInput):Promise<M.IResult<M.IGatewayGetMyEligibilityOutput>> {try {authorize(this.policy, input.context, M.Capability.EVALUATE_ELIGIBILITY, true);requireRule(Output.isIGatewayGetMyEligibilityInput(input));const run = async():Promise<M.IGatewayGetMyEligibilityOutput>=>{return checked(this.players.checkEligibility({...input, playerId:owner(input.context)}), Output.isIPlayerCheckEligibilityOutput);};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, false);}}}
