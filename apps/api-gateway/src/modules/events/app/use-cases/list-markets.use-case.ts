import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, checked} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {failure, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {EventCatalogPort} from '../../../events/ports/outbound/events.port.js';
import type {ListMarketsPort} from '../../ports/inbound/events-operations.port.js';

export class ListMarketsUseCase implements ListMarketsPort {constructor(private readonly policy:IGatewayPolicy, private readonly events:EventCatalogPort) {}

async execute(input:M.IGatewayListMarketsInput):Promise<M.IResult<M.IGatewayListMarketsOutput>> {try {authorize(this.policy, input.context, M.Capability.EVENT_READ, false);requireRule(Output.isIGatewayListMarketsInput(input));const run = async():Promise<M.IGatewayListMarketsOutput>=>{const result = await checked(this.events.listMarkets(input), Output.isIEventsGetMarketsOutput);

requireRule(result.markets.every(m=>m.eventId === input.eventId && m.selections.every(q=>q.marketId === m.marketId && q.eventId === input.eventId)), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, false);}}}
