import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, checked} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {failure, page, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {EventCatalogPort} from '../../../events/ports/outbound/events.port.js';
import type {ListEventsPort} from '../../ports/inbound/events-operations.port.js';

export class ListEventsUseCase implements ListEventsPort {constructor(private readonly policy:IGatewayPolicy, private readonly events:EventCatalogPort) {}

async execute(input:M.IGatewayListEventsInput):Promise<M.IResult<M.IGatewayListEventsOutput>> {try {authorize(this.policy, input.context, M.Capability.EVENT_READ, false);requireRule(Output.isIGatewayListEventsInput(input));page(input.page);const run = async():Promise<M.IGatewayListEventsOutput>=>{const result = await checked(this.events.listEvents(input), Output.isIEventsListEventsOutput);

requireRule(result.events.length <= input.page.limit, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, false);}}}
