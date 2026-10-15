import * as M from '../../domain/events.model.js';
import * as P from '../../domain/events.policy.js';
import {Quote} from '../../domain/match.policy.js';
import type {ValidateSelectionQuotePort} from '../../ports/inbound/events-operations.port.js';
import type {IEventsDependencies} from '../services/events-operation.service.js';
import {EventsOperationService} from '../services/events-operation.service.js';

export class ValidateSelectionQuoteUseCase implements ValidateSelectionQuotePort {constructor(private readonly dependencies:IEventsDependencies) {}

execute(input:M.IEventsValidateSelectionQuoteInput):Promise<M.IResult<M.IEventsValidateSelectionQuoteOutput>> {return new EventsOperationService(this.dependencies).read(input, M.Capability.QUOTE_VALIDATE, async ports=>{P.requireRule(input.context.actorKind === M.ActorKind.SERVICE, M.ErrorCode.PERMISSION_DENIED);

if (input.context.playerId !== undefined)P.requireRule(input.context.playerId === input.playerId, M.ErrorCode.NOT_FOUND);

const event = await ports.catalog.find(input.context, input.eventId);

if (!event) throw new P.EventsError(M.ErrorCode.NOT_FOUND);

const quote = await ports.quotes.find(input.context, input.quoteId, input.quoteVersion);

if (!quote) throw new P.EventsError(M.ErrorCode.STALE_QUOTE);

const evaluatedAt = this.dependencies.clock.now();

return {acceptedQuote:Quote.accept(event, quote, input, evaluatedAt), evaluatedAt};});}}
