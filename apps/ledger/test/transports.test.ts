import 'reflect-metadata';

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import test from 'node:test';

import type { ServiceError } from '@grpc/grpc-js';
import { credentials, Metadata } from '@grpc/grpc-js';
import * as Wire from '@sportsbook/ledger-client';
import { jsonWire, objectValue, snake, strictJson } from '@sportsbook/service-transport';

import { protobufOutput } from '../src/adapters/inbound/grpc/ledger-wire.js';
import type { ICallContext } from '../src/domain/ledger.model.js';
import { ActorKind, Capability } from '../src/domain/ledger.model.js';
import { startLedgerTransports } from '../src/infra/ledger-transport.module.js';
import { transportFixture } from './transport.fixture.js';

enum Entry { REST = 'REST', GRPC = 'GRPC', GRAPHQL = 'GRAPHQL' }

const identity = {
  issuer: 'synthetic-tests',
  audience: 'ledger',
  key: 'synthetic-test-key-32-bytes-minimum',
  maximumDeadlineMs: 60000,
};

const graphql = {
  maximumBytes: 65536,
  maximumDepth: 8,
  maximumRootFields: 20,
  maximumSelectedFields: 1000,
  maximumResponseBytes: 1048576,
  introspection: false,
};

function bearer(claims: unknown): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');

  return 'Bearer ' + header + '.' + payload + '.'
    + createHmac('sha256', identity.key).update(header + '.' + payload).digest('base64url');
}

async function freePort(): Promise<number> {
  const server = createServer();

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  assert.ok(address && typeof address === 'object');
  const port = address.port;

  await new Promise<void>(
    (resolve, reject) => server.close(error => error ? reject(error) : resolve()),
  );

  return port;
}

