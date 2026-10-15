import type { IGatewayPolicy } from '../../../../app/services/gateway-operation.service.js';
import { authorize, checked } from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import { failure, requireRule } from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type { PlayerCommandPort } from '../../../players/ports/outbound/players.port.js';
import type { RegisterPlayerPort } from '../../ports/inbound/players-operations.port.js';

export class RegisterPlayerUseCase implements RegisterPlayerPort {
  constructor(
    private readonly policy: IGatewayPolicy,
    private readonly commands: PlayerCommandPort,
  ) { }

  async execute(input: M.IGatewayRegisterPlayerInput): Promise<M.IResult<M.IGatewayRegisterPlayerOutput>> {
    try {
      authorize(this.policy, input.context, M.Capability.REGISTER_PLAYER, false);
      requireRule(Output.isIGatewayRegisterPlayerInput(input));
      const run = async (): Promise<M.IGatewayRegisterPlayerOutput> => {
        const result = await checked(this.commands.register(input), Output.isIPlayerRegisterPlayerOutput);

        return { profile: result.profile };
      };

      return { ok: true, value: await run() };
    } catch (error) {
      return failure(error, input.context, true);
    }
  }
}
