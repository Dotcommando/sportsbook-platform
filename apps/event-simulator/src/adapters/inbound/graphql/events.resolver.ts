import type { GraphQLResolverMap } from '@apollo/subgraph';
import {Controller, Inject, Post, Req, Res} from '@nestjs/common';
import type {IGraphqlSettings} from '@sportsbook/service-transport';
import {businessGraphqlError, FederationBoundary, jsonWire, objectValue} from '@sportsbook/service-transport';
import { GraphQLScalarType, Kind } from 'graphql';

import {EVENTS_BOUNDARY, EVENTS_GRAPHQL_SETTINGS} from '../../../infra/events-transport.tokens.js';
import type {IRestRequest, IRestResponse} from '../rest/events-rest.controller.js';
import type {ITransportHeaders} from '../shared/events-boundary.js';
import {EventsBoundary} from '../shared/events-boundary.js';

export const eventsSdl = 'extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])\nscalar EventsSavedOutcome\ninput EventsEventsListEventsInputInput { page: EventsPageInputInput! phase: EventsEventPhase }\ninput EventsPageInputInput { limit: Int! cursor: String from: String to: String }\nenum EventsEventPhase { PRE_MATCH LIVE HALF_TIME SUSPENDED FINISHED }\ntype EventsEventsListEventsOutput { events: [Event!]! nextCursor: String observedAt: String! }\ntype Event @key(fields: "operatorId eventId") { operatorId: String! eventId: String! runId: String! sport: EventsSport! homeTeam: String! awayTeam: String! startsAt: String! phase: EventsEventPhase! phaseSeq: String! simulatedAt: String! resultRef: String }\nenum EventsSport { FOOTBALL }\ninput EventsEventsGetEventInputInput { eventId: String! }\ntype EventsEventsGetEventOutput { event: Event! }\ninput EventsEventsGetMarketsInputInput { eventId: String! }\ntype EventsEventsGetMarketsOutput { markets: [EventsMarket!]! observedAt: String! }\ntype EventsMarket { marketId: String! eventId: String! type: EventsMarketType! state: EventsMarketState! selections: [EventsQuote!]! }\nenum EventsMarketType { MATCH_RESULT }\nenum EventsMarketState { OPEN SUSPENDED CLOSED }\ntype EventsQuote { quoteId: String! quoteVersion: String! eventId: String! marketId: String! selectionId: String! selection: EventsSelection! odds: String! validUntil: String! state: EventsMarketState! }\nenum EventsSelection { HOME DRAW AWAY }\ninput EventsEventsValidateSelectionQuoteInputInput { playerId: String! eventId: String! marketId: String! selectionId: String! quoteId: String! quoteVersion: String! }\ntype EventsEventsValidateSelectionQuoteOutput { acceptedQuote: EventsQuote! evaluatedAt: String! }\ninput EventsEventsGetEventResultInputInput { eventId: String! }\ntype EventsEventsGetEventResultOutput { result: EventsEventResult ready: Boolean! }\ntype EventsEventResult { resultId: String! eventId: String! runId: String! resultSeq: String! homeGoals: Int! awayGoals: Int! outcome: EventsResultOutcome! occurredAt: String! }\nenum EventsResultOutcome { HOME DRAW AWAY VOID }\ninput EventsEventsAdvanceMatchPhaseInputInput { requestId: String! eventId: String! expectedPhaseSeq: String! nextPhase: EventsEventPhase! simulatedAt: String! }\ntype EventsEventsAdvanceMatchPhaseOutput { event: Event! }\ninput EventsEventsCompleteEventInputInput { requestId: String! eventId: String! expectedPhaseSeq: String! result: EventsEventResultInput! }\ninput EventsEventResultInput { resultId: String! eventId: String! runId: String! resultSeq: String! homeGoals: Int! awayGoals: Int! outcome: EventsResultOutcome! occurredAt: String! }\ntype EventsEventsCompleteEventOutput { event: Event! result: EventsEventResult! delivery: EventsDeliveryState! }\nenum EventsDeliveryState { PENDING ACKNOWLEDGED }\ntype Query { listEvents(input: EventsEventsListEventsInputInput!): EventsEventsListEventsOutput! getEvent(input: EventsEventsGetEventInputInput!): EventsEventsGetEventOutput! getMarkets(input: EventsEventsGetMarketsInputInput!): EventsEventsGetMarketsOutput! validateSelectionQuote(input: EventsEventsValidateSelectionQuoteInputInput!): EventsEventsValidateSelectionQuoteOutput! getEventResult(input: EventsEventsGetEventResultInputInput!): EventsEventsGetEventResultOutput! }\ntype Mutation { advanceMatchPhase(input: EventsEventsAdvanceMatchPhaseInputInput!): EventsEventsAdvanceMatchPhaseOutput! completeEvent(input: EventsEventsCompleteEventInputInput!): EventsEventsCompleteEventOutput! }\n';

