import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type { UpdatePlayerProfilePort } from '../../ports/inbound/player-operations.port.js';
import type { IPlayerDependencies } from '../services/player-command.service.js';
import { PlayerCommandService } from '../services/player-command.service.js';
import { emitEvent, stableIds } from '../services/player-event.factory.js';

export class UpdatePlayerProfileUseCase implements UpdatePlayerProfilePort {
  constructor(private readonly dependencies: IPlayerDependencies) { }

  async execute(input: M.IPlayerUpdatePlayerProfileInput): Promise<M.IResult<M.IPlayerUpdatePlayerProfileOutput>> {
    try {
      const settings = Policy.operator(
        this.dependencies.settings,
        input.context,
        M.Capability.PROFILE_WRITE,
        this.dependencies.clock.now(),
      );
      const normalized = {
        ...input,
        patch: Policy.normalizedPatch(input.patch, settings, this.dependencies.clock.now()),
      };

      return new PlayerCommandService(this.dependencies).run(
        'UpdatePlayerProfile',
        normalized,
        M.Capability.PROFILE_WRITE,
        stableIds(this.dependencies, input, ['event']),
        Output.isIPlayerUpdatePlayerProfileOutput,
        async ports => {
          const existing = Policy.profile(await ports.profiles.find(input.context, input.playerId), input.playerId);

          Policy.requireRule(existing.version === input.expectedVersion, M.ErrorCode.VERSION_CONFLICT);
          const player = Policy.profile(
            await ports.profiles.patch(input.context, input.playerId, input.expectedVersion, normalized.patch),
            input.playerId,
          );

          await emitEvent(this.dependencies, ports, input, player, M.EventType.PLAYER_PROFILE_CHANGED);

          return { profile: player };
        },
      );
    } catch (error) {
      return Policy.failure(
        error instanceof Policy.PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE,
        input.context,
      );
    }
  }
}
