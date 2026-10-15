import { createServer, request as httpRequest } from 'node:http';

import type { ComposeRun } from './compose.js';
import { executeTool } from './tool.js';

export enum ReplyFault {
  NONE = 'NONE',
  DROP = 'DROP',
  DELAY = 'DELAY',
}

/** Test-only network fault. The upstream reply is drained before a committed reply is dropped. */
export async function startReplyFaultProxy(endpoint: string): Promise<{
  url: string;
  arm(fault: ReplyFault, delayMs?: number): void;
  close(): Promise<void>;
}> {
  const target = new URL(endpoint);

  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username
    || target.password) {
    throw new Error('Loopback test target required');
  }

  let armed = ReplyFault.NONE;
  let delay = 0;
  const controllers = new Set<AbortController>();
  const server = createServer(
    (incoming, outgoing) => {
      const fault = armed;
      const wait = delay;

      armed = ReplyFault.NONE;
      const controller = new AbortController();

      controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), 10000);
      const upstream = httpRequest(
        new URL(incoming.url ?? '/', target),
        { method: incoming.method, headers: incoming.headers, signal: controller.signal },
        response => {
          const chunks: Buffer[] = [];
          let size = 0;

          response.on(
            'data',
            (chunk: Buffer) => {
              size += chunk.length;

              if (size > 1048576) {
                controller.abort();
              } else {
                chunks.push(chunk);
              }
            },
          );
          response.on(
            'end',
            () => {
              if (fault === ReplyFault.DROP) {
                outgoing.destroy();

                return;
              }

              const reply = (): void => {
                if (!outgoing.destroyed) {
                  outgoing.writeHead(response.statusCode ?? 502, response.headers);
                  outgoing.end(Buffer.concat(chunks));
                }
              };

              if (fault === ReplyFault.DELAY) {
                const pending = setTimeout(reply, wait);

                pending.unref();
              } else {
                reply();
              }
            },
          );
        },
      );

      upstream.on('error', () => outgoing.destroy());
      outgoing.on(
        'close',
        () => {
          clearTimeout(timer);
          controller.abort();
          controllers.delete(controller);
        },
      );
      incoming.pipe(upstream);
    },
  );

  server.headersTimeout = 5000;
  server.requestTimeout = 10000;
  await new Promise<void>(
    (resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    },
  );
  const address = server.address();

  if (!address || typeof address !== 'object') {
    throw new Error('Fault proxy address missing');
  }

  return {
    url: 'http://127.0.0.1:' + address.port,
    arm: (fault, delayMs = 0) => {
      if (armed !== ReplyFault.NONE || !Object.values(ReplyFault).includes(fault)
        || !Number.isInteger(delayMs)
        || delayMs < 0
        || delayMs > 5000) {
        throw new Error('Invalid single-use reply fault');
      }
      armed = fault;
      delay = delayMs;
    },
    close: async () => {
      for (const controller of controllers) {
        controller.abort();
      }
      server.closeAllConnections();
      await new Promise<void>(
        (resolve, reject) => server.close(error => error ? reject(error) : resolve()),
      );
    },
  };
}

export class OwnedFailureControls {
  constructor(private readonly run: ComposeRun) { }

  private async verify(service: string): Promise<void> {
    if (![...this.run.services, 'nats'].includes(service)) {
      throw new Error('Unknown fault target');
    }

    const id = await this.run.command(['ps', '--all', '-q', service]);

    if (!/^[a-f0-9]{64}$/.test(id)) {
      throw new Error('Single owned fault target required');
    }

    const owner = await executeTool(
      'docker',
      ['inspect', '--format', '{{index .Config.Labels "sportsbook.run"}}', id],
      this.run.root,
    );

    if (owner !== this.run.manifest.runId) {
      throw new Error('Refusing fault outside owned run');
    }
  }

  async kill(service: string): Promise<void> {
    await this.verify(service);
    await this.run.command(['kill', '--signal', 'SIGKILL', service]);
  }

  async stopBroker(): Promise<void> {
    await this.verify('nats');
    await this.run.command(['stop', '--timeout', '1', 'nats']);
  }

  async restart(service: string): Promise<void> {
    await this.verify(service);
    await this.run.command(['up', '-d', service]);
  }
}
