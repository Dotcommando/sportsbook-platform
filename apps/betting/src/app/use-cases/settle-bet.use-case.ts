import * as M from '../../domain/betting.model.js';
import {requireRule, success} from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type {SettleBetPort} from '../../ports/inbound/betting-operations.port.js';
import type {IBettingDependencies} from '../services/betting-operation.service.js';
import {authorize, changed, fail, required, value} from '../services/betting-operation.service.js';
import {SettlementExecutionService} from '../services/settlement-execution.service.js';
import {settlementIntent} from '../services/settlement-intent.factory.js';

export class SettleBetUseCase implements SettleBetPort {
  constructor(private readonly d:IBettingDependencies) {}

  async execute(input:M.IBettingSettleBetInput):Promise<M.IResult<M.IBettingSettleBetOutput>> {
    try {
      authorize(this.d, input.context, M.Capability.SETTLE_BET, undefined, true);requireRule(Output.isIBettingSettleBetInput(input) && input.settlementSeq === 1n);
      const prepared = value(await this.d.unitOfWork.run(input.context, async ports=>{const bet = required(await ports.bets.find(input.context, input.betId));const existing = await ports.settlements.find(input.context, input.betId, input.settlementSeq);

if (existing) {requireRule(existing.resultId === input.resultId, M.ErrorCode.IDEMPOTENCY_CONFLICT);

return success({bet, intent:existing, dispatch:false});}

 const result = required(await ports.settlements.findEventResult(input.context, input.resultId));const intent = await ports.settlements.create(input.context, settlementIntent(this.d, input.context, bet, result, input.settlementSeq));const next = {...bet, status:M.BetStatus.SETTLEMENT_PENDING, version:bet.version + 1n};

await changed(this.d, ports, input.context, bet, next);

return success({bet:next, intent, dispatch:true});}));

      if (!prepared.dispatch) return success({bet:prepared.bet, outcome:prepared.intent.state === M.SettlementState.APPLIED ? M.SettleOutcome.SETTLED : M.SettleOutcome.PENDING});

      return await new SettlementExecutionService(this.d).execute(input.context, prepared.intent);
    } catch(error) {return fail(error, input.context);}
  }
}
