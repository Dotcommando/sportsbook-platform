import { Latencies } from './latency.js';

export { Latencies };

import { createHash, createHmac } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import type { IIdentityClaims, IIdentitySettings } from '@sportsbook/service-transport';
import { objectValue, strictJson } from '@sportsbook/service-transport';

import type { ILoadResult, ILoadScenario } from './experiment.model.js';
import { LoadMode } from './experiment.model.js';

export interface IHttpAction {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: unknown;
  actor: Omit<IIdentityClaims, 'correlationId' | 'deadlineAt'>;
}

export interface IPlatformFixture {
  version: 1;
  setup: {
    service: string;
    action: IHttpAction;
    expectedStatus: number;
  }[];
  actions: IHttpAction[];
  auditActor: Omit<IIdentityClaims, 'correlationId' | 'deadlineAt'>;
}

export function stableId(seed: string, sequence: number, purpose: string): string {
  const hex = createHash('sha256').update(JSON.stringify([seed, sequence, purpose])).digest('hex');

  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-5' + hex.slice(13, 16) + '-a' + hex.slice(17, 20)
    + '-'
    + hex.slice(20, 32);
}

export function materialize(value: unknown, seed: string, sequence: number, instant: string): unknown {
  if (value === '$REQUEST_ID') {
    return stableId(seed, sequence, 'request');
  }
  if (value === '$NOW') {
    return instant;
  }
  if (Array.isArray(value)) {
    return value.map(v => materialize(v, seed, sequence, instant));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, materialize(item, seed, sequence, instant)]),
    );
  }

  return value;
}

export function requestHeaders(settings: IIdentitySettings, claims: IIdentityClaims): Record<string, string> {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify(
      {
        ...claims,
        iss: settings.issuer,
        aud: settings.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.ceil(Date.parse(claims.deadlineAt) / 1000),
      },
    ),
  ).toString(
    'base64url',
  );

  return {
    'content-type': 'application/json',
    authorization: 'Bearer ' + header + '.' + payload + '.'
      + createHmac('sha256', settings.key).update(header + '.' + payload).digest('base64url'),
    'x-correlation-id': claims.correlationId,
    'x-deadline-at': claims.deadlineAt,
  };
}

export async function sendAction(
  base: string,
  identity: IIdentitySettings,
  action: IHttpAction,
  seed: string,
  sequence: number,
): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  if (!/^\/(?:v1|internal\/v1)\/[a-zA-Z0-9_/?=&.%-]+$/.test(action.path)
    || action.path.includes('..')) {
    throw new Error('Allowlisted owner/public REST path required');
  }

  const now = new Date().toISOString();
  const context = {
    ...action.actor,
    correlationId: stableId(seed, sequence, 'correlation'),
    deadlineAt: new Date(Date.now() + Math.min(identity.maximumDeadlineMs, 10000)).toISOString(),
  };
  const body = action.body === undefined
    ? undefined
    : JSON.stringify(materialize(action.body, seed, sequence, now));

  if (body && Buffer.byteLength(body) > 65536) {
    throw new Error('Fixture request exceeds REST limit');
  }

  const response = await fetch(
    base + action.path,
    {
      method: action.method,
      headers: requestHeaders(identity, context),
      ...(body === undefined ? {} : { body }),
      redirect: 'error',
      signal: AbortSignal.timeout(Math.min(identity.maximumDeadlineMs, 10000)),
    },
  );

  if (!response.body) {
    throw new Error('Empty response');
  }

  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const reader = response.body.getReader();

  try {
    while (true) {
      const part = await reader.read();

      if (part.done) {
        break;
      }
      bytes += part.value.length;

      if (bytes > 1048576) {
        throw new Error('Load response limit');
      }
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }

  return {
    status: response.status,
    body: objectValue(
      strictJson(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), 1048576),
    ),
  };
}

export async function runLoad(
  scenario: ILoadScenario,
  invoke: (sequence: number) => Promise<{
    status: number;
    body: Record<string, unknown>;
  }>,
  sequenceOffset = 0,
): Promise<ILoadResult> {
  const started = new Date().toISOString();
  const start = performance.now();
  const stop = start + scenario.durationSeconds * 1000;
  const latency = new Latencies();
  let offered = 0n;
  let completed = 0n;
  let businessRejected = 0n;
  let technicalFailed = 0n;
  let unknown = 0n;
  let replayed = 0n;
  let sequence = sequenceOffset;
  const inFlight = new Set<Promise<void>>();
  const dispatch = (): void => {
    offered++;

    if (inFlight.size >= scenario.maxInFlight) {
      technicalFailed++;

      return;
    }

    const current = sequence++;
    const at = performance.now();
    const work = Promise.resolve().then(() => invoke(current)).then(
      result => {
        if (result.body.outcome_unknown === true || result.body.outcome === 'PENDING') {
          unknown++;
        } else if (result.status >= 200 && result.status < 300) {
          completed++;

          if (result.body.replayed === true) {
            replayed++;
          }
        } else if (result.status >= 400 && result.status < 500 && ![408, 429].includes(result.status)) {
          businessRejected++;
        } else {
          technicalFailed++;
        }
      },
      () => {
        unknown++;
      },
    ).finally(
      () => {
        latency.record(performance.now() - at);
        inFlight.delete(work);
      },
    );

    inFlight.add(work);
  };

  if (scenario.mode === LoadMode.CLOSED_LOOP) {
    while (performance.now() < stop) {
      while (inFlight.size < (scenario.concurrency ?? 0) && performance.now() < stop) {
        dispatch();
      }

      if (inFlight.size) {
        await Promise.race(inFlight);
      } else {
        break;
      }
    }
  } else {
    const rate = scenario.offeredRps ?? 0;
    let tick = 0;

    while (performance.now() < stop) {
      const elapsed = performance.now() - start;
      const due = Math.min(Math.floor(elapsed * rate / 1000) + 1, scenario.durationSeconds * rate);

      while (tick < due) {
        dispatch();
        tick++;
      }
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }
  await Promise.all(inFlight);

  return {
    offered: String(offered),
    completed: String(completed),
    businessRejected: String(businessRejected),
    technicalFailed: String(technicalFailed),
    unknown: String(unknown),
    replayed: String(replayed),
    latencyHistogram: { boundsMs: latency.bounds, counts: latency.counts },
    latency: latency.summary(),
    interval: { start: started, end: new Date().toISOString() },
  };
}
