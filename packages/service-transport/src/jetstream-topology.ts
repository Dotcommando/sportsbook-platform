import type { JetStreamManager } from 'nats';
import { AckPolicy, DeliverPolicy, DiscardPolicy, nanos, ReplayPolicy, RetentionPolicy, StorageType } from 'nats';

export interface IJetStreamTopology {
  duplicateWindowMs: number;
  retentionMs: number;
  maxMessages: number;
  maxBytes: number;
  ackWaitMs: number;
  maxDeliver: number;
  backoffMs: readonly number[];
  maxAckPending: number;
}

const streams = [
  ['SPORTSBOOK_EVENTS', 'sportsbook.events.v1.>'],
  ['SPORTSBOOK_PLAYER', 'sportsbook.player.v1.>'],
  ['SPORTSBOOK_LEDGER', 'sportsbook.ledger.v1.>'],
  ['SPORTSBOOK_BETTING', 'sportsbook.betting.v1.>'],
];

export async function configureJetStream(
  manager: JetStreamManager,
  settings: IJetStreamTopology,
): Promise<void> {
  if (!Object.values(settings).every(
    value =>
      Array.isArray(value) || typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
  )
    || settings.duplicateWindowMs > settings.retentionMs
    || settings.retentionMs > 2592000000
    || settings.ackWaitMs > 60000
    || settings.maxDeliver < 2
    || settings.maxDeliver > 100
    || settings.maxAckPending > 10000
    || !settings.backoffMs.length
    || settings.backoffMs.length > settings.maxDeliver
    || settings.backoffMs[0] !== settings.ackWaitMs
    || !settings.backoffMs.every(
      (value, index) =>
        Number.isSafeInteger(value) && value >= settings.ackWaitMs && value <= 60000
        && (index === 0 || value >= (settings.backoffMs[index - 1] ?? 0)),
    )) {
    throw new Error('Invalid bounded JetStream topology');
  }

  for (const [name, subject] of streams) {
    if (!name || !subject) {
      throw new Error('Invalid subject registry');
    }

    const config = {
      name,
      subjects: [subject],
      storage: StorageType.File,
      retention: RetentionPolicy.Limits,
      discard: DiscardPolicy.Old,
      max_msgs: settings.maxMessages,
      max_bytes: settings.maxBytes,
      max_age: nanos(settings.retentionMs),
      duplicate_window: nanos(settings.duplicateWindowMs),
      num_replicas: 1,
    };
    let existing;

    try {
      existing = await manager.streams.info(name);
    } catch (error) {
      if (!missing(error)) {
        throw error;
      }
    }

    if (existing) {
      for (const key of [
        'subjects',
        'storage',
        'retention',
        'discard',
        'max_msgs',
        'max_bytes',
        'max_age',
        'duplicate_window',
        'num_replicas',
      ] as const) {
        if (JSON.stringify(existing.config[key]) !== JSON.stringify(config[key])) {
          throw new Error('JetStream stream configuration drift: ' + name + '/' + key);
        }
      }
    } else {
      await manager.streams.add(config);
    }
  }

  for (const [stream, durable, subject] of [
    ['SPORTSBOOK_EVENTS', 'BETTING_RESULTS', 'sportsbook.events.v1.event_result'],
    ['SPORTSBOOK_PLAYER', 'LEDGER_PLAYERS', 'sportsbook.player.v1.registered'],
  ]) {
    if (!stream || !durable || !subject) {
      throw new Error('Invalid consumer registration');
    }

    const config = {
      durable_name: durable,
      filter_subject: subject,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
      ack_wait: nanos(settings.ackWaitMs),
      max_deliver: settings.maxDeliver,
      backoff: settings.backoffMs.map(nanos),
      max_ack_pending: settings.maxAckPending,
    };
    let existing;

    try {
      existing = await manager.consumers.info(stream, durable);
    } catch (error) {
      if (!missing(error)) {
        throw error;
      }
    }

    if (existing) {
      for (const key of [
        'durable_name',
        'filter_subject',
        'ack_policy',
        'deliver_policy',
        'replay_policy',
        'ack_wait',
        'max_deliver',
        'backoff',
        'max_ack_pending',
      ] as const) {
        if (JSON.stringify(existing.config[key]) !== JSON.stringify(config[key])) {
          throw new Error('JetStream consumer configuration drift: ' + key);
        }
      }
    } else {
      await manager.consumers.add(stream, config);
    }
  }
}

function missing(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  const fields = Object.fromEntries(Object.entries(error));
  const api = fields.api_error !== null && typeof fields.api_error === 'object'
    ? Object.fromEntries(Object.entries(fields.api_error))
    : {};

  return fields.code === '404' || fields.code === 404 || api.code === 404;
}
