import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export interface IProtectionSettings {activeKeyId:string;encryptionKeys:Readonly<Record<string, string>>;contactHmacKey:string;}

export class ProtectedValues {
  private readonly keys:Readonly<Record<string, string>>;
  private readonly hmacKey:Buffer;
  readonly keyId:string;

  constructor(settings:IProtectionSettings) {if (!/^[A-Za-z0-9._-]{1,64}$/.test(settings.activeKeyId) || !settings.encryptionKeys[settings.activeKeyId] || !Object.entries(settings.encryptionKeys).every(([id, key])=>/^[A-Za-z0-9._-]{1,64}$/.test(id) && /^[0-9a-f]{64}$/.test(key)) || !/^[0-9a-f]{64}$/.test(settings.contactHmacKey)) throw new Error('Explicit profile encryption/HMAC keys required');this.keys = Object.freeze({...settings.encryptionKeys});this.hmacKey = Buffer.from(settings.contactHmacKey, 'hex');this.keyId = settings.activeKeyId;}

  protect(value:string, scope:string):string {const key = this.keys[this.keyId];

if (!key) throw new Error('Encryption key unavailable');

const iv = randomBytes(12);const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);

cipher.setAAD(Buffer.from(scope));const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

return Buffer.from(JSON.stringify({keyId:this.keyId, iv:iv.toString('base64'), ciphertext:encrypted.toString('base64'), tag:cipher.getAuthTag().toString('base64')})).toString('base64');}

  reveal(value:string, scope:string):string {const parsed:unknown = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));

if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid protected value');

const envelope = Object.fromEntries(Object.entries(parsed));

if (typeof envelope.keyId !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string' || typeof envelope.tag !== 'string') throw new Error('Invalid protected envelope');

const key = this.keys[envelope.keyId];

if (!key) throw new Error('Encryption key unavailable');

const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(envelope.iv, 'base64'));

decipher.setAAD(Buffer.from(scope));decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));

return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8');}

  reference(value:string, scope:string):string {return createHmac('sha256', this.hmacKey).update(JSON.stringify([scope, value])).digest('base64');}
}
