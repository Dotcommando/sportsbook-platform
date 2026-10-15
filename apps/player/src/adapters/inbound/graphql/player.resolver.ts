import type { GraphQLResolverMap } from '@apollo/subgraph';
import { Controller, Inject, Post, Req, Res } from '@nestjs/common';
import type { IGraphqlSettings } from '@sportsbook/service-transport';
import { businessGraphqlError, FederationBoundary, jsonWire, objectValue } from '@sportsbook/service-transport';

import { PLAYER_BOUNDARY, PLAYER_GRAPHQL_SETTINGS } from '../../../infra/player-transport.tokens.js';
import type { IRestRequest, IRestResponse } from '../rest/player-rest.controller.js';
import type { ITransportHeaders } from '../shared/player-boundary.js';
import { PlayerBoundary } from '../shared/player-boundary.js';
import { playerSdl } from './player.sdl.js';

export { playerSdl };

function headers(context: unknown): ITransportHeaders {
  const record = objectValue(context);

  return {
    authorization: record.authorization,
    correlationId: record.correlationId,
    deadlineAt: record.deadlineAt,
  };
}

export class PlayerResolver {
  constructor(private readonly boundary: PlayerBoundary) { }

  async call(operation: string, args: unknown, context: unknown): Promise<unknown> {
    const fields = objectValue(args);
    const result = await this.boundary.execute(operation, fields.input, headers(context));

    if (!result.ok) {
      throw businessGraphqlError(result.error);
    }

    return jsonWire(result.value);
  }

  async resolveReference(reference: unknown, context: unknown): Promise<unknown> {
    const key = objectValue(reference);
    const transport = headers(context);
    const trusted = this.boundary.context(transport);

    if (key.operatorId !== trusted.operatorId) {
      throw businessGraphqlError({ code: 'NOT_FOUND', retryable: false, outcomeUnknown: false });
    }

    const result = await this.boundary.execute('GetPlayerReference', { playerId: key.playerId }, transport);

    if (!result.ok) {
      throw businessGraphqlError(result.error);
    }

    return result.value;
  }

  resolvers(): GraphQLResolverMap<unknown> {
    const fields =
      (
        operations: readonly string[],
      ): Record<
        string,
        (
          _parent: unknown,
          args: unknown,
          context: unknown,
        ) => Promise<
          unknown
        >
      > =>
        Object.fromEntries(
          operations.map(
            operation =>
              [
                operation[0]?.toLowerCase() + operation.slice(1),
                (_parent: unknown, args: unknown, context: unknown): Promise<unknown> =>
                  this.call(operation, args, context),
              ],
          ),
        );

    return {
      Query: fields(
        ['GetPlayer', 'GetKycStatus', 'GetRestrictions', 'CheckEligibility', 'GetPlayerReference'],
      ),
      Mutation: fields(
        [
          'RegisterPlayer',
          'UpdatePlayerProfile',
          'AddContact',
          'VerifyContact',
          'ChangePlayerStatus',
          'OpenKycCase',
          'RecordKycCheck',
          'DecideKycCase',
          'ApplyRestriction',
          'ClearRestriction',
        ],
      ),
      Player: {
        __resolveReference: (reference: unknown, context: unknown) => this.resolveReference(reference, context),
      },
    };
  }
}

@Controller()
export class PlayerGraphqlController {
  private readonly federation: FederationBoundary;

  constructor(
    @Inject(PLAYER_BOUNDARY)
    private readonly boundary: PlayerBoundary,
    @Inject(PLAYER_GRAPHQL_SETTINGS)
    settings: IGraphqlSettings,
  ) {
    this.federation =
      new FederationBoundary(playerSdl, new PlayerResolver(boundary).resolvers(), settings);
  }

  @Post('/internal/graphql')
  async execute(@Req() request: IRestRequest, @Res() response: IRestResponse): Promise<unknown> {
    const transport = {
      traceparent: request.headers.traceparent,
      tracestate: request.headers.tracestate,
      authorization: request.headers.authorization,
      correlationId: request.headers['x-correlation-id'],
      deadlineAt: request.headers['x-deadline-at'],
    };

    try {
      this.boundary.context(transport);
    } catch {
      return response.status(401).json(
        {
          errors: [
            {
              message: 'UNAUTHENTICATED',
              extensions: { code: 'UNAUTHENTICATED', retryable: false, outcomeUnknown: false },
            },
          ],
        },
      );
    }

    return response.status(200).json(await this.federation.execute(request.body, transport));
  }
}
