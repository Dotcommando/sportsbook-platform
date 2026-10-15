import * as M from '../../domain/betting.model.js';
import {requireRule, success} from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type {CancelBetPort} from '../../ports/inbound/betting-operations.port.js';
import type {IBettingDependencies} from '../services/betting-operation.service.js';
import {authorize, fail, required, value} from '../services/betting-operation.service.js';
import {CancellationRecoveryService} from '../services/cancellation-recovery.service.js';

export class CancelBetUseCase implements CancelBetPort {
  constructor(private readonly d:IBettingDependencies) {}

  async execute(input:M.IBettingCancelBetInput):Promise<M.IResult<M.IBettingCancelBetOutput>> {
    try {
      authorize(this.d, input.context, M.Capability.CANCEL_BET, input.playerId);requireRule(Output.isIBettingCancelBetInput(input));const children = [{purpose:'betting:cancel', id:this.d.ids.derive(input.context.operatorId, input.requestId, 'betting:cancel')}];
      const start = value(await this.d.unitOfWork.run(input.context, async ports=>{const claim = await ports.commands.claim(input.context, input.requestId, 'CancelBet', this.d.fingerprint.hash('CancelBet', input), input, children);const bet = required(await ports.bets.find(input.context, input.betId));

requireRule(bet.playerId === input.playerId, M.ErrorCode.NOT_FOUND);

if (claim.kind === M.ClaimKind.NEW)requireRule(bet.status === M.BetStatus.ACCEPTED && bet.version === input.expectedVersion, M.ErrorCode.INVALID_STATE);

return success({claim, bet});}));

      if (start.claim.kind === M.ClaimKind.REPLAY) {const outcome = required(start.claim.command.outcome);

if (!outcome.ok) return outcome;requireRule(Output.isIBettingCancelBetOutput(outcome.value), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

if (Output.isIBettingCancelBetOutput(outcome.value)) return success(outcome.value);}
      if (start.claim.kind !== M.ClaimKind.NEW) return success({bet:start.bet, outcome:M.CancelOutcome.PENDING});

      return await new CancellationRecoveryService(this.d).resume(input, start.claim.command);
    } catch(error) {return fail(error, input.context);}
  }
}
