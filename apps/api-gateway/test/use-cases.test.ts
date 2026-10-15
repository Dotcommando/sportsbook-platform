import assert from 'node:assert/strict';
import {test} from 'node:test';

import * as M from '../src/domain/gateway.model.js';
import {createGatewayApplication} from '../src/infra/gateway-application.factory.js';
import {gatewayFixture} from './gateway.fixture.js';

function value<T>(result:M.IResult<T>):T {assert.ok(result.ok, result.ok ? '' : JSON.stringify(result.error));

return result.value;}

test('all eighteen Gateway operations use the approved capability ports, trusted owner and original keys', async()=>{
  const f = gatewayFixture();const o = f.operations;const context = f.context;const requestId = f.id();

  value(await o.registerPlayer.execute({context:{...context, actorId:f.registrationActor, actorKind:M.ActorKind.SYSTEM}, requestId, locale:'en-US', timeZone:'UTC'}));
  value(await o.getMyProfile.execute({context}));value(await o.updateMyProfile.execute({context, requestId, expectedVersion:1n, patch:{firstName:'Synthetic'}}));
  value(await o.getMyEligibility.execute({context, capability:M.PlayerCapability.PLACE_BET}));value(await o.getMyBalance.execute({context, currency:'USD'}));
  value(await o.topUpTestWallet.execute({context, requestId, amount:{amountMinor:9007199254740993n, currency:'USD'}, providerRef:'synthetic:fund-1'}));
  const withdrawalInput = {context, requestId, amount:{amountMinor:101n, currency:'USD'}};
  const a = value(await o.requestMyWithdrawal.execute(withdrawalInput));const b = value(await o.requestMyWithdrawal.execute({...withdrawalInput, context:{...context, correlationId:f.id()}}));

assert.equal(a.withdrawal.withdrawalId, b.withdrawal.withdrawalId);
  value(await o.getMyWithdrawal.execute({context, withdrawalId:f.withdrawal.withdrawalId}));value(await o.getMyTransactions.execute({context, currency:'USD', page:{limit:50}}));
  value(await o.placeBet.execute(f.place));value(await o.getMyBet.execute({context, betId:f.bet.betId}));value(await o.getMyBetStatus.execute({context, betId:f.bet.betId}));value(await o.listMyBets.execute({context, page:{limit:50}}));value(await o.cancelMyBet.execute({context, requestId, betId:f.bet.betId, expectedVersion:1n}));
  value(await o.listEvents.execute({context, page:{limit:50}}));value(await o.getEvent.execute({context, eventId:f.event.eventId}));value(await o.listMarkets.execute({context, eventId:f.event.eventId}));
  const dashboard = value(await o.getMyDashboard.execute({context, currency:'USD', recentBetLimit:10}));

assert.equal(dashboard.wallet.availableMinor, 30000000000000000n);assert.deepEqual(Object.keys(dashboard.sectionObservedAt), ['profile', 'wallet', 'bets', 'events']);
  const placement = f.calls.find(x=>x.method === 'bets.place');

assert.ok(placement);assert.deepEqual(placement.input, {...f.place, playerId:context.playerId});
  assert.equal(f.calls.filter(x=>x.method === 'wallet.deposit').length, 1);assert.ok(f.calls.some(x=>x.method === 'ids.derive' && JSON.stringify(x.input).includes('WITHDRAWAL')));
  assert.equal(new Set(f.calls.filter(x=>x.method !== 'ids.derive').map(x=>x.method)).size, 17);
});

test('Gateway denies missing capability, forged owner, expired context, invalid amount/provider and malformed dependency before money effects', async()=>{
  const f = gatewayFixture();

  assert.equal((await f.operations.placeBet.execute({...f.place, context:{...f.context, capabilities:[]}})).ok, false);
  assert.equal((await f.operations.placeBet.execute({...f.place, context:{...f.context, playerId:f.id()}})).ok, false);
  assert.equal((await f.operations.placeBet.execute({...f.place, context:{...f.context, deadlineAt:f.now}})).ok, false);
  const money = {context:f.context, requestId:f.id(), amount:{amountMinor:0n, currency:'USD'}, providerRef:'synthetic:fund'};

  assert.equal((await f.operations.topUpTestWallet.execute(money)).ok, false);assert.equal((await f.operations.topUpTestWallet.execute({...money, amount:{amountMinor:1n, currency:'USD'}, providerRef:'foreign:fund'})).ok, false);assert.equal(f.calls.length, 0);
  f.eligibility.allowed = false;f.eligibility.reasonCode = M.EligibilityReason.CAPABILITY_RESTRICTED;
  assert.equal((await f.operations.requestMyWithdrawal.execute({context:f.context, requestId:f.id(), amount:{amountMinor:1n, currency:'USD'}})).ok, false);assert.equal(f.calls.some(x=>x.method === 'wallet.request'), false);
  f.wallet.playerId = f.id();const bad = await f.operations.getMyBalance.execute({context:f.context, currency:'USD'});

assert.ok(!bad.ok);assert.equal(bad.error.code, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  f.bet.playerId = f.id();assert.equal((await f.operations.getMyBet.execute({context:f.context, betId:f.bet.betId})).ok, false);
});

test('Dashboard starts all four independent reads together and fails when a required section fails', async()=>{
  const f = gatewayFixture();let started = 0;let release:()=>void = ()=>{};const barrier = new Promise<void>(resolve=>{release = resolve;});
  const gate = async<T>(work:()=>Promise<T>):Promise<T>=>{started++;

if (started === 4)release();await barrier;

return work();};
  const p = f.clients.playerQuery.getProfile, w = f.clients.walletQuery.getWallet, b = f.clients.betQuery.list, e = f.clients.eventCatalog.listEvents;

  f.clients.playerQuery.getProfile = input=>gate(()=>p(input));f.clients.walletQuery.getWallet = input=>gate(()=>w(input));f.clients.betQuery.list = input=>gate(()=>b(input));f.clients.eventCatalog.listEvents = input=>gate(()=>e(input));
  value(await f.operations.getMyDashboard.execute({context:f.context, currency:'USD', recentBetLimit:1}));assert.equal(started, 4);
  f.clients.eventCatalog.listEvents = async()=>({ok:false, error:{code:M.ErrorCode.DEPENDENCY_UNAVAILABLE, message:'DEPENDENCY_UNAVAILABLE', correlationId:f.context.correlationId, retryable:true, outcomeUnknown:false}});
  const failed = await f.operations.getMyDashboard.execute({context:f.context, currency:'USD', recentBetLimit:1});

assert.ok(!failed.ok);assert.equal(failed.error.code, M.ErrorCode.DEPENDENCY_UNAVAILABLE);
});

test('unknown financial result stays unknown and retries preserve request and withdrawal identity; policy is frozen at composition', async()=>{
  const f = gatewayFixture();const keys:string[] = [];

f.clients.walletCommand.requestWithdrawal = async input=>{keys.push(input.requestId + ':' + input.withdrawalId);throw new Error('Synthetic lost reply');};
  const input = {context:f.context, requestId:f.id(), amount:{amountMinor:101n, currency:'USD'}};

  for (let i = 0;i < 2;i++) {const result = await f.operations.requestMyWithdrawal.execute(input);

assert.ok(!result.ok);assert.equal(result.error.outcomeUnknown, true);}assert.equal(keys[0], keys[1]);
  const settings = f.settings[0];

assert.ok(settings);settings.currencies = ['EUR'];value(await f.operations.getMyBalance.execute({context:f.context, currency:'USD'}));
  assert.throws(()=>createGatewayApplication([], f.clock, f.ids, f.clients));
});
