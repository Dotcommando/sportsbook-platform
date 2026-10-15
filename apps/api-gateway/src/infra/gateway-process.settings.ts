import type { IRuntimeSchema } from '@sportsbook/runtime-settings';
import { readSettings } from '@sportsbook/runtime-settings';

import type { IGatewayProcessConfiguration } from './gateway-process.configuration.js';

const schema: IRuntimeSchema = {
  'type': 'object',
  'properties': {
    'service': {
      'type': 'string',
      'const': 'api-gateway',
    },
    'namespace': {
      'type': 'string',
    },
    'operators': {
      'type': 'array',
      'items': {
        'type': 'object',
        'properties': {
          'operatorId': {
            'type': 'string',
          },
          'currencies': {
            'type': 'array',
            'items': {
              'type': 'string',
            },
          },
          'syntheticProvider': {
            'type': 'string',
          },
          'trustedRegistrationActors': {
            'type': 'array',
            'items': {
              'type': 'object',
              'properties': {
                'actorId': {
                  'type': 'string',
                },
                'actorKind': {
                  'enum': [
                    'PLAYER',
                    'SERVICE',
                    'SYSTEM',
                  ],
                },
              },
              'required': [
                'actorId',
                'actorKind',
              ],
              'additionalProperties': false,
            },
          },
        },
        'required': [
          'operatorId',
          'currencies',
          'syntheticProvider',
          'trustedRegistrationActors',
        ],
        'additionalProperties': false,
      },
    },
    'clients': {
      'type': 'object',
      'properties': {
        'players': {
          'type': 'object',
          'properties': {
            'protocol': {
              'enum': [
                'GRPC',
                'REST',
                'GRAPHQL',
              ],
            },
            'endpoint': {
              'type': 'string',
            },
            'tls': {
              'type': 'boolean',
            },
            'issuer': {
              'type': 'string',
            },
            'audience': {
              'type': 'string',
            },
            'key': {
              'type': 'string',
            },
            'actorId': {
              'type': 'string',
            },
            'operators': {
              'type': 'array',
              'items': {
                'type': 'string',
              },
            },
            'capabilities': {
              'type': 'array',
              'items': {
                'type': 'string',
              },
            },
            'timeoutMs': {
              'type': 'number',
            },
          },
          'required': [
            'protocol',
            'endpoint',
            'tls',
            'issuer',
            'audience',
            'key',
            'actorId',
            'operators',
            'capabilities',
            'timeoutMs',
          ],
          'additionalProperties': false,
        },
        'wallet': {
          'type': 'object',
          'properties': {
            'protocol': {
              'enum': [
                'GRPC',
                'REST',
                'GRAPHQL',
              ],
            },
            'endpoint': {
              'type': 'string',
            },
            'tls': {
              'type': 'boolean',
            },
            'issuer': {
              'type': 'string',
            },
            'audience': {
              'type': 'string',
            },
            'key': {
              'type': 'string',
            },
            'actorId': {
              'type': 'string',
            },
            'operators': {
              'type': 'array',
              'items': {
                'type': 'string',
              },
            },
            'capabilities': {
              'type': 'array',
              'items': {
                'type': 'string',
              },
            },
            'timeoutMs': {
              'type': 'number',
            },
          },
          'required': [
            'protocol',
            'endpoint',
            'tls',
            'issuer',
            'audience',
            'key',
            'actorId',
            'operators',
            'capabilities',
            'timeoutMs',
          ],
          'additionalProperties': false,
        },
        'bets': {
          'type': 'object',
          'properties': {
            'protocol': {
              'enum': [
                'GRPC',
                'REST',
                'GRAPHQL',
              ],
            },
            'endpoint': {
              'type': 'string',
            },
            'tls': {
              'type': 'boolean',
            },
            'issuer': {
              'type': 'string',
            },
            'audience': {
              'type': 'string',
            },
            'key': {
              'type': 'string',
            },
            'actorId': {
              'type': 'string',
            },
            'operators': {
              'type': 'array',
              'items': {
                'type': 'string',
              },
            },
            'capabilities': {
              'type': 'array',
              'items': {
                'type': 'string',
              },
            },
            'timeoutMs': {
              'type': 'number',
            },
          },
          'required': [
            'protocol',
            'endpoint',
            'tls',
            'issuer',
            'audience',
            'key',
            'actorId',
            'operators',
            'capabilities',
            'timeoutMs',
          ],
          'additionalProperties': false,
        },
        'events': {
          'type': 'object',
          'properties': {
            'protocol': {
              'enum': [
                'GRPC',
                'REST',
                'GRAPHQL',
              ],
            },
            'endpoint': {
              'type': 'string',
            },
            'tls': {
              'type': 'boolean',
            },
            'issuer': {
              'type': 'string',
            },
            'audience': {
              'type': 'string',
            },
            'key': {
              'type': 'string',
            },
            'actorId': {
              'type': 'string',
            },
            'operators': {
              'type': 'array',
              'items': {
                'type': 'string',
              },
            },
            'capabilities': {
              'type': 'array',
              'items': {
                'type': 'string',
              },
            },
            'timeoutMs': {
              'type': 'number',
            },
          },
          'required': [
            'protocol',
            'endpoint',
            'tls',
            'issuer',
            'audience',
            'key',
            'actorId',
            'operators',
            'capabilities',
            'timeoutMs',
          ],
          'additionalProperties': false,
        },
      },
      'required': [
        'players',
        'wallet',
        'bets',
        'events',
      ],
      'additionalProperties': false,
    },
    'identity': {
      'type': 'object',
      'properties': {
        'issuer': {
          'type': 'string',
        },
        'audience': {
          'type': 'string',
        },
        'key': {
          'type': 'string',
        },
        'maximumDeadlineMs': {
          'type': 'number',
        },
      },
      'required': [
        'issuer',
        'audience',
        'key',
        'maximumDeadlineMs',
      ],
      'additionalProperties': false,
    },
    'host': {
      'type': 'string',
    },
    'port': {
      'type': 'number',
    },
    'operations': {
      'type': 'object',
      'properties': {
        'host': {
          'type': 'string',
        },
        'port': {
          'type': 'number',
        },
        'key': {
          'type': 'string',
        },
        'observation': {
          'type': 'object',
          'properties': {
            'traceEndpoint': {
              'type': 'string',
            },
            'sampleRate': {
              'type': 'number',
            },
            'maxActive': {
              'type': 'number',
            },
            'maxQueued': {
              'type': 'number',
            },
            'queueWaitMs': {
              'type': 'number',
            },
          },
          'required': [
            'traceEndpoint',
            'sampleRate',
            'maxActive',
            'maxQueued',
            'queueWaitMs',
          ],
          'additionalProperties': false,
        },
        'dependencies': {
          'type': 'array',
          'items': {
            'type': 'string',
          },
        },
      },
      'required': [
        'host',
        'port',
        'key',
      ],
      'additionalProperties': false,
    },
  },
  'required': [
    'service',
    'namespace',
    'operators',
    'clients',
    'identity',
    'host',
    'port',
    'operations',
  ],
  'additionalProperties': false,
};

export function readProcessConfiguration(file: string): IGatewayProcessConfiguration {
  return readSettings<IGatewayProcessConfiguration>(file, schema);
}
