import type { NatsConnection } from 'nats';
import { connect } from 'nats';

export enum BrokerCredentialKind { TOKEN = 'TOKEN', USER = 'USER' }

export type BrokerCredentials = {kind:BrokerCredentialKind.TOKEN;token:string} | {kind:BrokerCredentialKind.USER;user:string;password:string};

export interface IDurablePublisherSettings {servers:readonly string[];credentials:BrokerCredentials;timeoutMs:number;}

export class DurablePublisher {
  private constructor(private readonly connection:NatsConnection, private readonly timeoutMs:number) {}

  static async connect(settings:IDurablePublisherSettings):Promise<DurablePublisher> {if (!settings.servers.length || !settings.servers.every(value=>['nats:', 'tls:'].includes(new URL(value).protocol)) || !Number.isInteger(settings.timeoutMs) || settings.timeoutMs < 1 || settings.timeoutMs > 60000) throw new Error('Explicit broker endpoints/timeout required');

const auth = settings.credentials;

if (auth.kind === BrokerCredentialKind.TOKEN && !auth.token || auth.kind === BrokerCredentialKind.USER && (!auth.user || !auth.password)) throw new Error('Broker credentials required');

const connection = await connect({servers:[...settings.servers], timeout:settings.timeoutMs, ...(auth.kind === BrokerCredentialKind.TOKEN ? {token:auth.token} : {user:auth.user, pass:auth.password})});

return new DurablePublisher(connection, settings.timeoutMs);}

  async publish(subject:string, messageId:string, data:Uint8Array, remainingMs:number):Promise<void> {if (!/^[a-z][a-z0-9_.]+$/.test(subject) || !messageId || data.byteLength > 65536 || !Number.isFinite(remainingMs) || remainingMs <= 0) throw new Error('Invalid bounded publication');

const receipt = await this.connection.jetstream({timeout:Math.min(this.timeoutMs, remainingMs)}).publish(subject, data, {msgID:messageId});

if (!receipt.stream || !Number.isSafeInteger(receipt.seq) || receipt.seq < 1) throw new Error('Invalid durable publication receipt');}

  async close():Promise<void> {await this.connection.drain();}
}
