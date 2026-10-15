import type { IRuntimeSchema } from '@sportsbook/runtime-settings';
import { readSettings } from '@sportsbook/runtime-settings';

import type { IEventsProcessConfiguration } from './events-process.configuration.js';

const schema: IRuntimeSchema = {
  'type': 'object',
  'properties': {
    'service': {
      'type': 'string',
      'const': 'event-simulator',
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
        'fixtures': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'operatorId': {
                'type': 'string',
              },
              'runId': {
                'type': 'string',
              },
              'seed': {
                'xBigint': true,
              },
              'startsAt': {
                'type': 'string',
              },
              'eventCount': {
                'type': 'number',
              },
              'quoteValidityMs': {
                'type': 'number',
              },
              'period': {
                'type': 'string',
                'const': 'NORMAL_TIME',
              },
            },
            'required': [
              'operatorId',
              'runId',
              'seed',
              'startsAt',
              'eventCount',
              'quoteValidityMs',
              'period',
            ],
            'additionalProperties': false,
          },
        },
        'operators': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'operatorId': {
                'type': 'string',
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
                          'EVENT_READ',
                          'QUOTE_VALIDATE',
                          'EVENT_RESULT_READ',
                          'MATCH_CONTROL',
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
        'fixtures',
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
                    'EVENT_READ',
                    'QUOTE_VALIDATE',
                    'EVENT_RESULT_READ',
                    'MATCH_CONTROL',
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
        'schedule': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'atOffsetMs': {
                'type': 'number',
              },
              'advance': {
                'type': 'object',
                'properties': {
                  'requestId': {
                    'type': 'string',
                  },
                  'eventId': {
                    'type': 'string',
                  },
                  'expectedPhaseSeq': {
                    'xBigint': true,
                  },
                  'nextPhase': {
                    'enum': [
                      'PRE_MATCH',
                      'LIVE',
                      'HALF_TIME',
                      'SUSPENDED',
                      'FINISHED',
                    ],
                  },
                  'simulatedAt': {
                    'type': 'string',
                  },
                },
                'required': [
                  'requestId',
                  'eventId',
                  'expectedPhaseSeq',
                  'nextPhase',
                  'simulatedAt',
                ],
                'additionalProperties': false,
              },
              'complete': {
                'type': 'object',
                'properties': {
                  'requestId': {
                    'type': 'string',
                  },
                  'eventId': {
                    'type': 'string',
                  },
                  'expectedPhaseSeq': {
                    'xBigint': true,
                  },
                  'result': {
                    'type': 'object',
                    'properties': {
                      'resultId': {
                        'type': 'string',
                      },
                      'eventId': {
                        'type': 'string',
                      },
                      'runId': {
                        'type': 'string',
                      },
                      'resultSeq': {
                        'xBigint': true,
                      },
                      'homeGoals': {
                        'type': 'number',
                      },
                      'awayGoals': {
                        'type': 'number',
                      },
                      'outcome': {
                        'enum': [
                          'HOME',
                          'DRAW',
                          'AWAY',
                          'VOID',
                        ],
                      },
                      'occurredAt': {
                        'type': 'string',
                      },
                    },
                    'required': [
                      'resultId',
                      'eventId',
                      'runId',
                      'resultSeq',
                      'homeGoals',
                      'awayGoals',
                      'outcome',
                      'occurredAt',
                    ],
                    'additionalProperties': false,
                  },
                },
                'required': [
                  'requestId',
                  'eventId',
                  'expectedPhaseSeq',
                  'result',
                ],
                'additionalProperties': false,
              },
            },
            'required': [
              'atOffsetMs',
            ],
            'additionalProperties': false,
          },
        },
        'startsAt': {
          'type': 'string',
        },
      },
      'required': [
        'intervalMs',
        'timeoutMs',
        'limit',
        'actors',
        'schedule',
        'startsAt',
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
    'worker',
    'operations',
  ],
  'additionalProperties': false,
};

export function readProcessConfiguration(file: string): IEventsProcessConfiguration {
  return readSettings<IEventsProcessConfiguration>(file, schema);
}