test(
  'real REST, Nest gRPC and Federation produce identical journal effects and enforce identity/lossless money',
  async () => {
    const now = new Date().toISOString();
    const journals: unknown[] = [];

    for (const entry of Object.values(Entry)) {
      const f = transportFixture(now);
      const grpcPort = await freePort();
      const host = await startLedgerTransports(
        f.operations,
        identity,
        graphql,
        {
          host: '127.0.0.1',
          httpPort: 0,
          grpcPort,
          protoPath: path.resolve(
            import.meta.dirname,
            '../../../packages/contracts/proto/sportsbook/ledger/v1/ledger.proto',
          ),
          protobufPackage: 'sportsbook.ledger.v1',
        },
      );
      const base = (await host.http.getUrl()).replace('[::1]', '127.0.0.1');
      const client = new Wire.LedgerServiceClient('127.0.0.1:' + grpcPort, credentials.createInsecure());
      const token = bearer(
        {
          iss: identity.issuer,
          aud: identity.audience,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 120,
          ...f.system,
        },
      );
      const headers = {
        'authorization': token,
        'x-correlation-id': f.system.correlationId,
        'x-deadline-at': f.system.deadlineAt,
        'content-type': 'application/json',
      };
      const metadata = new Metadata();

      for (const [key, value] of Object.entries(headers)) {
        if (key !== 'content-type') {
          metadata.set(key, value);
        }
      }
      const context = protobufOutput(f.system, 'CallContext');
      const requestId = f.ids.derive(f.system.operatorId, f.playerId, 'fixture:create-wallet');
      const create = { requestId, playerId: f.playerId, currency: 'USD' };
      const graph = async (query: string, variables: unknown): Promise<Record<string, unknown>> =>
        objectValue(
          await (await fetch(
            base + '/internal/graphql',
            { method: 'POST', headers, body: JSON.stringify({ query, variables }) },
          )).json(),
        );

      try {
        let created: unknown;

        if (entry === Entry.REST) {
          created =
            await (await fetch(
              base + '/internal/v1/wallets',
              {
                method: 'POST',
                headers,
                body: JSON.stringify(
                  Object.fromEntries(Object.entries(create).map(([key, value]) => [snake(key), value])),
                ),
              },
            )).json();
        }
        if (entry === Entry.GRAPHQL) {
          const response = await graph(
            'mutation($input:LedgerLedgerCreateWalletInputInput!){createWallet(input:$input){wallet{walletId availableMinor} created}}',
            { input: create },
          );

          assert.equal(response.errors, undefined, JSON.stringify(response));
          created = objectValue(response.data).createWallet;
        }
        if (entry === Entry.GRPC) {
          created =
            await new Promise<unknown>(
              (resolve, reject) =>
                client.createWallet(
                  Wire.CreateWalletRequest.fromJSON({ ...create, context }),
                  metadata,
                  (error, response) =>
                    error ? reject(error) : resolve(objectValue(Wire.CreateWalletResponse.toJSON(response)).value),
                ),
            );
        }

        const wallet = objectValue(objectValue(created).wallet);
        const walletId = wallet.walletId ?? wallet.wallet_id;

        assert.equal(typeof walletId, 'string', JSON.stringify(created));
        const deposit = {
          requestId: f.ids.derive(f.system.operatorId, f.playerId, 'fixture:deposit'),
          walletId,
          amount: { amountMinor: '9007199254740993', currency: 'USD' },
          providerRef: 'synthetic:transport',
        };
        let deposited: unknown;

        if (entry === Entry.REST) {
          deposited =
            await (await fetch(
              base + '/internal/v1/wallets/' + walletId + '/deposits',
              { method: 'POST', headers, body: JSON.stringify(jsonWire(deposit, true)) },
            )).json();
        }
        if (entry === Entry.GRAPHQL) {
          const response = await graph(
            'mutation($input:LedgerLedgerDepositTestFundsInputInput!){depositTestFunds(input:$input){outcome{wallet{availableMinor} replayed}}}',
            { input: deposit },
          );

          assert.equal(response.errors, undefined, JSON.stringify(response));
          deposited = objectValue(response.data).depositTestFunds;
        }
        if (entry === Entry.GRPC) {
          deposited =
            await new Promise<unknown>(
              (resolve, reject) =>
                client.depositTestFunds(
                  Wire.DepositTestFundsRequest.fromJSON({ ...deposit, context }),
                  metadata,
                  (error, response) =>
                    error
                      ? reject(error)
                      : resolve(objectValue(Wire.DepositTestFundsResponse.toJSON(response)).value),
                ),
            );
        }

        const balance = objectValue(objectValue(objectValue(deposited).outcome).wallet);

        assert.equal(
          balance.availableMinor ?? balance.available_minor,
          '9007199254740993',
          JSON.stringify(deposited),
        );
        const replayed = await f.operations.depositTestFunds.execute(
          {
            context: f.system,
            ...deposit,
            walletId: String(walletId),
            amount: { amountMinor: 9007199254740993n, currency: 'USD' },
          },
        );

        assert.ok(replayed.ok);
        assert.equal(replayed.value.outcome.replayed, true);
        journals.push(jsonWire([...f.store.state.journals.values()]));
        const unauth = await fetch(
          base + '/internal/v1/wallets/' + walletId + '/balance',
          { headers: { ...headers, authorization: 'Bearer invalid' } },
        );

        assert.equal(unauth.status, 401);
        const forged = await fetch(
          base + '/internal/v1/wallets',
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...jsonObject(jsonWire(create, true)), operator_id: f.system.operatorId }),
          },
        );

        assert.equal(forged.status, 400);
        const duplicate = await fetch(
          base + '/internal/v1/wallets',
          { method: 'POST', headers, body: '{"currency":"USD","currency":"EUR"}' },
        );

        assert.equal(duplicate.status, 400);
        const numeric = await fetch(
          base + '/internal/v1/wallets/' + walletId + '/deposits',
          {
            method: 'POST',
            headers,
            body: JSON.stringify(
              {
                ...jsonObject(jsonWire(deposit, true)),
                amount: { amount_minor: 9007199254740992, currency: 'USD' },
              },
            ),
          },
        );

        assert.equal(numeric.status, 400);
        const introspection = await graph('{__schema{types{name}}}', {});

        assert.ok(Array.isArray(introspection.errors));
        const aliases = await graph(
          'query {'
          + Array.from(
            { length: 21 },
            (_, index) =>
              'a' + index + ': getBalance(input:{walletId:"' + walletId + '"}){wallet{walletId}}',
          ).join(
            ' ',
          )
          + '}',
          {},
        );

        assert.ok(Array.isArray(aliases.errors));
        const expiredMetadata = metadata.clone();

        expiredMetadata.set('x-deadline-at', '2000-01-01T00:00:00Z');
        const expired = await new Promise<ServiceError | null>(
          resolve =>
            client.getBalance(
              Wire.GetBalanceRequest.fromJSON({ context, walletId }),
              expiredMetadata,
              error => resolve(error),
            ),
        );

        assert.equal(expired?.code, 4);
        const playerToken = bearer(
          {
            iss: identity.issuer,
            aud: identity.audience,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 120,
            ...f.system,
            actorKind: ActorKind.PLAYER,
            actorId: f.playerId,
            playerId: f.playerId,
            capabilities: [Capability.READ_WALLET],
          },
        );
        const forbidden = await fetch(
          base + '/internal/v1/wallets',
          {
            method: 'POST',
            headers: { ...headers, authorization: playerToken },
            body: JSON.stringify(jsonWire(create, true)),
          },
        );

        assert.equal(forbidden.status, 403);
      } finally {
        client.close();
        await host.close();
      }
    }
    assert.deepEqual(journals[0], journals[1]);
    assert.deepEqual(journals[1], journals[2]);
  },
);

