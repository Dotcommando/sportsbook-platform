import * as M from '../../domain/betting.model.js';
import { requireRule, success } from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type { ListPlayerBetsPort } from '../../ports/inbound/betting-operations.port.js';
import type { IBettingDependencies } from '../services/betting-operation.service.js';
import { authorize, fail, page } from '../services/betting-operation.service.js';

export class ListPlayerBetsUseCase implements ListPlayerBetsPort {
  constructor(private readonly d: IBettingDependencies) { }

  async execute(input: M.IBettingListPlayerBetsInput): Promise<M.IResult<M.IBettingListPlayerBetsOutput>> {
    try {
      authorize(this.d, input.context, M.Capability.BET_READ, input.playerId);
      requireRule(Output.isIBettingListPlayerBetsInput(input));
      page(input.page);
      const result = await this.d.queries.list(input.context, input.playerId, input.page, input.status);

      requireRule(
        Output.isIBettingListPlayerBetsOutput(result),
        M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
      );

      return success(result);
    } catch (error) {
      return fail(error, input.context);
    }
  }
}
