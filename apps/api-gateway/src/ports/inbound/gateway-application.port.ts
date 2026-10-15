import type {PlaceBetPort} from '../../modules/bets/ports/inbound/bets-operations.port.js';
import type {GetMyBetPort} from '../../modules/bets/ports/inbound/bets-operations.port.js';
import type {GetMyBetStatusPort} from '../../modules/bets/ports/inbound/bets-operations.port.js';
import type {ListMyBetsPort} from '../../modules/bets/ports/inbound/bets-operations.port.js';
import type {CancelMyBetPort} from '../../modules/bets/ports/inbound/bets-operations.port.js';
import type {GetMyDashboardPort} from '../../modules/dashboard/ports/inbound/dashboard-operations.port.js';
import type {ListEventsPort} from '../../modules/events/ports/inbound/events-operations.port.js';
import type {GetEventPort} from '../../modules/events/ports/inbound/events-operations.port.js';
import type {ListMarketsPort} from '../../modules/events/ports/inbound/events-operations.port.js';
import type {RegisterPlayerPort} from '../../modules/players/ports/inbound/players-operations.port.js';
import type {GetMyProfilePort} from '../../modules/players/ports/inbound/players-operations.port.js';
import type {UpdateMyProfilePort} from '../../modules/players/ports/inbound/players-operations.port.js';
import type {GetMyEligibilityPort} from '../../modules/players/ports/inbound/players-operations.port.js';
import type {GetMyBalancePort} from '../../modules/wallet/ports/inbound/wallet-operations.port.js';
import type {TopUpTestWalletPort} from '../../modules/wallet/ports/inbound/wallet-operations.port.js';
import type {RequestMyWithdrawalPort} from '../../modules/wallet/ports/inbound/wallet-operations.port.js';
import type {GetMyWithdrawalPort} from '../../modules/wallet/ports/inbound/wallet-operations.port.js';
import type {GetMyTransactionsPort} from '../../modules/wallet/ports/inbound/wallet-operations.port.js';

export interface IGatewayOperationPorts {registerPlayer:RegisterPlayerPort;getMyProfile:GetMyProfilePort;updateMyProfile:UpdateMyProfilePort;getMyEligibility:GetMyEligibilityPort;getMyBalance:GetMyBalancePort;topUpTestWallet:TopUpTestWalletPort;requestMyWithdrawal:RequestMyWithdrawalPort;getMyWithdrawal:GetMyWithdrawalPort;getMyTransactions:GetMyTransactionsPort;placeBet:PlaceBetPort;getMyBet:GetMyBetPort;getMyBetStatus:GetMyBetStatusPort;listMyBets:ListMyBetsPort;cancelMyBet:CancelMyBetPort;listEvents:ListEventsPort;getEvent:GetEventPort;listMarkets:ListMarketsPort;getMyDashboard:GetMyDashboardPort;}
