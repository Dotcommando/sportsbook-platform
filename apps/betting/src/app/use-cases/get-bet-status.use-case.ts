import * as M from '../../domain/betting.model.js';
import {requireRule, success} from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type {GetBetStatusPort} from '../../ports/inbound/betting-operations.port.js';
import type {IBettingDependencies} from '../services/betting-operation.service.js';
import {authorize, fail} from '../services/betting-operation.service.js';

export class GetBetStatusUseCase implements GetBetStatusPort {constructor(private readonly d:IBettingDependencies) {}

async execute(input:M.IBettingGetBetStatusInput):Promise<M.IResult<M.IBettingGetBetStatusOutput>> {try {authorize(this.d, input.context, M.Capability.BET_READ, input.playerId);requireRule(Output.isIBettingGetBetStatusInput(input));const result = await this.d.queries.status(input.context, input.playerId, input.betId);

requireRule(Output.isIBettingGetBetStatusOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return success(result);} catch(error) {return fail(error, input.context);}}}
