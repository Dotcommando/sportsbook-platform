import type { IGatewayPolicy } from '../../../../app/services/gateway-operation.service.js';
import { authorize, checked, owner, profile } from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import { failure, requireRule } from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type { PlayerCommandPort } from '../../../players/ports/outbound/players.port.js';
import type { UpdateMyProfilePort } from '../../ports/inbound/players-operations.port.js';

export class UpdateMyProfileUseCase implements UpdateMyProfilePort {
  constructor(
    private readonly policy: IGatewayPolicy,
    private readonly commands: PlayerCommandPort,
  ) { }

  async execute(input: M.IGatewayUpdateMyProfileInput): Promise<M.IResult<M.IGatewayUpdateMyProfileOutput>> {
    try {
      authorize(this.policy, input.context, M.Capability.PROFILE_WRITE, true);
      requireRule(Output.isIGatewayUpdateMyProfileInput(input));
      const run = async (): Promise<M.IGatewayUpdateMyProfileOutput> => {
        const result = await checked(
          this.commands.updateProfile({ ...input, playerId: owner(input.context) }),
          Output.isIPlayerUpdatePlayerProfileOutput,
        );

        profile(input.context, result.profile);

        return result;
      };

      return { ok: true, value: await run() };
    } catch (error) {
      return failure(error, input.context, true);
    }
  }
}
