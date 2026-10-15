import { observePublication, traceHeaders } from '@sportsbook/observability';
import type { NatsConnection } from 'nats';
import { connect, headers } from 'nats';

import { MessagingMetric, MessagingMetrics } from './messaging-metrics.js';
import { NATS_LIMITS } from './transport-limits.js';

export enum BrokerCredentialKind {
  TOKEN = 'TOKEN',
  USER = 'USER',
}

export type BrokerCredentials = {
  kind: BrokerCredentialKind.TOKEN;
  token: string;
} | {
  kind: BrokerCredentialKind.USER;
  user: string;
  password: string;
};

export interface IDurablePublisherSettings {
  servers: readonly string[];
  credentials: BrokerCredentials;
  timeoutMs: number;
}

export class DurablePublisher {
  private readiness: Promise<void> | undefined;

  private constructor(
    private readonly connection: NatsConnection,
    private readonly timeoutMs: number,
    readonly metrics: MessagingMetrics,
  ) { }

  static async connect(
    settings: IDurablePublisherSettings,
    metrics = new MessagingMetrics('publisher'),
  ): Promise<DurablePublisher> {
    if (!settings.servers.length
      || !settings.servers.every(value => ['nats:', 'tls:'].includes(new URL(value).protocol))
      || !Number.isInteger(settings.timeoutMs)
      || settings.timeoutMs < 1
      || settings.timeoutMs > 60000) {
      throw new Error('Explicit broker endpoints/timeout required');
    }

    const auth = settings.credentials;

    if (auth.kind === BrokerCredentialKind.TOKEN && !auth.token
      || auth.kind === BrokerCredentialKind.USER && (!auth.user || !auth.password)) {
      throw new Error('Broker credentials required');
    }

    const connection = await connect({
      servers: [...settings.servers],
      timeout: settings.timeoutMs,
      ...(auth.kind === BrokerCredentialKind.TOKEN ? { token: auth.token } : { user: auth.user, pass: auth.password }),
    });

    return new DurablePublisher(connection, settings.timeoutMs, metrics);
  }

  async publish(subject: string, messageId: string, data: Uint8Array, remainingMs: number): Promise<void> {
    if (!/^[a-z][a-z0-9_.]+$/.test(subject) || !messageId || data.byteLength > NATS_LIMITS.eventBytes
      || !Number.isFinite(remainingMs)
      || remainingMs <= 0) {
      throw new Error('Invalid bounded publication');
    }

    try {
      const receipt = await observePublication(
        subject + ' publish',
        async () => {
          const carrier = headers();

          for (const [key, value] of Object.entries(traceHeaders())) {
            carrier.set(key, value);
          }

          return this.connection.jetstream({ timeout: Math.min(this.timeoutMs, remainingMs) }).publish(
            subject,
            data,
            { msgID: messageId, headers: carrier },
          );
        },
      );

      if (!receipt.stream || !Number.isSafeInteger(receipt.seq) || receipt.seq < 1) {
        throw new Error('Invalid durable publication receipt');
      }
      this.metrics.increment(MessagingMetric.PUBLISHES);
    } catch (error) {
      this.metrics.increment(MessagingMetric.PUBLISH_FAILURES);
      throw error;
    }
  }

  async ready(): Promise<void> {
    if (this.connection.isClosed()) {
      throw new Error('Broker unavailable');
    }
    if (!this.readiness) {
      const probe = this.connection.flush();

      this.readiness = probe;
      const clear = (): void => {
        if (this.readiness === probe) {
          this.readiness = undefined;
        }
      };

      void probe.then(clear, clear);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        this.readiness,
        new Promise<void>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Broker readiness deadline')), Math.min(this.timeoutMs, 1500));
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  async close(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        this.connection.drain(),
        new Promise<void>((resolve, reject) => {
          timer = setTimeout(() => {
            void this.connection.close().then(resolve, reject);
          }, this.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
      await this.connection.close();
    }
  }
}
