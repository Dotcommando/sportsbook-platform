import { createHmac } from 'node:crypto';

import type { CallOptions, ClientUnaryCall, ServiceError } from '@grpc/grpc-js';
import { Metadata, status } from '@grpc/grpc-js';
import { traceHeaders } from '@sportsbook/observability';

import type { IIdentityClaims } from './identity.js';
import { REST_LIMITS } from './transport-limits.js';
import { camelWire, objectValue, strictJson } from './wire.js';

export interface IServiceIdentitySettings {
  issuer: string;
  audience: string;
  key: string;
  actorId: string;
  operators: readonly string[];
  capabilities: readonly string[];
  timeoutMs: number;
}

export enum ServiceProtocol {
  GRPC = 'GRPC',
  REST = 'REST',
  GRAPHQL = 'GRAPHQL',
}

export interface IServiceClientSettings extends IServiceIdentitySettings {
  protocol: ServiceProtocol;
  endpoint: string;
  tls: boolean;
}

export interface IServiceFailure {
  code: string;
  retryable: boolean;
  outcomeUnknown: boolean;
}

export class ServiceCallError extends Error {
  constructor(readonly failure: IServiceFailure) {
    super(failure.code);
  }
}

export class ServiceIdentity {
  private readonly settings: Readonly<IServiceIdentitySettings>;

  constructor(settings: IServiceIdentitySettings, private readonly now: () => number = Date.now) {
    if (!settings.issuer || !settings.audience || Buffer.byteLength(settings.key) < 32
      || !/^[-a-f0-9]{36}$/.test(settings.actorId)
      || !settings.operators.length
      || !settings.capabilities.length
      || !Number.isSafeInteger(settings.timeoutMs)
      || settings.timeoutMs < 1
      || settings.timeoutMs > 60000) {
      throw new Error('Invalid service identity settings');
    }
    this.settings = Object.freeze(structuredClone(settings));
  }

  delegate(context: IIdentityClaims): IIdentityClaims {
    if (!this.settings.operators.includes(context.operatorId)) {
      throw new ServiceCallError({ code: 'PERMISSION_DENIED', retryable: false, outcomeUnknown: false });
    }

    return {
      ...context,
      actorId: this.settings.actorId,
      actorKind: 'SERVICE',
      capabilities: [...this.settings.capabilities],
    };
  }

  remaining(context: IIdentityClaims): number {
    const remaining = Math.min(Date.parse(context.deadlineAt) - this.now(), this.settings.timeoutMs);

    if (!Number.isFinite(remaining) || remaining <= 0) {
      throw new ServiceCallError({ code: 'DEADLINE_EXCEEDED', retryable: true, outcomeUnknown: false });
    }

    return remaining;
  }

  headers(context: IIdentityClaims): Record<string, string> {
    this.remaining(context);
    const claims = this.delegate(context);
    const now = this.now();
    const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify(
        {
          ...claims,
          iss: this.settings.issuer,
          aud: this.settings.audience,
          iat: Math.floor(now / 1000),
          exp: Math.ceil(Date.parse(context.deadlineAt) / 1000),
        },
      ),
    ).toString(
      'base64url',
    );

    return {
      ...traceHeaders(),
      authorization: 'Bearer ' + head + '.' + body + '.'
        + createHmac('sha256', this.settings.key).update(head + '.' + body).digest('base64url'),
      'x-correlation-id': context.correlationId,
      'x-deadline-at': context.deadlineAt,
    };
  }
}

export function protobufJsonDefaults(message: unknown, json: unknown): unknown {
  if (Array.isArray(message)) {
    return message.map(
      (value, index) => protobufJsonDefaults(value, Array.isArray(json) ? json[index] : undefined),
    );
  }
  if (message !== null && typeof message === 'object') {
    const encoded = json !== null && typeof json === 'object' ? objectValue(json) : {};
    const output = { ...encoded };

    for (const [key, value] of Object.entries(message)) {
      if (value === undefined) {
        continue;
      }

      const branch = value !== null && typeof value === 'object' && !Array.isArray(value)
        ? objectValue(value)
        : undefined;

      if (branch && typeof branch.$case === 'string' && branch[branch.$case] !== undefined) {
        output[branch.$case] = protobufJsonDefaults(branch[branch.$case], encoded[branch.$case]);
      } else {
        output[key] = protobufJsonDefaults(value, encoded[key]);
      }
    }

    return output;
  }

  return json === undefined ? message : json;
}

