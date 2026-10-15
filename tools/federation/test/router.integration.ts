import assert from 'node:assert/strict';

import { objectValue, ServiceIdentity, ServiceProtocol } from '@sportsbook/service-transport';

import {
  contractEnvironment,
  contractGateway,
  publicContractSuite,
  publicHeaders,
} from '../../../apps/api-gateway/test/transports.fixture.js';
import { dockerUrl, privateBindHost, startRouter } from './router.fixture.js';

assert.ok(privateBindHost, 'A private interface is required for isolated Docker integration');

const env = await contractEnvironment(privateBindHost);

let router: Awaited<ReturnType<typeof startRouter>> | undefined;

let gateway: Awaited<ReturnType<typeof contractGateway>> | undefined;

try {
  const urls: Record<string, string> = {};

  for (const [owner, host] of Object.entries(env.hosts)) {
    urls[owner] = dockerUrl(await host.http.getUrl() + '/internal/graphql');
  }
  router = await startRouter(urls, 'contracts');
  gateway = await contractGateway(env, ServiceProtocol.GRAPHQL, router.endpoint);
  await publicContractSuite(env, gateway.base);
  const f = env.fixture;
  const identity = new ServiceIdentity(
    {
      ...env.privateIdentity,
      actorId: env.serviceActor,
      operators: [f.context.operatorId],
      capabilities: ['READ_WALLET', 'BET_READ', 'EVENT_READ', 'READ_PLAYER_REFERENCE'],
      timeoutMs: 5000,
    },
    () => Date.parse(f.clock.now()),
  );
  const headers = { ...identity.headers(f.context), 'content-type': 'application/json' };
  const query =
    'query($bet:BettingBettingGetBetInputInput!,$wallet:LedgerLedgerGetWalletInputInput!){getBet(input:$bet){bet{betId player{operatorId playerId exists bets(limit:1){bets{betId}}} event{eventId homeTeam}}}getWallet(input:$wallet){wallet{walletId player{playerId exists}}}}';
  const variables = {
    bet: { betId: f.bet.betId, playerId: f.context.playerId },
    wallet: { playerId: f.context.playerId, currency: 'USD' },
  };
  const result =
    objectValue(
      await (await fetch(
        router.endpoint,
        {
          method:
            'POST',
          headers,
          body:
            JSON.stringify(
              {
                query,
                variables,
              },
            ),
        },
      )).json(),
    );

  assert.equal(result.errors, undefined, JSON.stringify(result));
  const data = objectValue(result.data);
  const bet = objectValue(objectValue(data.getBet).bet);

  assert.equal(objectValue(bet.player).exists, true);
  assert.equal(objectValue(bet.event).homeTeam, 'Home');
  assert.equal(objectValue(objectValue(objectValue(data.getWallet).wallet).player).exists, true);
  assert.ok(
    env.delegations.every(
      raw => {
        const context = objectValue(raw);

        return context.operatorId === f.context.operatorId
          && context.correlationId === f.context.correlationId
          && Date.parse(String(context.deadlineAt)) <= Date.parse(f.context.deadlineAt);
      },
    ),
  );
  const beforeAdmission = env.delegations.length;
  const excessiveRoots = '{'
    + Array.from(
      { length: 21 },
      (_value, index) => 'r' + index + ':listEvents(input:{page:{limit:1}}){observedAt}',
    ).join(
      ' ',
    )
    + '}';
  const rejected = objectValue(
    await (await fetch(
      router.endpoint,
      { method: 'POST', headers, body: JSON.stringify({ query: excessiveRoots }) },
    )).json(),
  );

  assert.ok(JSON.stringify(rejected).includes('INVALID_INPUT'), JSON.stringify(rejected));
  assert.equal(
    env.delegations.length,
    beforeAdmission,
    'Subgraph admission rejects excessive roots before business dispatch',
  );

  for (const badHeaders of [
    { ...headers, authorization: 'Bearer invalid' },
    { ...headers, 'x-deadline-at': '2000-01-01T00:00:00Z' },
    publicHeaders(env),
  ]) {
    const denied = objectValue(
      await (await fetch(
        router.endpoint,
        { method: 'POST', headers: badHeaders, body: JSON.stringify({ query, variables }) },
      )).json(),
    );

    assert.ok(Array.isArray(denied.errors) && denied.errors.length > 0, JSON.stringify(denied));
  }
  const entityQuery =
    'query($representations:[_Any!]!){_entities(representations:$representations){...on Player{playerId exists}}}';
  const playerUrl = await env.hosts.player?.http.getUrl();

  assert.ok(playerUrl);
  const foreign = objectValue(
    await (await fetch(
      playerUrl + '/internal/graphql',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(
          {
            query: entityQuery,
            variables: {
              representations: [{ __typename: 'Player', operatorId: f.id(), playerId: f.context.playerId }],
            },
          },
        ),
      },
    )).json(),
  );

  assert.ok(JSON.stringify(foreign).includes('NOT_FOUND'));
  await env.hosts.events?.close();
  delete env.hosts.events;
  const unavailable = await (await fetch(
    router.endpoint,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: '{listEvents(input:{page:{limit:1}}){observedAt}}' }),
    },
  )).json();

  assert.ok(JSON.stringify(unavailable).includes('SUBREQUEST_HTTP_ERROR'));
  const failed = await fetch(gateway.base + '/v1/dashboard?currency=USD', { headers: publicHeaders(env) });
  const failure = objectValue(await failed.json());

  assert.equal(failed.status, 503, JSON.stringify(failure));
  assert.equal(failure.code, 'DEPENDENCY_UNAVAILABLE');
  console.log(
    'Router: four live subgraphs, 18 REST routes, cross-owner entities, signed context, auth/deadline denial, required-section failure verified',
  );
} finally {
  await gateway?.close();
  router?.close();
  await env.close();
}
