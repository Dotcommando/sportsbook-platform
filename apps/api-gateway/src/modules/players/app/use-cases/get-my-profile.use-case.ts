import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, checked, owner, profile} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {failure, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {PlayerQueryPort} from '../../../players/ports/outbound/players.port.js';
import type {GetMyProfilePort} from '../../ports/inbound/players-operations.port.js';

export class GetMyProfileUseCase implements GetMyProfilePort {constructor(private readonly policy:IGatewayPolicy, private readonly players:PlayerQueryPort) {}

async execute(input:M.IGatewayGetMyProfileInput):Promise<M.IResult<M.IGatewayGetMyProfileOutput>> {try {authorize(this.policy, input.context, M.Capability.PROFILE_READ, true);requireRule(Output.isIGatewayGetMyProfileInput(input));const run = async():Promise<M.IGatewayGetMyProfileOutput>=>{const result = await checked(this.players.getProfile({context:input.context, playerId:owner(input.context)}), Output.isIPlayerGetPlayerOutput);

profile(input.context, result.profile);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, false);}}}
