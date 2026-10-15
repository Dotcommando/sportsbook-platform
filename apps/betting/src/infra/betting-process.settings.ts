import type { IRuntimeSchema } from '@sportsbook/runtime-settings';
import { readSettings } from '@sportsbook/runtime-settings';

import type { IBettingProcessConfiguration } from './betting-process.configuration.js';

const schema: IRuntimeSchema = {
  'type': 'object',
  'properties': {
    'service': {
      'type': 'string',
      'const': 'betting',
    },
    'application': {
      'type': 'object',
      'properties': {
        'namespace': {
          'type': 'string',
        },
        'persistence': {
          'type': 'object',
          'properties': {
            'retryAttempts': {
              'type': 'number',
            },
            'outboxLeaseMs': {
              'type': 'number',
            },
            'backend': {
              'enum': [
                'PG',
                'TYPEORM',
                'PRISMA',
                'SEQUELIZE',
              ],
            },
            'connectionString': {
              'type': 'string',
            },
            'poolMax': {
              'type': 'number',
            },
            'replicaCount': {
              'type': 'number',
            },
            'connectionBudget': {
              'type': 'number',
            },
            'acquisitionTimeoutMs': {
              'type': 'number',
            },
            'transactionTimeoutMs': {
              'type': 'number',
            },
            'statementTimeoutMs': {
              'type': 'number',
            },
            'lockTimeoutMs': {
              'type': 'number',
            },
          },
          'required': [
            'retryAttempts',
            'outboxLeaseMs',
            'backend',
            'connectionString',
            'poolMax',
            'replicaCount',
            'connectionBudget',
            'acquisitionTimeoutMs',
            'transactionTimeoutMs',
            'statementTimeoutMs',
            'lockTimeoutMs',
          ],
          'additionalProperties': false,
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
              'marketPeriod': {
                'type': 'string',
                'const': 'NORMAL_TIME',
              },
              'trustedActors': {
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
                    'capabilities': {
                      'type': 'array',
                      'items': {
                        'enum': [
                          'PLACE_BET',
                          'BET_READ',
                          'CANCEL_BET',
                          'SETTLE_BET',
                          'RECOVER_BETS',
                          'RECONCILE_BETS',
                          'PUBLISH_EVENTS',
                        ],
                      },
                    },
                  },
                  'required': [
                    'actorId',
                    'actorKind',
                    'capabilities',
                  ],
                  'additionalProperties': false,
                },
              },
            },
            'required': [
              'operatorId',
              'currencies',
              'marketPeriod',
              'trustedActors',
            ],
            'additionalProperties': false,
          },
        },
        'outboxRetryMs': {
          'type': 'number',
        },
      },
      'required': [
        'namespace',
        'persistence',
        'operators',
        'outboxRetryMs',
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
      'type': 'object',
      'properties': {
        'host': {
          'type': 'string',
        },
        'httpPort': {
          'type': 'number',
        },
        'grpcPort': {
          'type': 'number',
        },
        'protoPath': {
          'type': 'string',
        },
        'protobufPackage': {
          'type': 'string',
        },
      },
      'required': [
        'host',
        'httpPort',
        'grpcPort',
        'protoPath',
        'protobufPackage',
      ],
      'additionalProperties': false,
    },
    'graphql': {
      'type': 'object',
      'properties': {
        'maximumBytes': {
          'type': 'number',
        },
        'maximumResponseBytes': {
          'type': 'number',
        },
        'maximumDepth': {
          'type': 'number',
        },
        'maximumRootFields': {
          'type': 'number',
        },
        'maximumSelectedFields': {
          'type': 'number',
        },
        'introspection': {
          'type': 'boolean',
        },
      },
      'required': [
        'maximumBytes',
        'maximumResponseBytes',
        'maximumDepth',
        'maximumRootFields',
        'maximumSelectedFields',
        'introspection',
      ],
      'additionalProperties': false,
    },
    'broker': {
      'type': 'object',
      'properties': {
        'servers': {
          'type': 'array',
          'items': {
            'type': 'string',
          },
        },
        'credentials': {
          'anyOf': [
            {
              'type': 'object',
              'properties': {
                'kind': {
                  'type': 'string',
                  'const': 'TOKEN',
                },
                'token': {
                  'type': 'string',
                },
              },
              'required': [
                'kind',
                'token',
              ],
              'additionalProperties': false,
            },
            {
              'type': 'object',
              'properties': {
                'kind': {
                  'type': 'string',
                  'const': 'USER',
                },
                'user': {
                  'type': 'string',
                },
                'password': {
                  'type': 'string',
                },
              },
              'required': [
                'kind',
                'user',
                'password',
              ],
              'additionalProperties': false,
            },
          ],
        },
        'timeoutMs': {
          'type': 'number',
        },
      },
      'required': [
        'servers',
        'credentials',
        'timeoutMs',
      ],
      'additionalProperties': false,
    },
    'clients': {
      'type': 'object',
      'properties': {
        'player': {
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
        'ledger': {
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
        'player',
        'events',
        'ledger',
      ],
      'additionalProperties': false,
    },
    'consumer': {
      'type': 'object',
      'properties': {
        'stream': {
          'type': 'string',
        },
        'durable': {
          'type': 'string',
        },
        'subject': {
          'type': 'string',
        },
        'pullExpiresMs': {
          'type': 'number',
        },
        'retryDelayMs': {
          'type': 'number',
        },
        'servers': {
          'type': 'array',
          'items': {
            'type': 'string',
          },
        },
        'credentials': {
          'anyOf': [
            {
              'type': 'object',
              'properties': {
                'kind': {
                  'type': 'string',
                  'const': 'TOKEN',
                },
                'token': {
                  'type': 'string',
                },
              },
              'required': [
                'kind',
                'token',
              ],
              'additionalProperties': false,
            },
            {
              'type': 'object',
              'properties': {
                'kind': {
                  'type': 'string',
                  'const': 'USER',
                },
                'user': {
                  'type': 'string',
                },
                'password': {
                  'type': 'string',
                },
              },
              'required': [
                'kind',
                'user',
                'password',
              ],
              'additionalProperties': false,
            },
          ],
        },
        'timeoutMs': {
          'type': 'number',
        },
      },
      'required': [
        'stream',
        'durable',
        'subject',
        'pullExpiresMs',
        'retryDelayMs',
        'servers',
        'credentials',
        'timeoutMs',
      ],
      'additionalProperties': false,
    },
    'resultRoutes': {
      'type': 'array',
      'items': {
        'type': 'object',
        'properties': {
          'operatorId': {
            'type': 'string',
          },
          'actorId': {
            'type': 'string',
          },
        },
        'required': [
          'operatorId',
          'actorId',
        ],
        'additionalProperties': false,
      },
    },
    'worker': {
      'type': 'object',
      'properties': {
        'intervalMs': {
          'type': 'number',
        },
        'timeoutMs': {
          'type': 'number',
        },
        'limit': {
          'type': 'number',
        },
        'actors': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'operatorId': {
                'type': 'string',
              },
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
              'playerId': {
                'type': 'string',
              },
              'capabilities': {
                'type': 'array',
                'items': {
                  'enum': [
                    'PLACE_BET',
                    'BET_READ',
                    'CANCEL_BET',
                    'SETTLE_BET',
                    'RECOVER_BETS',
                    'RECONCILE_BETS',
                    'PUBLISH_EVENTS',
                  ],
                },
              },
            },
            'required': [
              'operatorId',
              'actorId',
              'actorKind',
              'capabilities',
            ],
            'additionalProperties': false,
          },
        },
      },
      'required': [
        'intervalMs',
        'timeoutMs',
        'limit',
        'actors',
      ],
      'additionalProperties': false,
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
    'application',
    'identity',
    'host',
    'graphql',
    'broker',
    'clients',
    'consumer',
    'resultRoutes',
    'worker',
    'operations',
  ],
  'additionalProperties': false,
};

export function readProcessConfiguration(file: string): IBettingProcessConfiguration {
  return readSettings<IBettingProcessConfiguration>(file, schema);
}
