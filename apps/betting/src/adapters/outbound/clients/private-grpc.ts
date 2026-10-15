import { createHmac } from 'node:crypto';

import type { CallOptions, ClientUnaryCall, ServiceError } from '@grpc/grpc-js';
import { credentials, Metadata, status } from '@grpc/grpc-js';
import { objectValue, strictJson, traceHeaders } from '@sportsbook/service-transport';

import * as M from '../../../domain/betting.model.js';
import { BettingError, requireRule, validUuid } from '../../../domain/betting.policy.js';
import type { ClockPort } from '../../../ports/outbound/betting.port.js';

export interface IPrivateGrpcSettings {
  endpoint: string;
  tls: boolean;
  issuer: string;
  audience: string;
  key: string;
  actorId: string;
  operators: readonly string[];
  capabilities: readonly string[];
  timeoutMs: number;
}

export class PrivateGrpc {
  readonly credentials;
  private readonly settings: IPrivateGrpcSettings;

  constructor(settings: IPrivateGrpcSettings, private readonly clock: ClockPort) {
    this.settings = structuredClone(settings);
    const endpoint = new URL('grpc://' + settings.endpoint);

    requireRule(
      endpoint.hostname.length > 0 && endpoint.port.length > 0 && !endpoint.username
      && !endpoint.password
      && endpoint.pathname === ''
      && typeof settings.tls === 'boolean'
      && settings.key.length >= 32
      && settings.issuer.length > 0
      && settings.audience.length > 0
      && validUuid(settings.actorId)
      && settings.operators.length > 0
      && settings.operators.every(validUuid)
      && settings.capabilities.length > 0
      && Number.isInteger(settings.timeoutMs)
      && settings.timeoutMs >= 1
      && settings.timeoutMs <= 60000,
    );
    this.credentials = settings.tls ? credentials.createSsl() : credentials.createInsecure();
  }

  delegated(context: M.ICallContext): Record<string, unknown> {
    requireRule(
      this.settings.operators.includes(context.operatorId),
      M.ErrorCode.PERMISSION_DENIED,
    );

    return {
      ...context,
      actorId: this.settings.actorId,
      actorKind: M.ActorKind.SERVICE,
      capabilities: [...this.settings.capabilities],
    };
  }

  call<T>(
    context: M.ICallContext,
    mutates: boolean,
    invoke: (
      metadata: Metadata,
      options: CallOptions,
      done: (error: ServiceError | null, response?: T) => void,
    ) => ClientUnaryCall,
    json: (value: T) => unknown,
  ): Promise<unknown> {
    const now = Date.parse(this.clock.now());
    const remaining = Date.parse(context.deadlineAt) - now;

    requireRule(remaining > 0, M.ErrorCode.DEADLINE_EXCEEDED);
    const delegated = this.delegated(context);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify(
        {
          ...delegated,
          iss: this.settings.issuer,
          aud: this.settings.audience,
          iat: Math.floor(now / 1000),
          exp: Math.ceil(Date.parse(context.deadlineAt) / 1000),
        },
      ),
    ).toString(
      'base64url',
    );
    const metadata = new Metadata();

    for (const [key, value] of Object.entries(traceHeaders())) {
      metadata.set(key, value);
    }
    metadata.set(
      'authorization',
      'Bearer ' + header + '.' + payload + '.'
      + createHmac('sha256', this.settings.key).update(header + '.' + payload).digest('base64url'),
    );
    metadata.set('x-correlation-id', context.correlationId);
    metadata.set('x-deadline-at', context.deadlineAt);

    return new Promise(
      (resolve, reject) => {
        invoke(
          metadata,
          { deadline: new Date(Date.now() + Math.min(remaining, this.settings.timeoutMs)) },
          (error, response) => {
            if (error) {
              reject(this.error(error, mutates));

              return;
            }
            if (response === undefined) {
              reject(new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, mutates));

              return;
            }

            try {
              const result = objectValue(json(response));

              if (result.error !== undefined) {
                const failure = objectValue(result.error);
                const code = codeValue(failure.code);

                reject(new BettingError(code, failure.outcomeUnknown === true));

                return;
              }
              if (result.value === undefined) {
                throw new Error('Missing result');
              }
              resolve(result.value);
            } catch {
              reject(new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION, mutates));
            }
          },
        );
      },
    );
  }

  private error(error: ServiceError, mutates: boolean): BettingError {
    try {
      if (error.details.length > 65536) {
        throw new Error('Oversize error');
      }

      const fields = objectValue(strictJson(error.details));

      return new BettingError(codeValue(fields.code), fields.outcomeUnknown === true);
    } catch {
      return new BettingError(
        error.code === status.RESOURCE_EXHAUSTED
          ? M.ErrorCode.OVERLOADED
          : error.code === status.DEADLINE_EXCEEDED
            ? M.ErrorCode.DEADLINE_EXCEEDED
            : error.code === status.UNAVAILABLE || error.code === status.CANCELLED
              ? M.ErrorCode.DEPENDENCY_UNAVAILABLE
              : M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
        mutates,
      );
    }
  }
}

function codeValue(value: unknown): M.ErrorCode {
  const found = Object.values(M.ErrorCode).find(code => code === value || value === 'ERROR_CODE_' + code);

  if (!found) {
    throw new Error('Unknown dependency error');
  }

  return found;
}
