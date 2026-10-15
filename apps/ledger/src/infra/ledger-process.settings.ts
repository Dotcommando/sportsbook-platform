import type { IRuntimeSchema } from '@sportsbook/runtime-settings';
import { readSettings } from '@sportsbook/runtime-settings';

import type { ILedgerProcessConfiguration } from './ledger-process.configuration.js';

const schema: IRuntimeSchema = {
  'type': 'object',
  'properties': {
    'service': {
      'type': 'string',
      'const': 'ledger',
    },
    'namespace': {
      'type': 'string',
    },
    'persistence': {
      'type': 'object',
      'properties': {
        'backend': {
          'enum': [
            'PG',
            'TYPEORM',
            'PRISMA',
            'SEQUELIZE',
          ],
        },
        'strategy': {
          'enum': [
            'rc_conditional',
            'rc_for_update',
            'serializable',
          ],
        },
        'replicaCount': {
          'type': 'number',
        },
        'aggregateConnectionBudget': {
          'type': 'number',
        },
        'retry': {
          'type': 'object',
          'properties': {
            'serializationAttempts': {
              'type': 'number',
            },
            'deadlockAttempts': {
              'type': 'number',
            },
            'versionAttempts': {
              'type': 'number',
            },
            'retryBaseMs': {
              'type': 'number',
            },
            'retryMaxMs': {
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
            'serializationAttempts',
            'deadlockAttempts',
            'versionAttempts',
            'retryBaseMs',
            'retryMaxMs',
            'statementTimeoutMs',
            'lockTimeoutMs',
          ],
          'additionalProperties': false,
        },
        'outboxLeaseMs': {
          'type': 'number',
        },
        'connectionString': {
          'type': 'string',
        },
        'poolMax': {
          'type': 'number',
        },
        'acquisitionTimeoutMs': {
          'type': 'number',
        },
        'transactionTimeoutMs': {
          'type': 'number',
        },
      },
      'required': [
        'backend',
        'strategy',
        'replicaCount',
        'aggregateConnectionBudget',
        'retry',
        'outboxLeaseMs',
        'connectionString',
        'poolMax',
        'acquisitionTimeoutMs',
        'transactionTimeoutMs',
      ],
      'additionalProperties': false,
    },
    'policies': {
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
              'type': 'object',
              'properties': {
                'currency': {
                  'type': 'string',
                },
                'minimumMinor': {
                  'xBigint': true,
                },
                'maximumMinor': {
                  'xBigint': true,
                },
              },
              'required': [
                'currency',
                'minimumMinor',
                'maximumMinor',
              ],
              'additionalProperties': false,
            },
          },
          'providerNames': {
            'type': 'array',
            'items': {
              'type': 'string',
            },
          },
          'rejectionReasons': {
            'type': 'array',
            'items': {
              'type': 'string',
            },
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
                      'CREATE_WALLET',
                      'READ_WALLET',
                      'READ_JOURNAL',
                      'FUND_SYNTHETIC',
                      'WITHDRAW',
                      'PAYMENT_SIMULATOR',
                      'RESERVE_STAKE',
                      'SETTLE_BET',
                      'CANCEL_RESERVATION',
                      'RECONCILE_LEDGER',
                      'PUBLISH_EVENTS',
                    ],
                  },
                },
                'providerName': {
                  'type': 'string',
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
          'providerNames',
          'rejectionReasons',
          'trustedActors',
        ],
        'additionalProperties': false,
      },
    },
    'outboxRetryMs': {
      'type': 'number',
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
    'registrationRoutes': {
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
          'currencies': {
            'type': 'array',
            'items': {
              'type': 'string',
            },
          },
        },
        'required': [
          'operatorId',
          'actorId',
          'currencies',
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
                    'CREATE_WALLET',
                    'READ_WALLET',
                    'READ_JOURNAL',
                    'FUND_SYNTHETIC',
                    'WITHDRAW',
                    'PAYMENT_SIMULATOR',
                    'RESERVE_STAKE',
                    'SETTLE_BET',
                    'CANCEL_RESERVATION',
                    'RECONCILE_LEDGER',
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
    'syntheticPayments': {
      'type': 'object',
      'properties': {
        'seed': {
          'type': 'string',
        },
        'rejectionsPerMillion': {
          'type': 'number',
        },
        'rejectionReason': {
          'type': 'string',
        },
        'providers': {
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
              'name': {
                'type': 'string',
              },
            },
            'required': [
              'operatorId',
              'actorId',
              'name',
            ],
            'additionalProperties': false,
          },
        },
      },
      'required': [
        'seed',
        'rejectionsPerMillion',
        'rejectionReason',
        'providers',
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
    'namespace',
    'persistence',
    'policies',
    'outboxRetryMs',
    'identity',
    'host',
    'graphql',
    'broker',
    'consumer',
    'registrationRoutes',
    'worker',
    'syntheticPayments',
    'operations',
  ],
  'additionalProperties': false,
};

export function readProcessConfiguration(file: string): ILedgerProcessConfiguration {
  return readSettings<ILedgerProcessConfiguration>(file, schema);
}
