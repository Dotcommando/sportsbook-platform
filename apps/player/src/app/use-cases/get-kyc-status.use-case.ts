import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type { GetKycStatusPort } from '../../ports/inbound/player-operations.port.js';
import type { IPlayerDependencies } from '../services/player-command.service.js';
import { PlayerQueryService } from '../services/player-query.service.js';

export class GetKycStatusUseCase implements GetKycStatusPort {
  constructor(private readonly dependencies: IPlayerDependencies) { }

  execute(input: M.IPlayerGetKycStatusInput): Promise<M.IResult<M.IPlayerGetKycStatusOutput>> {
    return new PlayerQueryService(this.dependencies).run(
      input.context,
      M.Capability.KYC_STATUS,
      input.playerId,
      async ports => {
        Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);
        const now = this.dependencies.clock.now();
        const cases = (await ports.cases.list(input.context, input.playerId)).map(
          value =>
            value.status === M.KycCaseStatus.APPROVED && value.validUntil !== undefined
              && Date.parse(value.validUntil) <= Date.parse(now)
              ? { ...value, status: M.KycCaseStatus.EXPIRED }
              : value,
        );
        const result = { cases, evaluatedAt: now };

        Policy.requireRule(
          Output.isIPlayerGetKycStatusOutput(result),
          M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
        );

        return result;
      },
      undefined,
    );
  }
}
