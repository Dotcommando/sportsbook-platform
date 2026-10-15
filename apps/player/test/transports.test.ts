import 'reflect-metadata';

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import test from 'node:test';

import { credentials, Metadata } from '@grpc/grpc-js';
import * as Wire from '@sportsbook/player-client';
import { objectValue } from '@sportsbook/service-transport';

import { protobufOutput } from '../src/adapters/inbound/grpc/player-wire.js';
import * as M from '../src/domain/player.model.js';
import { failure } from '../src/domain/player.policy.js';
import { startPlayerTransports } from '../src/infra/player-transport.module.js';
import type { IPlayerOperationPorts } from '../src/ports/inbound/player-application.port.js';

test(
  'Player real entry points preserve bigint/calendar dates and keep the entity schema minimal',
  async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const profile: M.IProfile = {
      playerId: id,
      status: M.PlayerStatus.REGISTERED,
      firstName: 'Synthetic',
      birthDate: '2000-02-29',
      locale: 'en-US',
      timeZone: 'Asia/Tokyo',
      version: 9007199254740993n,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    let calls = 0;
    const reject = async (): Promise<{ ok: false; error: M.IError }> =>
      failure(
        M.ErrorCode.NOT_FOUND,
        {
          operatorId: id,
          actorId: id,
          actorKind: M.ActorKind.SYSTEM,
          capabilities: [],
          correlationId: id,
          deadlineAt: profile.createdAt,
        },
      );
    const operations: IPlayerOperationPorts =
      {
        registerPlayer: {
          execute: async () => {
            calls++;

            return { ok: true, value: { profile, created: true } };
          },
        },
        getPlayer: { execute: async () => ({ ok: true, value: { profile, contacts: [] } }) },
        getPlayerReference:
      {
        execute:
          async () => ({
            ok:
              true,
            value:
            {
              operatorId:
                id,
              playerId:
                id,
              exists:
                true,
            },
          }),
      },
        updatePlayerProfile: { execute: reject },
        addContact: { execute: reject },
        verifyContact: { execute: reject },
        changePlayerStatus: { execute: reject },
        openKycCase: { execute: reject },
        recordKycCheck: { execute: reject },
        decideKycCase: { execute: reject },
        getKycStatus: { execute: reject },
        applyRestriction: { execute: reject },
        clearRestriction: { execute: reject },
        getRestrictions: { execute: reject },
        checkEligibility: { execute: reject },
        publishOutboxBatch: { execute: reject },
        runSyntheticKycCheck: { execute: reject },
      };
    const probe = createServer();

    await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
    const address = probe.address();

    assert.ok(address && typeof address === 'object');
    const grpcPort = address.port;

    await new Promise<void>(resolve => probe.close(() => resolve()));
    const identity = {
      issuer: 'synthetic',
      audience: 'player',
      key: 'test-key-at-least-thirty-two-bytes',
      maximumDeadlineMs: 60000,
    };
    const context: M.ICallContext = {
      operatorId: id,
      actorId: id,
      actorKind: M.ActorKind.SYSTEM,
      capabilities: Object.values(M.Capability),
      correlationId: id,
      deadlineAt: new Date(Date.now() + 60000).toISOString(),
    };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify(
        {
          iss: identity.issuer,
          aud: identity.audience,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 120,
          ...context,
        },
      ),
    ).toString(
      'base64url',
    );
    const authorization = 'Bearer ' + header + '.' + payload + '.'
      + createHmac('sha256', identity.key).update(header + '.' + payload).digest('base64url');
    const headers = {
      authorization,
      'x-correlation-id': id,
      'x-deadline-at': context.deadlineAt,
      'content-type': 'application/json',
    };
    const host = await startPlayerTransports(
      operations,
      identity,
      {
        maximumBytes: 65536,
        maximumDepth: 8,
        maximumRootFields: 20,
        maximumSelectedFields: 1000,
        maximumResponseBytes: 1048576,
        introspection: false,
      },
      {
        host: '127.0.0.1',
        httpPort: 0,
        grpcPort,
        protoPath: path.resolve(
          import.meta.dirname,
          '../../../packages/contracts/proto/sportsbook/player/v1/player.proto',
        ),
        protobufPackage: 'sportsbook.player.v1',
      },
    );
    const base = await host.http.getUrl();
    const client = new Wire.PlayerServiceClient('127.0.0.1:' + grpcPort, credentials.createInsecure());

    try {
      const response = await fetch(
        base + '/internal/v1/players',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ request_id: id, locale: 'en-US', time_zone: 'Asia/Tokyo' }),
        },
      );

      assert.equal(response.status, 201);
      const rest = objectValue(await response.json());
      const restProfile = objectValue(rest.profile);

      assert.equal(restProfile.version, '9007199254740993');
      assert.equal(restProfile.birth_date, '2000-02-29');
      const metadata = new Metadata();

      metadata.set('authorization', authorization);
      const grpc = await new Promise<unknown>(
        (resolve, reject) =>
          client.registerPlayer(
            Wire.RegisterPlayerRequest.fromJSON(
              protobufOutput(
                { context, requestId: id, locale: 'en-US', timeZone: 'Asia/Tokyo' },
                'RegisterPlayerRequest',
              ),
            ),
            metadata,
            (error, value) => error ? reject(error) : resolve(Wire.RegisterPlayerResponse.toJSON(value)),
          ),
      );
      const rpcProfile = objectValue(objectValue(objectValue(grpc).value).profile);

      assert.equal(rpcProfile.version, '9007199254740993');
      assert.equal(rpcProfile.birthDate, '2000-02-29');
      const gql =
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
                      'mutation($input:PlayerPlayerRegisterPlayerInputInput!){registerPlayer(input:$input){profile{playerId version birthDate} created}}',
                    variables: { input: { requestId: id, locale: 'en-US', timeZone: 'Asia/Tokyo' } },
                  },
                ),
            },
          )).json(),
        );

      assert.equal(gql.errors, undefined, JSON.stringify(gql));
      const graphProfile = objectValue(objectValue(objectValue(gql.data).registerPlayer).profile);

      assert.equal(graphProfile.version, '9007199254740993');
      assert.equal(graphProfile.birthDate, '2000-02-29');
      assert.equal(calls, 3);
      const entity =
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
                      'query($representations:[_Any!]!){_entities(representations:$representations){... on Player{operatorId playerId exists}}}',
                    variables: { representations: [{ __typename: 'Player', operatorId: id, playerId: id }] },
                  },
                ),
            },
          )).json(),
        );

      assert.equal(entity.errors, undefined, JSON.stringify(entity));
      const forbiddenField =
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
                      'query($representations:[_Any!]!){_entities(representations:$representations){... on Player{firstName}}}',
                    variables: { representations: [{ __typename: 'Player', operatorId: id, playerId: id }] },
                  },
                ),
            },
          )).json(),
        );

      assert.ok(Array.isArray(forbiddenField.errors));
      const invalidUtf8 = Buffer.concat(
        [
          Buffer.from('{"query":"{_service{sdl}}","variables":{"ignored":"'),
          Buffer.from([255]),
          Buffer.from('"}}'),
        ],
      );
      const invalidEncoding = await fetch(base + '/internal/graphql', { method: 'POST', headers, body: invalidUtf8 });

      assert.equal(invalidEncoding.status, 400);
      const forged = await fetch(
        base + '/internal/v1/players',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ request_id: id, locale: 'en-US', time_zone: 'Asia/Tokyo', operator_id: id }),
        },
      );

      assert.equal(forged.status, 400);
      assert.equal(calls, 3);
    } finally {
      client.close();
      await host.close();
    }
  },
);
