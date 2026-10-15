import type {NatsConnection, Subscription} from 'nats';
import {AckPolicy, connect} from 'nats';

import type {IDurablePublisherSettings} from './durable-publisher.js';
import {BrokerCredentialKind} from './durable-publisher.js';
import type {MessagingMetrics} from './messaging-metrics.js';
import {MessagingMetric} from './messaging-metrics.js';

export enum DeliveryDisposition {ACK = 'ACK', RETRY = 'RETRY', POISON = 'POISON'}

export interface IDurableConsumerSettings extends IDurablePublisherSettings {stream:string;durable:string;subject:string;pullExpiresMs:number;retryDelayMs:number;}

export interface IDelivery {subject:string;messageId:string;data:Uint8Array;deliveryCount:number;}

export interface IDeliveryBatch {selected:number;acknowledged:number;retried:number;poison:number;failed:number;}

export class DurableConsumer {
  private readonly advisories:Subscription[] = [];

  private constructor(private readonly connection:NatsConnection, private readonly settings:IDurableConsumerSettings, readonly metrics:MessagingMetrics) {}

  static async connect(settings:IDurableConsumerSettings, metrics:MessagingMetrics):Promise<DurableConsumer> {
    if (!settings.servers.length || !settings.servers.every(value=>['nats:', 'tls:'].includes(new URL(value).protocol)) || ![settings.timeoutMs, settings.pullExpiresMs, settings.retryDelayMs].every(value=>Number.isInteger(value) && value >= 1 && value <= 60000) || settings.pullExpiresMs < 1000 || !/^\w+$/.test(settings.stream) || !/^\w+$/.test(settings.durable) || !/^sportsbook\.[a-z]+\.v1\.[a-z_]+$/.test(settings.subject)) throw new Error('Invalid durable consumer settings');

const auth = settings.credentials;const connection = await connect({servers:[...settings.servers], timeout:settings.timeoutMs, ...(auth.kind === BrokerCredentialKind.TOKEN ? {token:auth.token} : {user:auth.user, pass:auth.password})});const instance = new DurableConsumer(connection, structuredClone(settings), metrics);

    try {const consumer = await connection.jetstream().consumers.get(settings.stream, settings.durable);const info = await consumer.info();

if (info.config.ack_policy !== AckPolicy.Explicit || info.config.filter_subject !== settings.subject || !info.config.max_deliver || info.config.max_deliver < 2) throw new Error('Consumer must use explicit acknowledgment and bounded deliveries');

for (const event of ['MAX_DELIVERIES', 'MSG_TERMINATED']) {const subscription = connection.subscribe('$JS.EVENT.ADVISORY.CONSUMER.' + event + '.' + settings.stream + '.' + settings.durable);

instance.advisories.push(subscription);void(async()=>{for await (const _message of subscription) {void _message;metrics.increment(MessagingMetric.ADVISORIES);}})().catch(()=>metrics.increment(MessagingMetric.ADVISORIES));}

 return instance;} catch(error) {await connection.close();throw error;}
  }

  async consumeBatch(limit:number, handle:(delivery:IDelivery)=>Promise<DeliveryDisposition>):Promise<IDeliveryBatch> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Invalid delivery batch');

const consumer = await this.connection.jetstream().consumers.get(this.settings.stream, this.settings.durable);const info = await consumer.info();

this.metrics.set(MessagingMetric.CONSUMER_LAG, info.num_pending + info.num_ack_pending);const counts:IDeliveryBatch = {selected:0, acknowledged:0, retried:0, poison:0, failed:0};const messages = await consumer.fetch({max_messages:limit, expires:this.settings.pullExpiresMs});

    for await (const message of messages) {counts.selected++;this.metrics.increment(MessagingMetric.DELIVERIES);

if (message.info.redeliveryCount > 1) this.metrics.increment(MessagingMetric.REDELIVERIES);

let disposition:DeliveryDisposition;

try {disposition = await handle({subject:message.subject, messageId:message.headers?.get('Nats-Msg-Id') ?? '', data:message.data, deliveryCount:message.info.redeliveryCount});} catch {disposition = DeliveryDisposition.RETRY;}

      try {if (this.connection.isClosed()) throw new Error('Connection closed before acknowledgment');if (disposition === DeliveryDisposition.ACK) {if (!await message.ackAck({timeout:this.settings.timeoutMs})) throw new Error('No acknowledgment confirmation');counts.acknowledged++;this.metrics.increment(MessagingMetric.ACKNOWLEDGED);} else if (disposition === DeliveryDisposition.POISON) {message.term('INVALID_OR_CONFLICTING_EVENT');counts.poison++;this.metrics.increment(MessagingMetric.POISON);} else {message.nak(this.settings.retryDelayMs);counts.retried++;this.metrics.increment(MessagingMetric.RETRIES);}} catch {counts.failed++;this.metrics.increment(MessagingMetric.ACK_FAILURES);}
    }

    if (!this.connection.isClosed()) {const after = await consumer.info();

this.metrics.set(MessagingMetric.CONSUMER_LAG, after.num_pending + after.num_ack_pending);}

 return counts;
  }

  async close():Promise<void> {for (const subscription of this.advisories)subscription.unsubscribe();await this.connection.close();}
}
