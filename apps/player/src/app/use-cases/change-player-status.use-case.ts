import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type { ChangePlayerStatusPort } from '../../ports/inbound/player-operations.port.js';
import type { IPlayerDependencies } from '../services/player-command.service.js';
import { PlayerCommandService } from '../services/player-command.service.js';
import { emitEvent, stableIds } from '../services/player-event.factory.js';

export class ChangePlayerStatusUseCase implements ChangePlayerStatusPort {
  constructor(private readonly dependencies: IPlayerDependencies) { }

  async execute(input: M.IPlayerChangePlayerStatusInput): Promise<M.IResult<M.IPlayerChangePlayerStatusOutput>> {
    try {
      return new PlayerCommandService(this.dependencies).run(
        'ChangePlayerStatus',
        input,
        M.Capability.MANAGE_PLAYER,
        stableIds(this.dependencies, input, ['event']),
        Output.isIPlayerChangePlayerStatusOutput,
        async ports => {
          const policy = Policy.operator(
            this.dependencies.settings,
            input.context,
            M.Capability.MANAGE_PLAYER,
            this.dependencies.clock.now(),
            M.ActorKind.SYSTEM,
          );

          Policy.requireRule(policy.reasonCodes.includes(input.reasonCode));
          const current = Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);

          Policy.requireRule(current.version === input.expectedVersion, M.ErrorCode.VERSION_CONFLICT);
          const status = Policy.lifecycle(current.status, input.status);
          const player = Policy.profile(
            await ports.players.transition(
              input.context,
              input.playerId,
              input.expectedVersion,
              status,
              input.reasonCode,
            ),
            input.playerId,
          );

          await emitEvent(this.dependencies, ports, input, player, M.EventType.PLAYER_ELIGIBILITY_CHANGED);

          return { profile: player };
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
