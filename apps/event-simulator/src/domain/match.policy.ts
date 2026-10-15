import * as M from './events.model.js';
import { requireRule, validInstant, validUuid } from './events.policy.js';

export class Match {
  static advance(event: M.IEvent, expected: bigint, phase: M.EventPhase, at: string): void {
    requireRule(event.phaseSeq === expected, M.ErrorCode.VERSION_CONFLICT);
    requireRule(validInstant(at) && Date.parse(at) >= Date.parse(event.simulatedAt));
    const graph: Record<M.EventPhase, readonly M.EventPhase[]> = {
      PRE_MATCH: [M.EventPhase.LIVE, M.EventPhase.SUSPENDED],
      LIVE: [M.EventPhase.HALF_TIME, M.EventPhase.SUSPENDED],
      HALF_TIME: [M.EventPhase.LIVE, M.EventPhase.SUSPENDED],
      SUSPENDED: [M.EventPhase.LIVE, M.EventPhase.HALF_TIME],
      FINISHED: [],
    };

    requireRule(graph[event.phase].includes(phase), M.ErrorCode.INVALID_STATE);
  }

  static complete(event: M.IEvent, expected: bigint, result: M.IEventResult): void {
    requireRule(event.phaseSeq === expected, M.ErrorCode.VERSION_CONFLICT);
    requireRule(
      [M.EventPhase.LIVE, M.EventPhase.HALF_TIME, M.EventPhase.SUSPENDED].includes(event.phase),
      M.ErrorCode.INVALID_STATE,
    );
    requireRule(
      validUuid(result.resultId) && result.eventId === event.eventId && result.runId === event.runId
      && result.resultSeq === 1n,
    );
    requireRule(
      Number.isInteger(result.homeGoals) && result.homeGoals >= 0 && result.homeGoals <= 100
      && Number.isInteger(result.awayGoals)
      && result.awayGoals >= 0
      && result.awayGoals <= 100,
    );
    const outcome = result.homeGoals > result.awayGoals
      ? M.ResultOutcome.HOME
      : result.homeGoals < result.awayGoals ? M.ResultOutcome.AWAY : M.ResultOutcome.DRAW;

    requireRule(result.outcome === M.ResultOutcome.VOID || result.outcome === outcome);
    requireRule(
      validInstant(result.occurredAt)
      && Date.parse(result.occurredAt) >= Date.parse(event.simulatedAt),
    );
  }
}

export class Quote {
  static accept(
    event: M.IEvent,
    quote: M.IQuote,
    input: M.IEventsValidateSelectionQuoteInput,
    now: string,
  ): M.IQuote {
    requireRule(
      quote.eventId === input.eventId && quote.marketId === input.marketId
      && quote.selectionId === input.selectionId,
      M.ErrorCode.NOT_FOUND,
    );
    requireRule(
      quote.quoteId === input.quoteId && quote.quoteVersion === input.quoteVersion
      && quote.quoteVersion === event.phaseSeq,
      M.ErrorCode.STALE_QUOTE,
    );
    requireRule(
      [M.EventPhase.PRE_MATCH, M.EventPhase.LIVE].includes(event.phase)
      && quote.state === M.MarketState.OPEN,
      M.ErrorCode.MARKET_CLOSED,
    );
    requireRule(Date.parse(quote.validUntil) > Date.parse(now), M.ErrorCode.STALE_QUOTE);
    requireRule(
      /^(?:[1-9]\d{0,3})(?:\.\d{1,8})?$/.test(quote.odds),
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );
    const parts = quote.odds.split('.');
    const exact = BigInt(parts[0] ?? '') * 100000000n + BigInt((parts[1] ?? '').padEnd(8, '0'));

    requireRule(
      exact > 100000000n && exact <= 100000000000n,
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );

    return { ...quote };
  }
}
