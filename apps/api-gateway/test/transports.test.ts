import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ServiceProtocol } from '@sportsbook/service-transport';

import * as M from '../src/domain/gateway.model.js';
import { contractEnvironment, contractGateway, publicContractSuite, publicHeaders } from './transports.fixture.js';

for (const protocol of Object.values(ServiceProtocol)) {
  test(
    'public REST contract through ' + protocol + ' clients',
    async () => {
      const env = await contractEnvironment();

      try {
        const gateway = await contractGateway(env, protocol);

        try {
          await publicContractSuite(env, gateway.base);
        } finally {
          await gateway.close();
        }
      } finally {
        await env.close();
      }
    },
  );
}

for (const protocol of Object.values(ServiceProtocol)) {
  test(
    'page 200, complete journals and separate response byte limits through ' + protocol,
    async () => {
      const env = await contractEnvironment();
      const f = env.fixture;
      const journals: M.IJournalView[] = Array.from(
        { length: 200 },
        () => {
          const transactionId = f.id();

          return {
            transactionId,
            requestId: f.id(),
            transactionType: M.TransactionType.DEPOSIT,
            businessRef: f.wallet.walletId,
            currency: 'USD',
            status: M.JournalStatus.POSTED,
            postedAt: f.now,
            entries: [M.Side.DEBIT, M.Side.CREDIT].map(
              (side, index) =>
                ({
                  entryId: f.id(),
                  accountId: f.id(),
                  transactionId,
                  entryNo: index + 1,
                  side,
                  amountMinor: 9007199254740993n,
                  currency: 'USD',
                  postedAt: f.now,
                }),
            ),
          };
        },
      );
      let reads = 0;

      f.clients.walletQuery.listTransactions =
        async () => {
          reads++;

          return { ok: true, value: { transactions: journals, observedAt: f.now } };
        };
      const gateway = await contractGateway(env, protocol);

      try {
        const headers = publicHeaders(env);
        const response = await fetch(gateway.base + '/v1/wallet/transactions?currency=USD&limit=200', { headers });
        const text = await response.text();

        assert.equal(response.status, 200, text.slice(0, 1000));
        assert.ok(Buffer.byteLength(text) > 65536);
        assert.ok(Buffer.byteLength(text) < 1048576);
        const parsed: unknown = JSON.parse(text);

        assert.ok(
          parsed && typeof parsed === 'object' && 'transactions' in parsed
          && Array.isArray(parsed.transactions),
        );
        assert.equal(parsed.transactions.length, 200);
        assert.equal(reads, 1, 'One public page must not split into hidden subrequests');
        assert.equal(
          parsed.transactions.flatMap(
            (item: unknown) =>
              item && typeof item === 'object' && 'entries' in item && Array.isArray(item.entries)
                ? item.entries
                : [],
          ).length,
          400,
        );
        f.profile.firstName = 'x'.repeat(1048576);
        const oversized = await fetch(gateway.base + '/v1/me/profile', { headers });

        assert.equal(oversized.status, 429);
        assert.match(await oversized.text(), /OVERLOADED/);
        const mutation = await fetch(
          gateway.base + '/v1/me/profile',
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ request_id: f.id(), expected_version: '1', patch: { locale: 'en-US' } }),
          },
        );

        assert.equal(mutation.status, 429);
        assert.match(await mutation.text(), /"outcome_unknown":true/);
      } finally {
        await gateway.close();
        await env.close();
      }
    },
  );
}

test(
  'public REST rejects forged identity, invalid wire fields, duplicate JSON, unsafe money and private surfaces',
  async () => {
    const env = await contractEnvironment();
    const gateway = await contractGateway(env, ServiceProtocol.GRPC);

    try {
      const f = env.fixture;
      const headers = publicHeaders(env);
      const { context: _context, ...place } = f.place;

      void _context;
      const valid = {
        request_id: place.requestId,
        type: 'SINGLE',
        stake: { amount_minor: '9007199254740993', currency: 'USD' },
        selection: {
          event_id: f.event.eventId,
          market_id: f.bet.legs[0]?.marketId,
          selection_id: f.bet.legs[0]?.selectionId,
          quote_id: f.bet.legs[0]?.quote?.quoteId,
          quote_version: '1',
        },
      };

      for (const body of [
        { ...valid, operator_id: f.id() },
        { ...valid, player_id: f.id() },
        { ...valid, context: {} },
        { ...valid, stake: { amount_minor: 123, currency: 'USD' } },
        { ...valid, requestId: f.id() },
      ]) {
        const response =
          await fetch(
            gateway.base
            + '/v1/bets',
            {
              method:
                'POST',
              headers,
              body:
                JSON.stringify(
                  body,
                ),
            },
          );

        assert.equal(response.status, 400);
      }
      assert.equal((await fetch(gateway.base + '/v1/me/profile')).status, 401);
      assert.equal(
        (await fetch(
          gateway.base + '/v1/bets',
          { method: 'POST', headers, body: '{"request_id":"x","request_id":"y"}' },
        )).status,
        400,
      );
      assert.equal(
        (await fetch(
          gateway.base + '/v1/bets',
          { method: 'POST', headers, body: JSON.stringify({ padding: 'x'.repeat(65536) }) },
        )).status,
        400,
      );
      assert.equal((await fetch(gateway.base + '/v1/bets?limit=1e2', { headers })).status, 400);
      assert.equal(
        (await fetch(gateway.base + '/v1/bets?player_id=' + f.id(), { headers })).status,
        400,
      );
      const unsigned = { ...headers, authorization: headers.authorization + 'x' };

      assert.equal((await fetch(gateway.base + '/v1/me/profile', { headers: unsigned })).status, 401);
      assert.equal(f.calls.some(c => c.method === 'bets.place'), false);
    } finally {
      await gateway.close();
      await env.close();
    }
  },
);
