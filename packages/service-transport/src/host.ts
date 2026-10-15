import type { IncomingMessage, ServerResponse } from 'node:http';

import type { DynamicModule, INestApplication, INestMicroservice } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';

import { installHttpResponseLimits } from './http-limits.js';
import { GRAPHQL_LIMITS, GRPC_LIMITS, REST_LIMITS } from './transport-limits.js';
import { objectValue, strictJson } from './wire.js';

export interface IPrivateHostSettings {
  host: string;
  httpPort: number;
  grpcPort: number;
  protoPath: string;
  protobufPackage: string;
}

export interface IPrivateHost {
  http: INestApplication;
  grpc: INestMicroservice;
  close(): Promise<void>;
}

export function validatePrivateHost(settings: IPrivateHostSettings): void {
  if (!/^(127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|::1)$/.test(
    settings.host,
  )
    || !settings.protoPath
    || !settings.protobufPackage
    || ![settings.httpPort, settings.grpcPort].every(
      port => Number.isInteger(port) && port >= 0 && port <= 65535,
    )
    || settings.httpPort !== 0 && settings.httpPort === settings.grpcPort) {
    throw new Error('Explicit private transport bindings required');
  }
}

export async function startPrivateHost(module: DynamicModule, settings: IPrivateHostSettings): Promise<IPrivateHost> {
  validatePrivateHost(settings);
  const http = await NestFactory.create(module, { logger: false, bodyParser: false });

  installHttpResponseLimits(http);
  http.use(
    (request: IncomingMessage & { body?: unknown }, response: ServerResponse, next: () => void): void => {
      if (!['POST', 'PUT', 'PATCH'].includes(request.method ?? '')) {
        next();

        return;
      }
      if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type'] ?? ''))) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end('{"code":"INVALID_INPUT"}');

        return;
      }

      const maximumBytes = new URL(request.url ?? '/', 'http://localhost').pathname === '/internal/graphql'
        ? GRAPHQL_LIMITS.requestBytes
        : REST_LIMITS.requestBytes;
      const chunks: Buffer[] = [];
      let length = 0;
      let rejected = false;

      request.on(
        'data',
        (chunk: Buffer) => {
          length += chunk.length;

          if (length > maximumBytes) {
            rejected = true;
            chunks.length = 0;
          } else if (!rejected) {
            chunks.push(chunk);
          }
        },
      );
      request.on(
        'end',
        () => {
          try {
            if (rejected) {
              throw new Error('Body too large');
            }
            request.body =
              objectValue(
                strictJson(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))),
              );
            next();
          } catch {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end('{"code":"INVALID_INPUT"}');
          }
        },
      );
      request.on(
        'error',
        () => {
          if (!response.writableEnded) {
            response.end();
          }
        },
      );
    },
  );
  const grpc = await NestFactory.createMicroservice(
    module,
    {
      logger: false,
      transport: Transport.GRPC,
      options: {
        url: `${settings.host.includes(':') ? '[' + settings.host + ']' : settings.host}:${settings.grpcPort}`,
        package: settings.protobufPackage,
        protoPath: settings.protoPath,
        loader: {
          longs: String,
          enums: String,
          defaults: false,
          arrays: true,
          objects: false,
          keepCase: false,
        },
        maxReceiveMessageLength: GRPC_LIMITS.requestBytes,
        maxSendMessageLength: GRPC_LIMITS.responseBytes,
      },
    },
  );

  try {
    await grpc.listen();
    await http.listen(settings.httpPort, settings.host);

    return {
      http,
      grpc,
      close: async () => {
        await Promise.allSettled([http.close(), grpc.close()]);
      },
    };
  } catch (error) {
    await Promise.allSettled([http.close(), grpc.close()]);
    throw error;
  }
}