export function serviceFailure(value: unknown, unknownOutcome: boolean): ServiceCallError {
  try {
    const fields = objectValue(camelWire(value));

    if (typeof fields.code !== 'string' || !/^(?:ERROR_CODE_)?[A-Z][A-Z_]{1,63}$/.test(fields.code)
      || typeof fields.retryable !== 'boolean'
      || typeof fields.outcomeUnknown !== 'boolean') {
      throw new Error('Malformed service error');
    }

    return new ServiceCallError(
      {
        code: fields.code.replace(/^ERROR_CODE_/, ''),
        retryable: fields.retryable,
        outcomeUnknown: fields.outcomeUnknown,
      },
    );
  } catch {
    return new ServiceCallError(
      { code: 'ADAPTER_CONTRACT_VIOLATION', retryable: false, outcomeUnknown: unknownOutcome },
    );
  }
}

export function graphqlServiceFailure(value: unknown, unknownOutcome: boolean): ServiceCallError {
  if (value !== null && typeof value === 'object' && 'code' in value
    && value.code === 'SUBREQUEST_HTTP_ERROR') {
    return new ServiceCallError(
      { code: 'DEPENDENCY_UNAVAILABLE', retryable: true, outcomeUnknown: unknownOutcome },
    );
  }

  return serviceFailure(value, unknownOutcome);
}

export async function boundedServiceFetch(
  url: URL,
  init: RequestInit,
  identity: ServiceIdentity,
  context: IIdentityClaims,
  mutates: boolean,
  limits: Readonly<{
    requestBytes: number;
    responseBytes: number;
  }> = REST_LIMITS,
): Promise<{
  status: number;
  body: unknown;
}> {
  let dispatched = false;

  try {
    if (typeof init.body === 'string' && Buffer.byteLength(init.body) > limits.requestBytes) {
      throw new ServiceCallError({ code: 'INVALID_INPUT', retryable: false, outcomeUnknown: false });
    }

    const timeout = identity.remaining(context);
    const headers = { ...identity.headers(context), 'content-type': 'application/json', ...init.headers };

    dispatched = true;
    const response = await fetch(url, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(timeout) });

    if (!response.body) {
      throw new Error('Missing response');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    while (true) {
      const part = await reader.read();

      if (part.done) {
        break;
      }
      size += part.value.byteLength;

      if (size > limits.responseBytes) {
        await reader.cancel();
        throw new ServiceCallError({ code: 'OVERLOADED', retryable: true, outcomeUnknown: mutates });
      }
      chunks.push(part.value);
    }

    return {
      status: response.status,
      body: strictJson(
        new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
        limits.responseBytes,
      ),
    };
  } catch (error) {
    if (error instanceof ServiceCallError) {
      throw error;
    }
    throw new ServiceCallError(
      {
        code: error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
          ? 'DEADLINE_EXCEEDED'
          : 'DEPENDENCY_UNAVAILABLE',
        retryable: true,
        outcomeUnknown: mutates && dispatched,
      },
    );
  }
}

export function callServiceGrpc<T>(
  identity: ServiceIdentity,
  context: IIdentityClaims,
  mutates: boolean,
  invoke: (
    metadata: Metadata,
    options: CallOptions,
    callback: (error: ServiceError | null, response?: T) => void,
  ) => ClientUnaryCall,
  json: (response: T) => unknown,
): Promise<unknown> {
  const remaining = identity.remaining(context);
  const metadata = new Metadata();

  for (const [key, value] of Object.entries(identity.headers(context))) {
    metadata.set(key, value);
  }

  return new Promise(
    (resolve, reject) => {
      invoke(
        metadata,
        { deadline: new Date(Date.now() + remaining) },
        (error, response) => {
          if (error) {
            try {
              reject(serviceFailure(strictJson(error.details), mutates));
            } catch {
              reject(
                new ServiceCallError(
                  {
                    code: error.code === status.RESOURCE_EXHAUSTED
                      ? 'OVERLOADED'
                      : error.code === status.DEADLINE_EXCEEDED
                        ? 'DEADLINE_EXCEEDED'
                        : error.code === status.UNAVAILABLE || error.code === status.CANCELLED
                          ? 'DEPENDENCY_UNAVAILABLE'
                          : 'ADAPTER_CONTRACT_VIOLATION',
                    retryable: true,
                    outcomeUnknown: mutates,
                  },
                ),
              );
            }

            return;
          }

          try {
            if (response === undefined) {
              throw new Error('No response');
            }

            const fields = objectValue(protobufJsonDefaults(response, json(response)));

            if (fields.error !== undefined) {
              reject(serviceFailure(fields.error, mutates));

              return;
            }
            if (fields.value === undefined) {
              throw new Error('No response value');
            }
            resolve(fields.value);
          } catch {
            reject(
              new ServiceCallError(
                { code: 'ADAPTER_CONTRACT_VIOLATION', retryable: false, outcomeUnknown: mutates },
              ),
            );
          }
        },
      );
    },
  );
}
