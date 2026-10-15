import * as Wire from '@sportsbook/ledger-client';
import type {DurablePublisher} from '@sportsbook/service-transport';

import * as M from '../../../domain/ledger.model.js';
import type {ClockPort, MessagePublicationPort} from '../../../ports/outbound/financial.port.js';

export class LedgerPublication implements MessagePublicationPort {
  constructor(private readonly publisher:DurablePublisher, private readonly clock:ClockPort) {}

  async publish(context:M.ICallContext, event:M.IEventEnvelope):Promise<M.IPublicationReceipt> {
    if (event.source !== M.EventSource.LEDGER || event.operatorId !== context.operatorId || event.schemaVersion !== 1) throw new Error('Invalid Ledger event');

const p = event.payload;let subject:string;let payload:unknown;

    if (event.eventType === M.EventType.LEDGER_POSTED) {subject = 'sportsbook.ledger.v1.posted';payload = {ledgerPostedEvent:{transactionId:p.transactionId, requestId:p.requestId, businessRef:p.businessRef, transactionType:'TRANSACTION_TYPE_' + p.transactionType, currency:p.currency, amountMinor:p.amountMinor?.toString()}};}
    else if (event.eventType === M.EventType.WALLET_CREATED) {subject = 'sportsbook.ledger.v1.wallet_created';payload = {walletCreatedEvent:{walletId:p.walletId, playerId:p.playerId, currency:p.currency}};}
    else if (event.eventType === M.EventType.WITHDRAWAL_RESOLVED) {subject = 'sportsbook.ledger.v1.withdrawal_resolved';payload = {withdrawalResolvedEvent:{withdrawalId:p.withdrawalId, walletId:p.walletId, state:'WITHDRAWAL_RESOLVED_EVENT_STATE_' + p.state, resolutionTransactionId:p.resolutionTransactionId}};}
    else throw new Error('Unregistered Ledger subject');

    const bytes = Wire.EventEnvelope.encode(Wire.EventEnvelope.fromJSON({...event, source:'EVENT_ENVELOPE_SOURCE_LEDGER', eventType:'EVENT_TYPE_' + event.eventType, payload})).finish();

await this.publisher.publish(subject, event.messageId, bytes, Date.parse(context.deadlineAt) - Date.parse(this.clock.now()));

return {messageId:event.messageId, acceptedAt:this.clock.now(), durable:true};
  }
}
