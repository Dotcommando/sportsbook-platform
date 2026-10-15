import type {IGatewayPolicy} from '../../../../app/services/gateway-operation.service.js';
import {authorize, bet, checked, owner, profile, wallet} from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import {currency, failure, requireRule} from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type {BetQueryPort} from '../../../bets/ports/outbound/bets.port.js';
import type {EventCatalogPort} from '../../../events/ports/outbound/events.port.js';
import type {PlayerQueryPort} from '../../../players/ports/outbound/players.port.js';
import type {WalletQueryPort} from '../../../wallet/ports/outbound/wallet.port.js';
import type {GetMyDashboardPort} from '../../ports/inbound/dashboard-operations.port.js';

export class GetMyDashboardUseCase implements GetMyDashboardPort {constructor(private readonly policy:IGatewayPolicy, private readonly players:PlayerQueryPort, private readonly wallets:WalletQueryPort, private readonly bets:BetQueryPort, private readonly events:EventCatalogPort) {}

async execute(input:M.IGatewayGetMyDashboardInput):Promise<M.IResult<M.IGatewayGetMyDashboardOutput>> {try {const settings = authorize(this.policy, input.context, M.Capability.PROFILE_READ, true);

requireRule(Output.isIGatewayGetMyDashboardInput(input));currency(settings, input.currency);requireRule(input.recentBetLimit >= 1 && input.recentBetLimit <= 20);

for (const cap of [M.Capability.READ_WALLET, M.Capability.BET_READ, M.Capability.EVENT_READ])authorize(this.policy, input.context, cap);const run = async():Promise<M.IGatewayGetMyDashboardOutput>=>{const context = input.context;const playerId = owner(context);const [p, w, b, e] = await Promise.all([checked(this.players.getProfile({context, playerId}), Output.isIPlayerGetPlayerOutput).then(value=>({value, observedAt:this.policy.clock.now()})), checked(this.wallets.getWallet({context, playerId, currency:input.currency}), Output.isILedgerGetWalletOutput), checked(this.bets.list({context, playerId, page:{limit:input.recentBetLimit}}), Output.isIBettingListPlayerBetsOutput), checked(this.events.listEvents({context, page:{limit:50}}), Output.isIEventsListEventsOutput)]);

profile(context, p.value.profile);wallet(context, w.wallet, input.currency);requireRule(b.bets.length <= input.recentBetLimit, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

for (const item of b.bets)bet(context, item);

return {profile:p.value.profile, wallet:w.wallet, recentBets:b.bets, events:e.events, sectionObservedAt:{profile:p.observedAt, wallet:w.wallet.observedAt, bets:b.observedAt, events:e.observedAt}};};

return {ok:true, value:await run()};} catch(error) {return failure(error, input.context, false);}}}
