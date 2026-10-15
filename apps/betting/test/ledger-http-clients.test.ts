import 'reflect-metadata';

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import { ServiceProtocol } from '@sportsbook/service-transport';

import { GetWalletUseCase } from '../../ledger/src/app/use-cases/get-wallet.use-case.js';
import * as L from '../../ledger/src/domain/ledger.model.js';
import { startLedgerTransports } from '../../ledger/src/infra/ledger-transport.module.js';
import { transportFixture } from '../../ledger/test/transport.fixture.js';
import { LedgerHttpClient } from '../src/adapters/outbound/clients/http-service.clients.js';
import * as B from '../src/domain/betting.model.js';

for (const protocol of [ServiceProtocol.REST, ServiceProtocol.GRAPHQL]) {
  test(
    'Betting Ledger client executes reserve, replay and all terminal results through ' + protocol,
    async () => {
      const now = new Date().toISOString();
      const f = transportFixture(now);
      const caps = [...f.betting.capabilities, L.Capability.READ_WALLET];
      const policies: L.IOperatorFinancialPolicy[] = [
        {
          operatorId: f.system.operatorId,
          currencies: [{ currency: 'USD', minimumMinor: 1n, maximumMinor: 9223372036854775807n }],
          providerNames: ['synthetic'],
          rejectionReasons: ['PAYMENT_REJECTED'],
          trustedActors: [{ ...f.system, providerName: 'synthetic' }, { ...f.betting, capabilities: caps }],
        },
      ];
      const clock = { now: () => new Date().toISOString() };
      const created = await f.operations.createWallet.execute(
        {
          context: f.system,
          requestId: f.ids.derive(f.system.operatorId, f.playerId, 'create'),
          playerId: f.playerId,
          currency: 'USD',
        },
      );

      assert.ok(created.ok);
      assert.ok(
        (await f.operations.depositTestFunds.execute(
          {
            context: f.system,
            requestId: f.ids.derive(f.system.operatorId, f.playerId, 'fund'),
            walletId: created.value.wallet.walletId,
            amount: { amountMinor: 30000000000000000n, currency: 'USD' },
            providerRef: 'synthetic:http-client',
          },
        )).ok,
      );
      const identity = {
        issuer: 'private-test',
        audience: 'private-test',
        key: 's'.repeat(32),
        maximumDeadlineMs: 60000,
      };
      const server = await startLedgerTransports(
        {
          ...f.operations,
          getWallet: new GetWalletUseCase({ queries: f.store, reconciliation: f.store, clock, policies }),
        },
        identity,
        {
          maximumBytes: 65536,
          maximumResponseBytes: 1048576,
          maximumDepth: 8,
          maximumRootFields: 20,
          maximumSelectedFields: 1000,
          introspection: false,
        },
        {
          host: '127.0.0.1',
          httpPort: 0,
          grpcPort: 0,
          protoPath: path.resolve(
            import.meta.dirname,
            '../../../packages/contracts/proto/sportsbook/ledger/v1/ledger.proto',
          ),
          protobufPackage: 'sportsbook.ledger.v1',
        },
      );
      const client = new LedgerHttpClient(
        {
          ...identity,
          protocol,
          endpoint: await server.http.getUrl() + (protocol === ServiceProtocol.GRAPHQL ? '/internal/graphql' : ''),
          tls: false,
          actorId: f.betting.actorId,
          operators: [f.system.operatorId],
          capabilities: caps,
          timeoutMs: 5000,
        },
        clock,
      );
      const context: B.ICallContext = {
        operatorId: f.system.operatorId,
        actorId: f.playerId,
        actorKind: B.ActorKind.PLAYER,
        playerId: f.playerId,
        capabilities: [B.Capability.PLACE_BET],
        correlationId: f.system.correlationId,
        deadlineAt: new Date(Date.now() + 60000).toISOString(),
      };
      const id = (purpose: string): string => f.ids.derive(f.system.operatorId, f.playerId, purpose);

      try {
        for (const terminal of ['cancel', 'win', 'loss']) {
          const betId = id(terminal);
          const request = id(terminal + ':reserve');
          const stake = { amountMinor: 9007199254740993n, currency: 'USD' };
          const reserve = await client.reserve(context, request, betId, f.playerId, stake);

          assert.equal(reserve.reservation.stake.amountMinor, stake.amountMinor);
          assert.equal(
            (await client.reserve(context, request, betId, f.playerId, stake)).outcome.replayed,
            true,
          );

          if (terminal === 'cancel') {
            await client.cancel(context, id(terminal + ':terminal'), betId, B.CancellationReason.CANCELED);
          } else if (terminal === 'win') {
            await client.settleWin(
              context,
              id(terminal + ':terminal'),
              betId,
              1n,
              { amountMinor: 10000000000000000n, currency: 'USD' },
            );
          } else {
            await client.settleLoss(context, id(terminal + ':terminal'), betId, 1n);
          }
          assert.equal(
            (await client.getStatus(context, betId)).reservation?.state,
            terminal === 'cancel' ? 'CANCELED' : terminal === 'win' ? 'WON' : 'LOST',
          );
        }
        assert.equal(f.store.state.journals.size, 7);
      } finally {
        client.close();
        await server.close();
      }
    },
  );
}