export class EventsResolver {constructor(private readonly boundary:EventsBoundary) {}

async call(operation:string, args:unknown, context:unknown):Promise<unknown> {const fields = objectValue(args);const headers = headerValues(context);const result = await this.boundary.execute(operation, fields.input, headers);

if (!result.ok) throw businessGraphqlError(result.error);

return jsonWire(result.value);}

async resolveReference(reference:unknown, context:unknown):Promise<unknown> {const key = objectValue(reference);const headers = headerValues(context);const trusted = this.boundary.context(headers);

if (key.operatorId !== trusted.operatorId) throw businessGraphqlError({code:'NOT_FOUND'});

const result = await this.boundary.execute('GetEvent', {eventId:key.eventId}, headers);

if (!result.ok) throw businessGraphqlError(result.error);

return jsonWire(objectValue(result.value).event);}

resolvers():GraphQLResolverMap<unknown> {return {Query:{listEvents:(_parent:unknown, args:unknown, context:unknown)=>this.call('ListEvents', args, context), getEvent:(_parent:unknown, args:unknown, context:unknown)=>this.call('GetEvent', args, context), getMarkets:(_parent:unknown, args:unknown, context:unknown)=>this.call('GetMarkets', args, context), validateSelectionQuote:(_parent:unknown, args:unknown, context:unknown)=>this.call('ValidateSelectionQuote', args, context), getEventResult:(_parent:unknown, args:unknown, context:unknown)=>this.call('GetEventResult', args, context)},
Mutation:{advanceMatchPhase:(_parent:unknown, args:unknown, context:unknown)=>this.call('AdvanceMatchPhase', args, context), completeEvent:(_parent:unknown, args:unknown, context:unknown)=>this.call('CompleteEvent', args, context)},
Event:{__resolveReference:(reference:unknown, context:unknown)=>this.resolveReference(reference, context), operatorId:(_parent:unknown, _args:unknown, context:unknown)=>this.boundary.context(headerValues(context)).operatorId},
EventsSavedOutcome:new GraphQLScalarType({name:'EventsSavedOutcome',
serialize:value=>jsonWire(value),
parseValue:()=>{throw new Error('Output scalar');},
parseLiteral:node=>{if (node.kind !== Kind.NULL) throw new Error('Output scalar');

return null;}})};}
}

function headerValues(context:unknown):ITransportHeaders {const headers = objectValue(context);

return {authorization:headers.authorization, correlationId:headers.correlationId, deadlineAt:headers.deadlineAt};}

@Controller()
export class EventsGraphqlController {private readonly federation:FederationBoundary;

constructor(@Inject(EVENTS_BOUNDARY)private readonly boundary:EventsBoundary, @Inject(EVENTS_GRAPHQL_SETTINGS)settings:IGraphqlSettings) {this.federation = new FederationBoundary(eventsSdl, new EventsResolver(boundary).resolvers(), settings);}

@Post('/internal/graphql')
async execute(@Req()request:IRestRequest, @Res()response:IRestResponse):Promise<unknown> {const headers = {authorization:request.headers.authorization, correlationId:request.headers['x-correlation-id'], deadlineAt:request.headers['x-deadline-at']};

try {this.boundary.context(headers);} catch {return response.status(401).json({errors:[{message:'UNAUTHENTICATED', extensions:{code:'UNAUTHENTICATED', retryable:false, outcomeUnknown:false}}]});}

 return response.status(200).json(await this.federation.execute(request.body, headers));}}
