import {Bet} from '../../domain/bet.js';
import * as M from '../../domain/betting.model.js';
import {requireRule, success} from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type {IBettingDependencies} from './betting-operation.service.js';
import {changed, child, fail, isBusinessRejection, load, required, value} from './betting-operation.service.js';

// Initial cancellation and recovery preserve the same refund intent and command key.
export class CancellationRecoveryService {
  constructor(private readonly d:IBettingDependencies) {}

  async resume(input:M.IBettingCancelBetInput, command:M.IStoredCommand):Promise<M.IResult<M.IBettingCancelBetOutput>> {
    const d = this.d;const context = input.context;const bet = await load(d, context, input.betId);

    try {
      const status = await d.reservations.getStatus(context, bet.betId);

requireRule(Output.isILedgerGetBetFinancialStatusOutput(status) && status.reservation !== undefined, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);let financial = required(status.reservation);

      if (financial.state === M.ReservationState.RESERVED) {
        const event = await d.quotes.getEvent(context, required(bet.legs[0]).eventId);

requireRule(Output.isIEventsGetEventOutput(event) && event.event.eventId === required(bet.legs[0]).eventId, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);requireRule(event.event.phase === M.EventPhase.PRE_MATCH, M.ErrorCode.INVALID_STATE);
        const result = await d.reservations.cancel(context, child(command, 'betting:cancel'), bet.betId, M.CancellationReason.CANCELED);

requireRule(Output.isILedgerCancelBetOutput(result) && result.outcome.state === M.FinancialOutcomeState.COMPLETED && result.outcome.requestId === child(command, 'betting:cancel') && result.outcome.businessRef === bet.betId && result.outcome.wallet.playerId === input.playerId, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);financial = result.reservation;
      }
      requireRule(financial.state === M.ReservationState.CANCELED, M.ErrorCode.INVALID_STATE);

      return await d.unitOfWork.run(context, async ports=>{const current = required(await ports.bets.find(context, bet.betId));const next = value(value(Bet.rehydrate(current)).cancel(financial, d.clock.now()));

await changed(d, ports, context, current, next);const outcome = success({bet:next, outcome:M.CancelOutcome.CANCELED});

await ports.commands.complete(context, input.requestId, outcome);

return outcome;});
    } catch(error) {if (isBusinessRejection(error)) {const outcome = fail(error, context);

return d.unitOfWork.run(context, async ports=>{await ports.commands.complete(context, input.requestId, outcome);

return outcome;});}

 return success({bet:await load(d, context, bet.betId), outcome:M.CancelOutcome.PENDING});}
  }
}
