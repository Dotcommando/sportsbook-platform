import * as M from '../../domain/betting.model.js';
import {BettingError, requireRule, success} from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type {RecordEventResultPort} from '../../ports/inbound/betting-operations.port.js';
import type {IBettingDependencies} from '../services/betting-operation.service.js';
import {authorize, fail} from '../services/betting-operation.service.js';

export class RecordEventResultUseCase implements RecordEventResultPort {
  constructor(private readonly d:IBettingDependencies) {}

  async execute(input:M.IBettingRecordEventResultInput):Promise<M.IResult<M.IBettingRecordEventResultOutput>> {
    try {
      authorize(this.d, input.context, M.Capability.SETTLE_BET);requireRule(input.context.actorKind === M.ActorKind.SERVICE, M.ErrorCode.PERMISSION_DENIED);requireRule(Output.isIBettingRecordEventResultInput(input));const {envelope, result} = input;

      requireRule(envelope.operatorId === input.context.operatorId && envelope.source === M.EventSource.EVENTS && envelope.eventType === M.EventType.EVENT_RESULT && envelope.schemaVersion === 1 && Output.isIEventResult(envelope.payload));
      const payload = envelope.payload;

if (!Output.isIEventResult(payload)) throw new BettingError(M.ErrorCode.INVALID_INPUT);
      requireRule(this.d.fingerprint.hash('ResultPayload', {...input, result:payload}) === this.d.fingerprint.hash('ResultPayload', input));
      requireRule(result.resultSeq === 1n && result.homeGoals >= 0 && result.homeGoals <= 100 && result.awayGoals >= 0 && result.awayGoals <= 100);
      const outcome = result.homeGoals > result.awayGoals ? M.ResultOutcome.HOME : result.homeGoals < result.awayGoals ? M.ResultOutcome.AWAY : M.ResultOutcome.DRAW;

requireRule(result.outcome === M.ResultOutcome.VOID || result.outcome === outcome);
      const sweepId = this.d.ids.derive(input.context.operatorId, result.resultId, 'betting:sweep');const hash = this.d.fingerprint.hash('RecordEventResult', input);

      return await this.d.unitOfWork.run<M.IBettingRecordEventResultOutput>(input.context, async ports=>{const inbox = await ports.inbox.claim(input.context, envelope, hash);

if (!inbox.isNew) return success({accepted:true, duplicate:true, sweepId});await ports.settlements.recordEventResult(input.context, result);await ports.sweeps.create(input.context, {sweepId, eventId:result.eventId, resultId:result.resultId, state:M.SweepState.PENDING, version:1n});await ports.inbox.markProcessed(input.context, envelope.messageId);

return success({accepted:true, duplicate:false, sweepId});});
    } catch(error) {return fail(error, input.context);}
  }
}
