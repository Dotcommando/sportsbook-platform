import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, checked} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {failure, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {EventCatalogPort} from '../../../events/ports/outbound/events.port.js';
import type {GetEventPort} from '../../ports/inbound/events-operations.port.js';

export class GetEventUseCase implements GetEventPort {constructor(private readonly policy:IGatewayPolicy, private readonly events:EventCatalogPort) {}

async execute(input:M.IGatewayGetEventInput):Promise<M.IResult<M.IGatewayGetEventOutput>> {try {authorize(this.policy, input.context, M.Capability.EVENT_READ, false);requireRule(Output.isIGatewayGetEventInput(input));const run = async():Promise<M.IGatewayGetEventOutput>=>{const result = await checked(this.events.getEvent(input), Output.isIEventsGetEventOutput);

requireRule(result.event.eventId === input.eventId, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, false);}}}
