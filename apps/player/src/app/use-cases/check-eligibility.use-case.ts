import { EligibilityPolicy } from '../../domain/eligibility.policy.js';
import * as M from '../../domain/player.model.js';
import { operator, profile } from '../../domain/player.policy.js';
import type { CheckEligibilityPort } from '../../ports/inbound/player-operations.port.js';
import type { OperatorEligibilityPolicyPort } from '../../ports/outbound/player.port.js';
import type { IPlayerDependencies } from '../services/player-command.service.js';
import { PlayerQueryService } from '../services/player-query.service.js';

export class CheckEligibilityUseCase implements CheckEligibilityPort {
  constructor(
    private readonly dependencies: IPlayerDependencies,
    private readonly policies: OperatorEligibilityPolicyPort,
  ) { }

  execute(input: M.IPlayerCheckEligibilityInput): Promise<M.IResult<M.IPlayerCheckEligibilityOutput>> {
    return new PlayerQueryService(this.dependencies).run(
      input.context,
      M.Capability.EVALUATE_ELIGIBILITY,
      input.playerId,
      async ports => {
        const player = profile(await ports.players.find(input.context, input.playerId), input.playerId);
        const cases = await ports.cases.list(input.context, input.playerId);
        const restrictions: M.IRestriction[] = [];
        let cursor: string | undefined;

        do {
          const page = await ports.restrictions.list(
            input.context,
            input.playerId,
            { limit: 200, ...(cursor ? { cursor } : {}) },
          );

          restrictions.push(...page.items);
          cursor = page.nextCursor;
        } while (cursor);
        const policy = await this.policies.get(input.context, input.capability);
        const settings = operator(
          this.dependencies.settings,
          input.context,
          M.Capability.EVALUATE_ELIGIBILITY,
          this.dependencies.clock.now(),
        );

        return {
          eligibility: EligibilityPolicy.evaluate(
            player,
            cases,
            restrictions,
            policy,
            this.dependencies.clock.now(),
            settings.businessTimeZone,
          ),
        };
      },
    );
  }
}
