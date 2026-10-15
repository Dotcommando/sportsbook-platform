import type {
  AdvanceMatchPhasePort,
  CompleteEventPort,
  GetEventPort,
  GetEventResultPort,
  GetMarketsPort,
  ListEventsPort,
  PublishOutboxBatchPort,
  ValidateSelectionQuotePort,
} from './events-operations.port.js';

export interface IEventsOperationPorts {
  listEvents: ListEventsPort;
  getEvent: GetEventPort;
  getMarkets: GetMarketsPort;
  validateSelectionQuote: ValidateSelectionQuotePort;
  getEventResult: GetEventResultPort;
  advanceMatchPhase: AdvanceMatchPhasePort;
  completeEvent: CompleteEventPort;
  publishOutboxBatch: PublishOutboxBatchPort;
}
