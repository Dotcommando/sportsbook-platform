import type {IGatewayOperatorSettings} from '../domain/gateway.model.js';
import {ActorKind} from '../domain/gateway.model.js';
import {validUuid} from '../domain/gateway.policy.js';
import {CancelMyBetUseCase} from '../modules/bets/app/use-cases/cancel-my-bet.use-case.js';
import {GetMyBetUseCase} from '../modules/bets/app/use-cases/get-my-bet.use-case.js';
import {GetMyBetStatusUseCase} from '../modules/bets/app/use-cases/get-my-bet-status.use-case.js';
import {ListMyBetsUseCase} from '../modules/bets/app/use-cases/list-my-bets.use-case.js';
import {PlaceBetUseCase} from '../modules/bets/app/use-cases/place-bet.use-case.js';
import type {BetCommandPort, BetQueryPort} from '../modules/bets/ports/outbound/bets.port.js';
import {GetMyDashboardUseCase} from '../modules/dashboard/app/use-cases/get-my-dashboard.use-case.js';
import {GetEventUseCase} from '../modules/events/app/use-cases/get-event.use-case.js';
import {ListEventsUseCase} from '../modules/events/app/use-cases/list-events.use-case.js';
import {ListMarketsUseCase} from '../modules/events/app/use-cases/list-markets.use-case.js';
import type {EventCatalogPort} from '../modules/events/ports/outbound/events.port.js';
import {GetMyEligibilityUseCase} from '../modules/players/app/use-cases/get-my-eligibility.use-case.js';
import {GetMyProfileUseCase} from '../modules/players/app/use-cases/get-my-profile.use-case.js';
import {RegisterPlayerUseCase} from '../modules/players/app/use-cases/register-player.use-case.js';
import {UpdateMyProfileUseCase} from '../modules/players/app/use-cases/update-my-profile.use-case.js';
import type {PlayerCommandPort, PlayerQueryPort} from '../modules/players/ports/outbound/players.port.js';
import {GetMyBalanceUseCase} from '../modules/wallet/app/use-cases/get-my-balance.use-case.js';
import {GetMyTransactionsUseCase} from '../modules/wallet/app/use-cases/get-my-transactions.use-case.js';
import {GetMyWithdrawalUseCase} from '../modules/wallet/app/use-cases/get-my-withdrawal.use-case.js';
import {RequestMyWithdrawalUseCase} from '../modules/wallet/app/use-cases/request-my-withdrawal.use-case.js';
import {TopUpTestWalletUseCase} from '../modules/wallet/app/use-cases/top-up-test-wallet.use-case.js';
import type {WalletCommandPort, WalletQueryPort} from '../modules/wallet/ports/outbound/wallet.port.js';
import type {IGatewayOperationPorts} from '../ports/inbound/gateway-application.port.js';
import type {ClockPort, IdGeneratorPort} from '../ports/outbound/gateway.port.js';

export interface IGatewayClients {playerCommand:PlayerCommandPort;playerQuery:PlayerQueryPort;walletCommand:WalletCommandPort;walletQuery:WalletQueryPort;betCommand:BetCommandPort;betQuery:BetQueryPort;eventCatalog:EventCatalogPort;}

export function createGatewayApplication(settings:readonly IGatewayOperatorSettings[], clock:ClockPort, ids:IdGeneratorPort, clients:IGatewayClients):IGatewayOperationPorts {const operators = structuredClone(settings);

if (!operators.length || new Set(operators.map(x=>x.operatorId)).size !== operators.length) throw new Error('Explicit unique operators required');

for (const op of operators) {if (!validUuid(op.operatorId) || !op.currencies.length || new Set(op.currencies).size !== op.currencies.length || !op.currencies.every(c=>/^[A-Z]{3}$/.test(c)) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(op.syntheticProvider) || !op.trustedRegistrationActors.every(a=>validUuid(a.actorId) && [ActorKind.SYSTEM, ActorKind.SERVICE].includes(a.actorKind))) throw new Error('Invalid Gateway policy');} function freeze(v:unknown):void {if (v !== null && typeof v === 'object') {Object.freeze(v);

for (const x of Object.values(v))freeze(x);}}freeze(operators);const policy = {operators, clock};

return {registerPlayer:new RegisterPlayerUseCase(policy, clients.playerCommand),
getMyProfile:new GetMyProfileUseCase(policy, clients.playerQuery),
updateMyProfile:new UpdateMyProfileUseCase(policy, clients.playerCommand),
getMyEligibility:new GetMyEligibilityUseCase(policy, clients.playerQuery),
getMyBalance:new GetMyBalanceUseCase(policy, clients.walletQuery),
topUpTestWallet:new TopUpTestWalletUseCase(policy, clients.playerQuery, clients.walletQuery, clients.walletCommand),
requestMyWithdrawal:new RequestMyWithdrawalUseCase(policy, clients.playerQuery, clients.walletQuery, clients.walletCommand, ids),
getMyWithdrawal:new GetMyWithdrawalUseCase(policy, clients.walletQuery),
getMyTransactions:new GetMyTransactionsUseCase(policy, clients.walletQuery),
placeBet:new PlaceBetUseCase(policy, clients.betCommand),
getMyBet:new GetMyBetUseCase(policy, clients.betQuery),
getMyBetStatus:new GetMyBetStatusUseCase(policy, clients.betQuery),
listMyBets:new ListMyBetsUseCase(policy, clients.betQuery),
cancelMyBet:new CancelMyBetUseCase(policy, clients.betCommand),
listEvents:new ListEventsUseCase(policy, clients.eventCatalog),
getEvent:new GetEventUseCase(policy, clients.eventCatalog),
listMarkets:new ListMarketsUseCase(policy, clients.eventCatalog),
getMyDashboard:new GetMyDashboardUseCase(policy, clients.playerQuery, clients.walletQuery, clients.betQuery, clients.eventCatalog)};}
