import { createHmac, timingSafeEqual } from 'node:crypto';

import { objectValue, strictJson, stringValue } from './wire.js';

export interface IIdentitySettings { issuer: string; audience: string; key: string; maximumDeadlineMs: number; }

export interface IIdentityClaims { operatorId: string; actorId: string; actorKind: string; playerId?: string; capabilities: string[]; correlationId: string; deadlineAt: string; }

export class BoundaryError extends Error {
  constructor(readonly code: string, readonly correlationId = '00000000-0000-4000-8000-000000000001') { super(code); }
}

export class SignedIdentity {
  private readonly settings: Readonly<IIdentitySettings>;

  constructor(settings: IIdentitySettings, private readonly now: () => number = Date.now) {
    if (!settings.issuer || !settings.audience || Buffer.byteLength(settings.key) < 32 || !Number.isSafeInteger(settings.maximumDeadlineMs) || settings.maximumDeadlineMs < 1 || settings.maximumDeadlineMs > 600000) throw new Error('Explicit signed identity settings required');
    this.settings = Object.freeze({...settings});
  }

  authenticate(authorization: unknown, correlation: unknown, deadline: unknown): IIdentityClaims {
    try {
      const bearer = stringValue(authorization);
      const match = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(bearer);

      if (!match?.[1] || !match[2] || !match[3] || bearer.length > 16384) throw new Error('Invalid bearer');

      const header = objectValue(strictJson(Buffer.from(match[1], 'base64url').toString('utf8')));

      if (header.alg !== 'HS256' || header.typ !== 'JWT' || Object.keys(header).some(key => !['alg', 'typ'].includes(key))) throw new Error('Invalid algorithm');

      const expected = createHmac('sha256', this.settings.key).update(match[1] + '.' + match[2]).digest();
      const supplied = Buffer.from(match[3], 'base64url');

      if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) throw new Error('Invalid signature');

      const claims = objectValue(strictJson(Buffer.from(match[2], 'base64url').toString('utf8')));
      const now = this.now();

      if (claims.iss !== this.settings.issuer || claims.aud !== this.settings.audience || typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp) || claims.exp * 1000 <= now || typeof claims.iat !== 'number' || claims.iat * 1000 > now || (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf * 1000 > now))) throw new Error('Invalid token lifetime');

      const operatorId = uuidValue(claims.operatorId); const actorId = uuidValue(claims.actorId);
      const actorKind = stringValue(claims.actorKind);

      if (!['PLAYER', 'SERVICE', 'SYSTEM'].includes(actorKind) || !Array.isArray(claims.capabilities) || claims.capabilities.length > 64) throw new Error('Invalid actor');

      const capabilities = claims.capabilities.map(value => {const capability = stringValue(value);

 if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(capability)) throw new Error('Invalid capability');

 return capability;});
      const playerId = claims.playerId === undefined ? undefined : uuidValue(claims.playerId);

      if (actorKind === 'PLAYER' && playerId !== actorId) throw new Error('Invalid player');

      const correlationId = uuidValue(correlation);
      const requestedDeadline = instantValue(deadline);
      const deadlineAt = new Date(Math.min(Date.parse(requestedDeadline), claims.exp * 1000, now + this.settings.maximumDeadlineMs)).toISOString();

      if (Date.parse(deadlineAt) <= now) throw new BoundaryError('DEADLINE_EXCEEDED', correlationId);

      return {operatorId, actorId, actorKind, capabilities, correlationId, deadlineAt, ...(playerId ? {playerId} : {})};
    } catch (error) { if (error instanceof BoundaryError) throw error; throw new BoundaryError('UNAUTHENTICATED'); }
  }
}

export function uuidValue(value: unknown): string {
  const text = stringValue(value);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(text) || text === '00000000-0000-0000-0000-000000000000') throw new BoundaryError('INVALID_INPUT');

  return text;
}

export function instantValue(value: unknown): string {
  const text = stringValue(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(text);

  if (!match || !Number.isFinite(Date.parse(text))) throw new BoundaryError('INVALID_INPUT');

  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0) || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59 || (match[7] !== 'Z' && (Number(match[7]?.slice(1, 3)) > 23 || Number(match[7]?.slice(4, 6)) > 59))) throw new BoundaryError('INVALID_INPUT');

  return new Date(text).toISOString();
}
