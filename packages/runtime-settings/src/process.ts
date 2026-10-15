import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { isIP } from 'node:net';

import type { IObservationSettings } from '@sportsbook/observability';

export interface IProcessHandle {
  close(): Promise<void>;
}

export interface IOperationsSettings {
  host: string;
  port: number;
  key: string;
  observation?: IObservationSettings;
  dependencies?: string[];
}

export interface IOperationsCallbacks {
  ready(): Promise<boolean>;
  metrics(): string | Promise<string>;
}

export function failureCode(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'code' in error
    && typeof error.code === 'string'
    && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code)) {
    return error.code;
  }

  return 'PROCESS_FAILURE';
}

export function requiredSettingsFile(args: readonly string[]): string {
  if (args.length !== 1 || !args[0]) {
    throw new Error('Supply exactly one explicit process settings file');
  }

  return args[0];
}

export function validateOperationsSettings(settings: IOperationsSettings): void {
  if (!isIP(settings.host)
    || !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/.test(settings.host)
    || !Number.isInteger(settings.port)
    || settings.port < 0
    || settings.port > 65535
    || Buffer.byteLength(settings.key) < 32) {
    throw new Error('Explicit private operations listener and scrape key required');
  }
  if (settings.dependencies
    && (settings.dependencies.length > 16
      || settings.dependencies.some(
        value => {
          const uri = new URL(value);

          return !['http:', 'https:'].includes(uri.protocol) || Boolean(uri.username || uri.password)
            || uri.pathname !== '/health/ready'
            || Boolean(uri.search || uri.hash);
        },
      ))) {
    throw new Error('Explicit bounded dependency readiness targets required');
  }
}

export async function closeAll(callbacks: readonly (() => void | Promise<void | undefined>)[]): Promise<void> {
  const failures: unknown[] = [];

  for (const close of callbacks) {
    try {
      await close();
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length) {
    throw new AggregateError(failures, 'Process resources failed to close');
  }
}

export async function startOperations(
  settings: IOperationsSettings,
  callbacks: IOperationsCallbacks,
): Promise<IProcessHandle> {
  validateOperationsSettings(settings);
  const expected = createHash('sha256').update('Bearer ' + settings.key).digest();
  const server = createServer(
    (request, response) => {
      void (async () => {
        if (request.method !== 'GET') {
          response.writeHead(404);
          response.end();

          return;
        }

        const route = new URL(request.url ?? '/', 'http://localhost').pathname;

        if (route === '/health/live') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end('{"status":"LIVE"}');

          return;
        }
        if (route === '/health/ready') {
          let expiry: ReturnType<typeof setTimeout> | undefined;
          let ready = false;

          try {
            ready =
              await Promise.race(
                [
                  Promise.all(
                    [
                      callbacks.ready(),
                      ...(settings.dependencies ?? []).map(
                        async (url) => {
                          try {
                            return (await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(1500) })).ok;
                          } catch {
                            return false;
                          }
                        },
                      ),
                    ],
                  ).then(
                    values => values.every(Boolean),
                  ),
                  new Promise<boolean>(
                    resolve => {
                      expiry = setTimeout(() => resolve(false), 2000);
                    },
                  ),
                ],
              );
          } catch {
            ready = false;
          } finally {
            if (expiry) {
              clearTimeout(expiry);
            }
          }
          response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ status: ready ? 'READY' : 'NOT_READY' }));

          return;
        }
        if (route === '/metrics') {
          const supplied = createHash('sha256').update(request.headers.authorization ?? '').digest();

          if (!timingSafeEqual(expected, supplied)) {
            response.writeHead(401);
            response.end();

            return;
          }

          const metrics = await callbacks.metrics();

          if (Buffer.byteLength(metrics) > 1048576) {
            response.writeHead(503);
            response.end();

            return;
          }
          response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
          response.end(metrics);

          return;
        }
        response.writeHead(404);
        response.end();
      })().catch(
        () => {
          if (!response.headersSent) {
            response.writeHead(503);
          }
          response.end();
        },
      );
    },
  );

  server.headersTimeout = 5000;
  server.requestTimeout = 5000;
  await new Promise<void>(
    (resolve, reject) => {
      server.once('error', reject);
      server.listen(settings.port, settings.host, resolve);
    },
  );

  return {
    close: async () => {
      server.closeIdleConnections();
      await new Promise<void>(
        (resolve, reject) => server.close(error => error ? reject(error) : resolve()),
      );
    },
  };
}

export async function runProcess(start: () => Promise<IProcessHandle>): Promise<void> {
  try {
    const handle = await start();
    let closing = false;
    const stop = (): void => {
      if (closing) {
        return;
      }
      closing = true;
      void handle.close().catch(
        error => {
          console.error(JSON.stringify({ code: failureCode(error), stage: 'shutdown' }));
          process.exitCode = 1;
        },
      );
    };

    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          code: failureCode(error),
          stage: 'bootstrap',
          errorType: error instanceof Error ? error.name : 'unknown',
          frames: error instanceof Error ? error.stack?.split('\n').slice(1, 5) : [],
          ...(error instanceof Error && error.message.startsWith('Invalid process settings: ')
            ? { validation: error.message.slice(26) }
            : {}),
        },
      ),
    );
    process.exitCode = 1;
  }
}
