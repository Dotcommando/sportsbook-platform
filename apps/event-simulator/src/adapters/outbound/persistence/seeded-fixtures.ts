import * as M from '../../../domain/events.model.js';
import {requireRule, validInstant, validUuid} from '../../../domain/events.policy.js';
import type {IdGeneratorPort} from '../../../ports/outbound/events.port.js';

export interface IFixtureSettings {operatorId:string;runId:string;seed:bigint;startsAt:string;eventCount:number;quoteValidityMs:number;period:M.MarketPeriod;}

export interface IFixture {event:M.IEvent;marketId:string;quotes:M.IQuote[];}

export function seededFixtures(settings:IFixtureSettings, ids:IdGeneratorPort):IFixture[] {
  requireRule(validUuid(settings.operatorId) && validUuid(settings.runId) && typeof settings.seed === 'bigint' && settings.seed >= 0n && settings.seed <= 9223372036854775807n && validInstant(settings.startsAt));
  requireRule(Number.isInteger(settings.eventCount) && settings.eventCount >= 1 && settings.eventCount <= 1000 && Number.isInteger(settings.quoteValidityMs) && settings.quoteValidityMs >= 1 && settings.quoteValidityMs <= 86400000 && settings.period === M.MarketPeriod.NORMAL_TIME);

  return Array.from({length:settings.eventCount}, (_, index)=>{
    const derive = (purpose:string):string=>ids.derive(settings.operatorId, settings.runId, 'events:seed:' + settings.seed + ':' + index + ':' + purpose);
    const eventId = derive('event');const marketId = derive('market');
    const event:M.IEvent = {eventId, runId:settings.runId, sport:M.Sport.FOOTBALL, homeTeam:'Home ' + index, awayTeam:'Away ' + index, startsAt:settings.startsAt, phase:M.EventPhase.PRE_MATCH, phaseSeq:1n, simulatedAt:settings.startsAt};

    return {event, marketId, quotes:Object.values(M.Selection).map((selection, position)=>({eventId, marketId, selectionId:derive('selection:' + selection), quoteId:ids.derive(settings.operatorId, derive('selection:' + selection), 'events:quote:1'), quoteVersion:1n, selection, odds:(2n + (settings.seed + BigInt(index + position)) % 7n) + '.25000000', validUntil:new Date(Date.parse(settings.startsAt) + settings.quoteValidityMs).toISOString(), state:M.MarketState.OPEN}))};
  });
}
