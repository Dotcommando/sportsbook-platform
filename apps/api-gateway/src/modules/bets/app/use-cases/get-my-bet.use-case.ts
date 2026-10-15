import type { IGatewayPolicy } from '../../../../app/services/gateway-operation.service.js';
import { authorize, bet, checked, owner } from '../../../../app/services/gateway-operation.service.js';
import * as M from '../../../../domain/gateway.model.js';
import { failure, requireRule } from '../../../../domain/gateway.policy.js';
import * as Output from '../../../../domain/gateway-output.policy.js';
import type { BetQueryPort } from '../../../bets/ports/outbound/bets.port.js';
import type { GetMyBetPort } from '../../ports/inbound/bets-operations.port.js';

export class GetMyBetUseCase implements GetMyBetPort {
  constructor(private readonly policy: IGatewayPolicy, private readonly bets: BetQueryPort) { }

  async execute(input: M.IGatewayGetMyBetInput): Promise<M.IResult<M.IGatewayGetMyBetOutput>> {
    try {
      authorize(this.policy, input.context, M.Capability.BET_READ, true);
      requireRule(Output.isIGatewayGetMyBetInput(input));
      const run = async (): Promise<M.IGatewayGetMyBetOutput> => {
        const result = await checked(
          this.bets.get({ ...input, playerId: owner(input.context) }),
          Output.isIBettingGetBetOutput,
        );

        bet(input.context, result.bet, input.betId);

        return result;
      };

      return { ok: true, value: await run() };
    } catch (error) {
      return failure(error, input.context, false);
    }
  }
}
