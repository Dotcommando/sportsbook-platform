import * as Wire from '@sportsbook/player-client';

import * as M from '../../../domain/betting.model.js';
import { requireRule } from '../../../domain/betting.policy.js';
import * as Output from '../../../domain/betting-output.policy.js';
import type { ClockPort, PlayerEligibilityPort } from '../../../ports/outbound/betting.port.js';
import { decodeInput } from './betting-client.dto.js';
import { protobufOutput } from './player-wire.js';
import type { IPrivateGrpcSettings } from './private-grpc.js';
import { PrivateGrpc } from './private-grpc.js';

export class PlayerGrpcClient implements PlayerEligibilityPort {
  private readonly connection: PrivateGrpc; private readonly client: Wire.PlayerServiceClient;

  constructor(settings: IPrivateGrpcSettings, clock: ClockPort) {
    this.connection = new PrivateGrpc(settings, clock);
    this.client = new Wire.PlayerServiceClient(settings.endpoint, this.connection.credentials);
  }

  close(): void {
    this.client.close();
  }

  private async checkEligibilityCall(
    context: M.ICallContext,
    body: Record<
      string,
      unknown
    >,
  ): Promise<
    M.IPlayerCheckEligibilityOutput
  > {
    const request = Wire.CheckEligibilityRequest.fromJSON(
      protobufOutput(
        { ...body, context: this.connection.delegated(context) },
        'CheckEligibilityRequest',
      ),
    );
    const raw = await this.connection.call(
      context,
      false,
      (metadata, options, done) => this.client.checkEligibility(request, metadata, options, done),
      Wire.CheckEligibilityResponse.toJSON,
    );
    const result = decodeInput('IPlayerCheckEligibilityOutput', raw, true);

    requireRule(
      Output.isIPlayerCheckEligibilityOutput(result),
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );

    if (!Output.isIPlayerCheckEligibilityOutput(result)) {
      throw new Error('Malformed dependency output');
    }

    return result;
  }

  check(
    context: M.ICallContext,
    playerId: string,
    capability: M.PlayerCapability,
  ): Promise<
    M.IPlayerCheckEligibilityOutput
  > {
    return this.checkEligibilityCall(context, { playerId, capability });
  }
}
