import { createHash, randomUUID } from 'node:crypto';

import type { UUID } from '../../../domain/events.model.js';
import { validUuid } from '../../../domain/events.policy.js';
import type { IdGeneratorPort } from '../../../ports/outbound/events.port.js';

export class UuidGenerator implements IdGeneratorPort {
  private readonly namespace: Buffer;

  constructor(namespace: UUID) {
    if (!validUuid(namespace)) throw new Error('Explicit non-nil UUID namespace required');
    this.namespace = Buffer.from(namespace.replaceAll('-', ''), 'hex');
  }

  next(purpose: string): UUID {
    this.validatePurpose(purpose);

    return randomUUID();
  }

  derive(operatorId: UUID, requestId: UUID, purpose: string): UUID {
    if (!validUuid(operatorId) || !validUuid(requestId)) throw new Error('Invalid derivation identity');
    this.validatePurpose(purpose);
    const name = JSON.stringify(['v1', operatorId, requestId, purpose]);
    const digest = createHash('sha1').update(this.namespace).update(name, 'utf8').digest().subarray(0, 16);

    digest.writeUInt8((digest.readUInt8(6) & 0x0f) | 0x50, 6);
    digest.writeUInt8((digest.readUInt8(8) & 0x3f) | 0x80, 8);
    const hex = digest.toString('hex');

    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
  }

  private validatePurpose(purpose: string): void {
    if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(purpose)) throw new Error('Invalid identity purpose');
  }
}
