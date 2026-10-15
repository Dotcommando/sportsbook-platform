import { createHash } from 'node:crypto';

import type { RegisteredInput, Sha256 } from '../../../domain/betting.model.js';
import type { CommandFingerprintPort } from '../../../ports/outbound/betting.port.js';

export function losslessJson(value: unknown): string {
  const result = JSON.stringify(value, (_key, item: unknown) => typeof item === 'bigint' ? item.toString() : item);

  if (result === undefined) throw new Error('Undefined persisted value');

  return result;
}

function canonical(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item: unknown) => canonical(item));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));

  return value;
}

export class CommandFingerprint implements CommandFingerprintPort {
  hash(operation: string, input: RegisteredInput): Sha256 {
    const fields = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'context'));
    const context = 'context' in input ? input.context : input.input.context;
    const semantic = { operation, ...fields, context: { operatorId: context.operatorId, actorId: context.actorId, actorKind: context.actorKind, ...(context.playerId === undefined ? {} : { playerId: context.playerId }) } };

    return createHash('sha256').update(losslessJson(canonical(semantic)), 'utf8').digest('hex');
  }
}

export function canonicalJson(value: unknown): string { return losslessJson(canonical(value)); }
