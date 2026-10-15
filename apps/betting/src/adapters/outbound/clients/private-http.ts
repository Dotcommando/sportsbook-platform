import type { IServiceClientSettings } from '@sportsbook/service-transport';
import {
  boundedServiceFetch,
  camelWire,
  GRAPHQL_LIMITS,
  graphqlServiceFailure,
  jsonWire,
  objectValue,
  ServiceCallError,
  serviceFailure,
  ServiceIdentity,
  ServiceProtocol,
  snake,
} from '@sportsbook/service-transport';

import type { ICallContext } from '../../../domain/betting.model.js';
import { ErrorCode } from '../../../domain/betting.model.js';
import { BettingError } from '../../../domain/betting.policy.js';
import type { ClockPort } from '../../../ports/outbound/betting.port.js';
import { decodeInput } from './betting-client.dto.js';

export interface IPrivateOperation {
  verb: 'GET' | 'POST';
  route: string;
  field: string;
  type: string;
  shape: string;
  selection: string;
  mutates: boolean;
}

export class PrivateHttp {
  private readonly call: (
    context: ICallContext,
    body: Record<string, unknown>,
    descriptor: IPrivateOperation,
  ) => Promise<unknown>;
  private readonly decode: (name: string, value: unknown) => unknown;

  constructor(settings: IServiceClientSettings, clock: ClockPort) {
    const endpoint = new URL(settings.endpoint);

    if (!['http:', 'https:'].includes(endpoint.protocol)
      || settings.tls !== (endpoint.protocol === 'https:')
      || endpoint.username
      || endpoint.password
      || endpoint.search
      || endpoint.hash) {
      throw new Error('Explicit private HTTP endpoint required');
    }

    const identity = new ServiceIdentity(settings, () => Date.parse(clock.now()));

    if (settings.protocol === ServiceProtocol.REST) {
      this.decode = (name, value) => decodeInput(name, value, false);
      this.call =
        async (context, body, d) => {
          let route = d.route;
          const remaining = { ...body };

          for (const token of route.matchAll(/:(\w+)/g)) {
            const key = token[1]?.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()) ?? '';
            const value = remaining[key];

            if (typeof value !== 'string') {
              throw new Error('Missing private route identity');
            }
            route = route.replace(token[0], encodeURIComponent(value));
            delete remaining[key];
          }
          const url = new URL(route, endpoint);

          if (d.verb === 'GET') {
            for (const [key, value] of Object.entries(remaining)) {
              if (value !== undefined) {
                url.searchParams.set(snake(key), String(value));
              }
            }
          }

          const response = await boundedServiceFetch(
            url,
            d.verb === 'GET'
              ? { method: 'GET' }
              : { method: 'POST', body: JSON.stringify(jsonWire(remaining, true)) },
            identity,
            context,
            d.mutates,
          );

          if (response.status < 200 || response.status >= 300) {
            throw serviceFailure(response.body, d.mutates);
          }

          return camelWire(response.body);
        };
    } else if (settings.protocol === ServiceProtocol.GRAPHQL) {
      this.decode = (name, value) => decodeInput(name, value, false, true);
      const documents = new Map<IPrivateOperation, string>();

      this.call =
        async (context, body, d) => {
          let query = documents.get(d);

          if (!query) {
            query =
              (d.mutates ? 'mutation' : 'query') + ' Dependency($input:' + d.type + '!){' + d.field
              + '(input:$input){'
              + d.selection
              + '}}';
            documents.set(d, query);
          }

          const response = await boundedServiceFetch(
            endpoint,
            {
              method: 'POST',
              body: JSON.stringify({ query, operationName: 'Dependency', variables: { input: jsonWire(body) } }),
            },
            identity,
            context,
            d.mutates,
            GRAPHQL_LIMITS,
          );
          const result = objectValue(response.body);

          if (response.status !== 200 || result.errors !== undefined) {
            const first = objectValue(Array.isArray(result.errors) ? result.errors[0] ?? {} : {});

            throw graphqlServiceFailure(first.extensions ?? result, d.mutates);
          }

          return objectValue(result.data)[d.field];
        };
    } else {
      throw new Error('Unsupported HTTP protocol');
    }
  }

  async request<T>(
    context: ICallContext,
    body: Record<string, unknown>,
    descriptor: IPrivateOperation,
    guard: (value: unknown) => value is T,
  ): Promise<T> {
    try {
      const value = this.decode(descriptor.shape, await this.call(context, body, descriptor));

      if (!guard(value)) {
        throw new BettingError(ErrorCode.ADAPTER_CONTRACT_VIOLATION, descriptor.mutates);
      }

      return value;
    } catch (error) {
      if (error instanceof BettingError) {
        throw error;
      }

      const failure = error instanceof ServiceCallError
        ? error.failure
        : { code: 'ADAPTER_CONTRACT_VIOLATION', outcomeUnknown: descriptor.mutates };

      throw new BettingError(
        Object.values(ErrorCode).find(code => code === failure.code)
        ?? ErrorCode.ADAPTER_CONTRACT_VIOLATION,
        failure.outcomeUnknown,
      );
    }
  }
}
