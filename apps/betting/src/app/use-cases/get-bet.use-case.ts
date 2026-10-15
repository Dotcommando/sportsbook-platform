import * as M from '../../domain/betting.model.js';
import {requireRule, success} from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type {GetBetPort} from '../../ports/inbound/betting-operations.port.js';
import type {IBettingDependencies} from '../services/betting-operation.service.js';
import {authorize, fail} from '../services/betting-operation.service.js';

export class GetBetUseCase implements GetBetPort {constructor(private readonly d:IBettingDependencies) {}

async execute(input:M.IBettingGetBetInput):Promise<M.IResult<M.IBettingGetBetOutput>> {try {authorize(this.d, input.context, M.Capability.BET_READ, input.playerId);requireRule(Output.isIBettingGetBetInput(input));const result = await this.d.queries.get(input.context, input.betId, input.playerId);

requireRule(Output.isIBettingGetBetOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return success(result);} catch(error) {return fail(error, input.context);}}}
