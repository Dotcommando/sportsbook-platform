import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type { ApplyRestrictionPort } from '../../ports/inbound/player-operations.port.js';
import type { IPlayerDependencies } from '../services/player-command.service.js';
import { PlayerCommandService } from '../services/player-command.service.js';
import { emitEvent, stableIds } from '../services/player-event.factory.js';

export class ApplyRestrictionUseCase implements ApplyRestrictionPort {
  constructor(private readonly dependencies: IPlayerDependencies) { }

  async execute(input: M.IPlayerApplyRestrictionInput): Promise<M.IResult<M.IPlayerApplyRestrictionOutput>> {
    try {
      const ids = stableIds(this.dependencies, input, ['restriction', 'event']);

      return new PlayerCommandService(this.dependencies).run(
        'ApplyRestriction',
        input,
        M.Capability.MANAGE_RESTRICTIONS,
        ids,
        Output.isIPlayerApplyRestrictionOutput,
        async ports => {
          const settings = Policy.operator(
            this.dependencies.settings,
            input.context,
            M.Capability.MANAGE_RESTRICTIONS,
            this.dependencies.clock.now(),
            M.ActorKind.SYSTEM,
          );

          Policy.requireRule(
            settings.reasonCodes.includes(input.reasonCode)
            && Object.values(M.RestrictionType).includes(input.type)
            && Policy.validInstant(input.startsAt)
            && (!input.endsAt
              || Policy.validInstant(input.endsAt) && Date.parse(input.endsAt) > Date.parse(input.startsAt)),
          );
          const player = Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);
          const restriction = await ports.restrictions.add(
            input.context,
            {
              restrictionId: ids[0]?.id ?? '',
              playerId: input.playerId,
              type: input.type,
              state: M.RestrictionState.ACTIVE,
              reasonCode: input.reasonCode,
              startsAt: input.startsAt,
              ...(input.endsAt ? { endsAt: input.endsAt } : {}),
            },
          );

          await emitEvent(this.dependencies, ports, input, player, M.EventType.PLAYER_ELIGIBILITY_CHANGED);

          return { restriction };
        },
        M.ActorKind.SYSTEM,
      );
    } catch (error) {
      return Policy.failure(
        error instanceof Policy.PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE,
        input.context,
      );
    }
  }
}
