import {CommandFingerprint} from '../adapters/outbound/ids/command-fingerprint.js';
import {UuidGenerator} from '../adapters/outbound/ids/uuid-generator.js';
import type {IBettingPersistenceSettings} from '../adapters/outbound/persistence/betting-persistence.factory.js';
import {createBettingPersistence} from '../adapters/outbound/persistence/betting-persistence.factory.js';
import {CancelBetUseCase} from '../app/use-cases/cancel-bet.use-case.js';
import {GetBetUseCase} from '../app/use-cases/get-bet.use-case.js';
import {GetBetStatusUseCase} from '../app/use-cases/get-bet-status.use-case.js';
import {ListPlayerBetsUseCase} from '../app/use-cases/list-player-bets.use-case.js';
import {PlaceBetUseCase} from '../app/use-cases/place-bet.use-case.js';
import {PublishOutboxBatchUseCase} from '../app/use-cases/publish-outbox-batch.use-case.js';
import {ReconcileBetWithLedgerUseCase} from '../app/use-cases/reconcile-bet-with-ledger.use-case.js';
import {RecordEventResultUseCase} from '../app/use-cases/record-event-result.use-case.js';
import {RetryPendingCancellationUseCase} from '../app/use-cases/retry-pending-cancellation.use-case.js';
import {RetryPendingReservationUseCase} from '../app/use-cases/retry-pending-reservation.use-case.js';
import {RetryPendingSettlementUseCase} from '../app/use-cases/retry-pending-settlement.use-case.js';
import {ScheduleEventSettlementsUseCase} from '../app/use-cases/schedule-event-settlements.use-case.js';
import {SettleBetUseCase} from '../app/use-cases/settle-bet.use-case.js';
import type {IBettingOperatorSettings} from '../domain/betting.model.js';
import type {IBettingOperationPorts} from '../ports/inbound/betting-application.port.js';
import type {ClockPort, LedgerReservationPort, LedgerSettlementPort, MarketQuotePort, MessagePublicationPort, PlayerEligibilityPort} from '../ports/outbound/betting.port.js';

export interface IBettingApplicationSettings {namespace:string;persistence:IBettingPersistenceSettings;operators:readonly IBettingOperatorSettings[];outboxRetryMs:number;}

export interface IBettingClients {eligibility:PlayerEligibilityPort;quotes:MarketQuotePort;reservations:LedgerReservationPort;settlements:LedgerSettlementPort;}

export async function createBettingApplication(config:IBettingApplicationSettings, clock:ClockPort, clients:IBettingClients, publication:MessagePublicationPort):Promise<{operations:IBettingOperationPorts;close():Promise<void>}> {const snapshot = structuredClone(config);

function freeze(value:unknown):void {if (value !== null && typeof value === 'object') {Object.freeze(value);

for (const item of Object.values(value))freeze(item);}}freeze(snapshot);

if (!Number.isInteger(snapshot.outboxRetryMs) || snapshot.outboxRetryMs < 1 || snapshot.outboxRetryMs > 60000) throw new Error('Invalid outbox retry');

const ids = new UuidGenerator(snapshot.namespace);const persistence = await createBettingPersistence(snapshot.persistence, snapshot.operators, ids, clock);const dependencies = {unitOfWork:persistence.unitOfWork, queries:persistence.queries, audit:persistence.audit, clock, ids, fingerprint:new CommandFingerprint(), settings:snapshot.operators, ...clients};const operations:IBettingOperationPorts = {
placeBet:new PlaceBetUseCase(dependencies),
getBet:new GetBetUseCase(dependencies),
listPlayerBets:new ListPlayerBetsUseCase(dependencies),
getBetStatus:new GetBetStatusUseCase(dependencies),
cancelBet:new CancelBetUseCase(dependencies),
recordEventResult:new RecordEventResultUseCase(dependencies),
settleBet:new SettleBetUseCase(dependencies),
retryPendingReservation:new RetryPendingReservationUseCase(dependencies),
retryPendingSettlement:new RetryPendingSettlementUseCase(dependencies),
retryPendingCancellation:new RetryPendingCancellationUseCase(dependencies),
reconcileBetWithLedger:new ReconcileBetWithLedgerUseCase(dependencies),
publishOutboxBatch:new PublishOutboxBatchUseCase(persistence.outbox, publication, clock, snapshot.outboxRetryMs, snapshot.operators),
scheduleEventSettlements:new ScheduleEventSettlementsUseCase(dependencies),
};

return {operations, close:()=>persistence.close()};}
