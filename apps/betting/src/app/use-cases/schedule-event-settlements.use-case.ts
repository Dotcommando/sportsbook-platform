import * as M from '../../domain/betting.model.js';
import {requireRule, success, validUuid} from '../../domain/betting.policy.js';
import {settlementCursor} from '../../domain/settlement-cursor.js';
import type {ScheduleEventSettlementsPort} from '../../ports/inbound/betting-operations.port.js';
import type {IBettingDependencies} from '../services/betting-operation.service.js';
import {authorize, changed, fail, page, report, required} from '../services/betting-operation.service.js';
import {settlementIntent} from '../services/settlement-intent.factory.js';

export class ScheduleEventSettlementsUseCase implements ScheduleEventSettlementsPort {
  constructor(private readonly d:IBettingDependencies) {}

  async execute(input:M.IBettingScheduleEventSettlementsInput):Promise<M.IResult<M.IBettingScheduleEventSettlementsOutput>> {
    try {
      authorize(this.d, input.context, M.Capability.SETTLE_BET, undefined, true);page(input.page);requireRule(validUuid(input.sweepId) && input.page.cursor === undefined);

      return await this.d.unitOfWork.run(input.context, async ports=>{const sweeps = await ports.sweeps.findDue(input.context, {limit:200});const sweep = sweeps.find(s=>s.sweepId === input.sweepId);const counts = report();

if (!sweep) return success({report:counts});

const result = required(await ports.settlements.findEventResult(input.context, sweep.resultId));const bets = await ports.bets.listByEvent(input.context, sweep.eventId, {limit:input.page.limit, ...(sweep.cursor ? {cursor:sweep.cursor} : {})});

requireRule(bets.length <= input.page.limit, M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);counts.selected = bets.length;

        for (const bet of bets) {await ports.settlements.create(input.context, settlementIntent(this.d, input.context, bet, result, 1n));const next = {...bet, status:M.BetStatus.SETTLEMENT_PENDING, version:bet.version + 1n};

await changed(this.d, ports, input.context, bet, next);counts.applied++;}
        const last = bets.at(-1);const cursor = last ? settlementCursor(input.context.operatorId, sweep.eventId, last.betId) : sweep.cursor;

await ports.sweeps.checkpoint(input.context, sweep.sweepId, sweep.version, cursor, bets.length < input.page.limit);

return success({report:counts});});
    } catch(error) {return fail(error, input.context);}
  }
}
