import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ServiceError } from '@grpc/grpc-js';
import { credentials, Metadata, Server, ServerCredentials, status } from '@grpc/grpc-js';
import type { ExchangeResponse, ProbeServiceServer } from '@sportsbook/contract-spike-client';
import { ExchangeRequest, ProbeServiceClient, ProbeServiceService, ProbeStatus } from '@sportsbook/contract-spike-client';

import type { ProbeServiceController } from '../generated/sportsbook/tooling/v1/probe.js';
import { ProbeServiceControllerMethods } from '../generated/sportsbook/tooling/v1/probe.js';

@ProbeServiceControllerMethods()
class ProbeController implements ProbeServiceController {
  exchange(request: ExchangeRequest, metadata?: Metadata): ExchangeResponse {
    assert.equal(metadata?.get('operator-id')[0], 'test-operator');

    return { amountMinor: request.amountMinor, version: request.version, status: request.status };
  }
}

test('binary and JSON preserve signed/unsigned 64-bit boundaries and optional presence', () => {
  for (const amountMinor of [-(2n ** 63n), 0n, 9007199254740993n, 2n ** 63n - 1n]) {
    const value = ExchangeRequest.fromPartial({ amountMinor, version: 2n ** 64n - 1n, currency: 'USD', status: ProbeStatus.PROBE_STATUS_ACCEPTED });
    const decoded = ExchangeRequest.decode(ExchangeRequest.encode(value).finish());

    assert.equal(decoded.amountMinor, amountMinor);
    assert.equal(decoded.version, value.version);
    assert.equal(decoded.reference, undefined);
    assert.equal(ExchangeRequest.fromJSON(ExchangeRequest.toJSON(value)).amountMinor, amountMinor);
  }

  const present = ExchangeRequest.fromPartial({ reference: '' });

  assert.equal(ExchangeRequest.decode(ExchangeRequest.encode(present).finish()).reference, '');
  assert.equal(ExchangeRequest.fromJSON({ status: 999 }).status, ProbeStatus.UNRECOGNIZED);
});

test('typed gRPC and Nest controller agree; metadata, business rejection and deadline survive transport', async () => {
  const controller = new ProbeController();
  const server = new Server();
  const implementation: ProbeServiceServer = {
    exchange: (call, callback) => {
      if (call.request.status !== ProbeStatus.PROBE_STATUS_ACCEPTED) {
        callback({ code: status.INVALID_ARGUMENT, details: 'UNKNOWN_ENUM' });

        return;
      }
      if (call.request.currency === 'WAIT') return;
      if (call.request.currency === 'REJECT') {
        callback({ code: status.FAILED_PRECONDITION, details: 'INSUFFICIENT_FUNDS' });

        return;
      }

      callback(null, controller.exchange(call.request, call.metadata));
    },
  };

  server.addService(ProbeServiceService, implementation);

  const port = await new Promise<number>((resolve, reject) => server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, boundPort) => error ? reject(error) : resolve(boundPort)));
  const client = new ProbeServiceClient(`127.0.0.1:${port}`, credentials.createInsecure());
  const metadata = new Metadata();

  metadata.set('operator-id', 'test-operator');

  const exchange = (currency: string, deadline: Date): Promise<ExchangeResponse> => new Promise((resolve, reject) => {
    client.exchange({ amountMinor: 9007199254740993n, version: 1n, currency, status: ProbeStatus.PROBE_STATUS_ACCEPTED }, metadata, { deadline }, (error, response) => error ? reject(error) : resolve(response));
  });

  try {
    const response = await exchange('USD', new Date(Date.now() + 5000));

    assert.equal(response.amountMinor, 9007199254740993n);
    await assert.rejects(exchange('REJECT', new Date(Date.now() + 5000)), (error: ServiceError) => error.code === status.FAILED_PRECONDITION && error.details === 'INSUFFICIENT_FUNDS');
    await assert.rejects(exchange('WAIT', new Date(Date.now() + 100)), (error: ServiceError) => error.code === status.DEADLINE_EXCEEDED);
  } finally {
    client.close();
    server.forceShutdown();
  }
});
