import type { UUID } from './betting.model.js';
import { requireRule, validUuid } from './betting.policy.js';

export function settlementCursor(operatorId: UUID, eventId: UUID, betId: UUID): string {
  return JSON.stringify({ version: 1, operatorId, eventId, betId });
}

export function settlementCursorBet(value: string, operatorId: UUID, eventId: UUID): UUID {
  requireRule(value.length <= 1024);
  let cursor: unknown;

  try {
    cursor = JSON.parse(value);
  } catch {
    requireRule(false);
  }
  requireRule(cursor !== null && typeof cursor === 'object' && !Array.isArray(cursor));
  const fields = Object.fromEntries(Object.entries(cursor ?? {}));

  requireRule(
    fields.version === 1 && fields.operatorId === operatorId && fields.eventId === eventId
    && validUuid(fields.betId),
  );

  return typeof fields.betId === 'string' ? fields.betId : '';
}