function jsonObject(value: unknown): Record<string, unknown> {
  return objectValue(strictJson(JSON.stringify(value)));
}

test(
  'all eighteen registered operations work through all three real entry points',
  async () => {
    const now = new Date().toISOString();

    for (const entry of Object.values(Entry)) {
      const f = transportFixture(now);
      const grpcPort = await freePort();
      const host = await startLedgerTransports(
        f.operations,
        identity,
        graphql,
        {
          host: '127.0.0.1',
          httpPort: 0,
          grpcPort,
          protoPath: path.resolve(
            import.meta.dirname,
            '../../../packages/contracts/proto/sportsbook/ledger/v1/ledger.proto',
          ),
          protobufPackage: 'sportsbook.ledger.v1',
        },
      );
      const base = await host.http.getUrl();
      const client = new Wire.LedgerServiceClient('127.0.0.1:' + grpcPort, credentials.createInsecure());
      const invoked = new Set<string>();
      const call =
        async (
          operation: string,
          input: Record<string, unknown>,
          actor: ICallContext = f.system,
        ): Promise<Record<string, unknown>> => {
          const token = bearer(
            {
              iss: identity.issuer,
              aud: identity.audience,
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 120,
              ...actor,
            },
          );
          const headers = {
            'authorization': token,
            'x-correlation-id': actor.correlationId,
            'x-deadline-at': actor.deadlineAt,
            'content-type': 'application/json',
          };
          const metadata = new Metadata();

          for (const [key, value] of Object.entries(headers)) {
            if (key !== 'content-type') {
              metadata.set(key, value);
            }
          }
          let output: unknown;

          switch (operation) {
            case 'CreateWallet':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.createWallet(
                        Wire.CreateWalletRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'CreateWalletRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(
                              error,
                            )
                            : resolve(
                              objectValue(
                                Wire.CreateWalletResponse.toJSON(
                                  response,
                                ),
                              ).value,
                            ),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'mutation($input:LedgerLedgerCreateWalletInputInput!){createWallet(input:$input){wallet{walletId} created}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).createWallet;
              } else {
                let route = '/internal/v1/wallets';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response =
                  await fetch(
                    base
                      + route,
                    {
                      method:
                          'POST',
                      headers,
                      body:
                          JSON.stringify(
                            jsonWire(
                              input,
                              true,
                            ),
                          ),
                    },
                  );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'GetBalance':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.getBalance(
                        Wire.GetBalanceRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'GetBalanceRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error ? reject(error) : resolve(objectValue(Wire.GetBalanceResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'query($input:LedgerLedgerGetBalanceInputInput!){getBalance(input:$input){wallet{walletId availableMinor reservedMinor withdrawalHoldMinor}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).getBalance;
              } else {
                let route = '/internal/v1/wallets/:wallet_id/balance';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response = await fetch(
                  base + route
                    + (Object.keys(body).length
                      ? '?'
                      + new URLSearchParams(
                        Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])),
                      )
                      : ''),
                  { method: 'GET', headers },
                );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'GetTransaction':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.getTransaction(
                        Wire.GetTransactionRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'GetTransactionRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(error)
                            : resolve(objectValue(Wire.GetTransactionResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'query($input:LedgerLedgerGetTransactionInputInput!){getTransaction(input:$input){transaction{transactionId entries{entryId}}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).getTransaction;
              } else {
                let route = '/internal/v1/transactions/:transaction_id';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response = await fetch(
                  base + route
                    + (Object.keys(body).length
                      ? '?'
                      + new URLSearchParams(
                        Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])),
                      )
                      : ''),
                  { method: 'GET', headers },
                );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'GetLedgerEntries':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.getLedgerEntries(
                        Wire.GetLedgerEntriesRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'GetLedgerEntriesRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(error)
                            : resolve(objectValue(Wire.GetLedgerEntriesResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'query($input:LedgerLedgerGetLedgerEntriesInputInput!){getLedgerEntries(input:$input){entries{entryId} observedAt}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).getLedgerEntries;
              } else {
                let route = '/internal/v1/wallets/:wallet_id/entries';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response = await fetch(
                  base + route
                    + (Object.keys(body).length
                      ? '?'
                      + new URLSearchParams(
                        Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])),
                      )
                      : ''),
                  { method: 'GET', headers },
                );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'GetWalletTransactions':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.getWalletTransactions(
                        Wire.GetWalletTransactionsRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'GetWalletTransactionsRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(error)
                            : resolve(objectValue(Wire.GetWalletTransactionsResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'query($input:LedgerLedgerGetWalletTransactionsInputInput!){getWalletTransactions(input:$input){transactions{transactionId} observedAt}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).getWalletTransactions;
              } else {
                let route = '/internal/v1/wallets/:wallet_id/transactions';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response = await fetch(
                  base + route
                    + (Object.keys(body).length
                      ? '?'
                      + new URLSearchParams(
                        Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])),
                      )
                      : ''),
                  { method: 'GET', headers },
                );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'GetBetFinancialStatus':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.getBetFinancialStatus(
                        Wire.GetBetFinancialStatusRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'GetBetFinancialStatusRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(error)
                            : resolve(objectValue(Wire.GetBetFinancialStatusResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'query($input:LedgerLedgerGetBetFinancialStatusInputInput!){getBetFinancialStatus(input:$input){reservation{betId state}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).getBetFinancialStatus;
              } else {
                let route = '/internal/v1/bets/:bet_id/financial-status';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response = await fetch(
                  base + route
                    + (Object.keys(body).length
                      ? '?'
                      + new URLSearchParams(
                        Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])),
                      )
                      : ''),
                  { method: 'GET', headers },
                );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'GetWithdrawal':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.getWithdrawal(
                        Wire.GetWithdrawalRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'GetWithdrawalRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(
                              error,
                            )
                            : resolve(
                              objectValue(
                                Wire.GetWithdrawalResponse.toJSON(
                                  response,
                                ),
                              ).value,
                            ),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'query($input:LedgerLedgerGetWithdrawalInputInput!){getWithdrawal(input:$input){withdrawal{withdrawalId state}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).getWithdrawal;
              } else {
                let route = '/internal/v1/withdrawals/:withdrawal_id';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response = await fetch(
                  base + route
                    + (Object.keys(body).length
                      ? '?'
                      + new URLSearchParams(
                        Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])),
                      )
                      : ''),
                  { method: 'GET', headers },
                );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'GetCommandOutcome':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.getCommandOutcome(
                        Wire.GetCommandOutcomeRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'GetCommandOutcomeRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(error)
                            : resolve(objectValue(Wire.GetCommandOutcomeResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'query($input:LedgerLedgerGetCommandOutcomeInputInput!){getCommandOutcome(input:$input){found operation result}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).getCommandOutcome;
              } else {
                let route = '/internal/v1/commands/:request_id';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response = await fetch(
                  base + route
                    + (Object.keys(body).length
                      ? '?'
                      + new URLSearchParams(
                        Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])),
                      )
                      : ''),
                  { method: 'GET', headers },
                );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'DepositTestFunds':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.depositTestFunds(
                        Wire.DepositTestFundsRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'DepositTestFundsRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(error)
                            : resolve(objectValue(Wire.DepositTestFundsResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'mutation($input:LedgerLedgerDepositTestFundsInputInput!){depositTestFunds(input:$input){outcome{requestId transactionId wallet{availableMinor} replayed}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).depositTestFunds;
              } else {
                let route = '/internal/v1/wallets/:wallet_id/deposits';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response =
                  await fetch(
                    base
                      + route,
                    {
                      method:
                          'POST',
                      headers,
                      body:
                          JSON.stringify(
                            jsonWire(
                              input,
                              true,
                            ),
                          ),
                    },
                  );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'RequestWithdrawal':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.requestWithdrawal(
                        Wire.RequestWithdrawalRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'RequestWithdrawalRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(error)
                            : resolve(objectValue(Wire.RequestWithdrawalResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'mutation($input:LedgerLedgerRequestWithdrawalInputInput!){requestWithdrawal(input:$input){withdrawal{withdrawalId state} outcome{transactionId}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).requestWithdrawal;
              } else {
                let route = '/internal/v1/wallets/:wallet_id/withdrawals';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response =
                  await fetch(
                    base
                      + route,
                    {
                      method:
                          'POST',
                      headers,
                      body:
                          JSON.stringify(
                            jsonWire(
                              input,
                              true,
                            ),
                          ),
                    },
                  );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'CompleteWithdrawal':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.completeWithdrawal(
                        Wire.CompleteWithdrawalRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'CompleteWithdrawalRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(error)
                            : resolve(objectValue(Wire.CompleteWithdrawalResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'mutation($input:LedgerLedgerCompleteWithdrawalInputInput!){completeWithdrawal(input:$input){withdrawal{withdrawalId state} outcome{transactionId}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).completeWithdrawal;
              } else {
                let route = '/internal/v1/withdrawals/:withdrawal_id/complete';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response =
                  await fetch(
                    base
                      + route,
                    {
                      method:
                          'POST',
                      headers,
                      body:
                          JSON.stringify(
                            jsonWire(
                              input,
                              true,
                            ),
                          ),
                    },
                  );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'RejectWithdrawal':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.rejectWithdrawal(
                        Wire.RejectWithdrawalRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'RejectWithdrawalRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(error)
                            : resolve(objectValue(Wire.RejectWithdrawalResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'mutation($input:LedgerLedgerRejectWithdrawalInputInput!){rejectWithdrawal(input:$input){withdrawal{withdrawalId state} outcome{transactionId}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).rejectWithdrawal;
              } else {
                let route = '/internal/v1/withdrawals/:withdrawal_id/reject';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response =
                  await fetch(
                    base
                      + route,
                    {
                      method:
                          'POST',
                      headers,
                      body:
                          JSON.stringify(
                            jsonWire(
                              input,
                              true,
                            ),
                          ),
                    },
                  );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'ReserveStake':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.reserveStake(
                        Wire.ReserveStakeRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'ReserveStakeRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(
                              error,
                            )
                            : resolve(
                              objectValue(
                                Wire.ReserveStakeResponse.toJSON(
                                  response,
                                ),
                              ).value,
                            ),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'mutation($input:LedgerLedgerReserveStakeInputInput!){reserveStake(input:$input){reservation{betId state} outcome{transactionId}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).reserveStake;
              } else {
                let route = '/internal/v1/bets/:bet_id/reservations';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response =
                  await fetch(
                    base
                      + route,
                    {
                      method:
                          'POST',
                      headers,
                      body:
                          JSON.stringify(
                            jsonWire(
                              input,
                              true,
                            ),
                          ),
                    },
                  );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'SettleWin':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.settleWin(
                        Wire.SettleWinRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'SettleWinRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error ? reject(error) : resolve(objectValue(Wire.SettleWinResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'mutation($input:LedgerLedgerSettleWinInputInput!){settleWin(input:$input){reservation{betId state} outcome{transactionId}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).settleWin;
              } else {
                let route = '/internal/v1/bets/:bet_id/settlements/win';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response =
                  await fetch(
                    base
                      + route,
                    {
                      method:
                          'POST',
                      headers,
                      body:
                          JSON.stringify(
                            jsonWire(
                              input,
                              true,
                            ),
                          ),
                    },
                  );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'SettleLoss':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.settleLoss(
                        Wire.SettleLossRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'SettleLossRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error ? reject(error) : resolve(objectValue(Wire.SettleLossResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'mutation($input:LedgerLedgerSettleLossInputInput!){settleLoss(input:$input){reservation{betId state} outcome{transactionId}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).settleLoss;
              } else {
                let route = '/internal/v1/bets/:bet_id/settlements/loss';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response =
                  await fetch(
                    base
                      + route,
                    {
                      method:
                          'POST',
                      headers,
                      body:
                          JSON.stringify(
                            jsonWire(
                              input,
                              true,
                            ),
                          ),
                    },
                  );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'CancelBet':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.cancelBet(
                        Wire.CancelBetRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'CancelBetRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error ? reject(error) : resolve(objectValue(Wire.CancelBetResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'mutation($input:LedgerLedgerCancelBetInputInput!){cancelStakeReservation(input:$input){reservation{betId state} outcome{transactionId}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).cancelStakeReservation;
              } else {
                let route = '/internal/v1/bets/:bet_id/reservation-cancellations';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response =
                  await fetch(
                    base
                      + route,
                    {
                      method:
                          'POST',
                      headers,
                      body:
                          JSON.stringify(
                            jsonWire(
                              input,
                              true,
                            ),
                          ),
                    },
                  );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'ReconcileLedger':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.reconcileLedger(
                        Wire.ReconcileLedgerRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'ReconcileLedgerRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error
                            ? reject(error)
                            : resolve(objectValue(Wire.ReconcileLedgerResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'mutation($input:LedgerLedgerReconcileLedgerInputInput!){reconcileLedger(input:$input){report{status counts{violations}}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).reconcileLedger;
              } else {
                let route = '/internal/v1/reconciliation-runs';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response =
                  await fetch(
                    base
                      + route,
                    {
                      method:
                          'POST',
                      headers,
                      body:
                          JSON.stringify(
                            jsonWire(
                              input,
                              true,
                            ),
                          ),
                    },
                  );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            case 'GetWallet':
            {
              if (entry === Entry.GRPC) {
                output =
                  await new Promise<unknown>(
                    (resolve, reject) =>
                      client.getWallet(
                        Wire.GetWalletRequest.fromJSON(
                          protobufOutput({ ...input, context: actor }, 'GetWalletRequest'),
                        ),
                        metadata,
                        (error, response) =>
                          error ? reject(error) : resolve(objectValue(Wire.GetWalletResponse.toJSON(response)).value),
                      ),
                  );
              } else if (entry === Entry.GRAPHQL) {
                const response =
                  objectValue(
                    await (await fetch(
                      base + '/internal/graphql',
                      {
                        method: 'POST',
                        headers,
                        body:
                            JSON.stringify(
                              {
                                query:
                                  'query($input:LedgerLedgerGetWalletInputInput!){getWallet(input:$input){wallet{walletId}}}',
                                variables: { input },
                              },
                            ),
                      },
                    )).json(),
                  );

                assert.equal(response.errors, undefined, JSON.stringify(response));
                output = objectValue(response.data).getWallet;
              } else {
                let route = '/internal/v1/players/:player_id/wallets/:currency';
                const body = objectValue(jsonWire(input, true));

                for (const [name, value] of Object.entries(body)) {
                  if (route.includes(':' + name)) {
                    route = route.replace(':' + name, encodeURIComponent(String(value)));
                    delete body[name];
                  }
                }
                const page = body.page;

                delete body.page;

                if (page !== undefined) {
                  Object.assign(body, objectValue(page));
                }

                const response = await fetch(
                  base + route
                    + (Object.keys(body).length
                      ? '?'
                      + new URLSearchParams(
                        Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])),
                      )
                      : ''),
                  { method: 'GET', headers },
                );

                output = await response.json();
                assert.ok(response.ok, JSON.stringify(output));
              }
              break;
            }
            default: throw new Error('Unregistered operation');
          }
          invoked.add(operation);

          return objectValue(camelOutput(output));
        };

      try {
        let sequence = 0;
        const requestId = (): string => f.ids.derive(f.system.operatorId, f.playerId, 'fixture:all:' + ++sequence);
        const created = await call('CreateWallet', { requestId: requestId(), playerId: f.playerId, currency: 'USD' });
        const walletId = objectValue(created.wallet).walletId;
        const deposited = await call(
          'DepositTestFunds',
          {
            requestId: requestId(),
            walletId,
            amount: { amountMinor: '10000', currency: 'USD' },
            providerRef: 'synthetic:all',
          },
        );
        const betId = requestId();
        const reserved = await call(
          'ReserveStake',
          { requestId: requestId(), walletId, betId, stake: { amountMinor: '2000', currency: 'USD' } },
          f.betting,
        );

        await call('GetBetFinancialStatus', { betId });
        await call(
          'SettleWin',
          {
            requestId: requestId(),
            betId,
            settlementSeq: '1',
            grossPayout: { amountMinor: '5000', currency: 'USD' },
          },
          f.betting,
        );
        await call('GetWallet', { playerId: f.playerId, currency: 'USD' });
        await call('GetBalance', { walletId });
        await call('GetTransaction', { transactionId: objectValue(reserved.outcome).transactionId });
        await call('GetLedgerEntries', { walletId, page: { limit: 2 } });
        await call('GetWalletTransactions', { walletId, page: { limit: 2 } });
        const saved = await call('GetCommandOutcome', { requestId: objectValue(deposited.outcome).requestId });

        assert.equal(saved.found, true);
        assert.ok(saved.result);
        const withdrawalId = requestId();

        await call(
          'RequestWithdrawal',
          {
            requestId: requestId(),
            walletId,
            withdrawalId,
            amount: { amountMinor: '1000', currency: 'USD' },
          },
          f.player,
        );
        await call('GetWithdrawal', { withdrawalId });
        await call(
          'CompleteWithdrawal',
          { requestId: requestId(), withdrawalId, providerRef: 'synthetic:paid' },
        );
        const rejected = requestId();

        await call(
          'RequestWithdrawal',
          {
            requestId: requestId(),
            walletId,
            withdrawalId: rejected,
            amount: { amountMinor: '1000', currency: 'USD' },
          },
          f.player,
        );
        await call(
          'RejectWithdrawal',
          { requestId: requestId(), withdrawalId: rejected, reasonCode: 'PAYMENT_REJECTED' },
        );

        for (const terminal of ['SettleLoss', 'CancelBet']) {
          const id = requestId();

          await call(
            'ReserveStake',
            { requestId: requestId(), walletId, betId: id, stake: { amountMinor: '100', currency: 'USD' } },
            f.betting,
          );
          await call(
            terminal,
            {
              requestId: requestId(),
              betId: id,
              ...(terminal === 'SettleLoss' ? { settlementSeq: '1' } : { reasonCode: 'VOID' }),
            },
            f.betting,
          );
        }
        await call(
          'ReconcileLedger',
          { requestId: requestId(), runId: requestId(), cutoff: now, page: { limit: 10 } },
        );
        assert.equal(invoked.size, 18);
      } finally {
        client.close();
        await host.close();
      }
    }
  },
);

function camelOutput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(camelOutput);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(
        ([key, item]) =>
          [key.replace(/_([a-z])/g, (_match, c: string) => c.toUpperCase()), camelOutput(item)],
      ),
    );
  }

  return value;
}
