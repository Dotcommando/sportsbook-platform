import {Bet} from '../../domain/bet.js';
import * as M from '../../domain/betting.model.js';
import {requireRule, success} from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import {Money} from '../../domain/money.js';
import type {PlaceBetPort} from '../../ports/inbound/betting-operations.port.js';
import type {IBettingDependencies} from '../services/betting-operation.service.js';
import {authorize, child, fail, required, value} from '../services/betting-operation.service.js';
import {ReservationRecoveryService} from '../services/reservation-recovery.service.js';

export class PlaceBetUseCase implements PlaceBetPort {
  constructor(private readonly d:IBettingDependencies) {}

  async execute(input:M.IBettingPlaceBetInput):Promise<M.IResult<M.IBettingPlaceBetOutput>> {
    try {
      authorize(this.d, input.context, M.Capability.PLACE_BET, input.playerId);requireRule(Output.isIBettingPlaceBetInput(input) && input.type === M.BetType.SINGLE);
      const settings = required(this.d.settings.find(operator=>operator.operatorId === input.context.operatorId));

requireRule(settings.currencies.includes(input.stake.currency), M.ErrorCode.CURRENCY_MISMATCH);const stake = value(Money.create(input.stake.amountMinor, input.stake.currency));

requireRule(stake.amountMinor > 0n);
      const children = ['betting:bet', 'betting:reserve', 'betting:compensate'].map(purpose=>({purpose, id:this.d.ids.derive(input.context.operatorId, input.requestId, purpose)}));const betId = required(children[0]).id;const pending = value(Bet.pending(betId, input.playerId, stake, input.selection, this.d.clock.now()));
      const start = value(await this.d.unitOfWork.run(input.context, async ports=>{const claim = await ports.commands.claim(input.context, input.requestId, 'PlaceBet', this.d.fingerprint.hash('PlaceBet', input), input, children);

if (claim.kind === M.ClaimKind.NEW) await ports.bets.createPending(input.context, pending.toSnapshot(), child(claim.command, 'betting:reserve'));

return success({claim, bet:required(await ports.bets.find(input.context, betId))});}));

      if (start.claim.kind === M.ClaimKind.REPLAY) {const outcome = required(start.claim.command.outcome);

if (!outcome.ok) return outcome;requireRule(Output.isIBettingPlaceBetOutput(outcome.value), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

if (Output.isIBettingPlaceBetOutput(outcome.value)) return success(outcome.value);}
      if (start.claim.kind !== M.ClaimKind.NEW) return success({bet:start.bet, outcome:M.PlaceOutcome.PENDING});

      return await new ReservationRecoveryService(this.d).resume(input, start.claim.command);
    } catch(error) {return fail(error, input.context);}
  }
}
