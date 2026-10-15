import * as M from '../../domain/events.model.js';
import * as P from '../../domain/events.policy.js';
import type {GetEventPort} from '../../ports/inbound/events-operations.port.js';
import type {IEventsDependencies} from '../services/events-operation.service.js';
import {EventsOperationService} from '../services/events-operation.service.js';

export class GetEventUseCase implements GetEventPort {constructor(private readonly dependencies:IEventsDependencies) {}

execute(input:M.IEventsGetEventInput):Promise<M.IResult<M.IEventsGetEventOutput>> {return new EventsOperationService(this.dependencies).read(input, M.Capability.EVENT_READ, async ports=>{const event = await ports.catalog.find(input.context, input.eventId);

if (!event) throw new P.EventsError(M.ErrorCode.NOT_FOUND);

return {event};});}}
