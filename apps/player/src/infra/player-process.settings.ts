import type { IRuntimeSchema } from '@sportsbook/runtime-settings';
import { readSettings } from '@sportsbook/runtime-settings';

import type { IPlayerProcessConfiguration } from './player-process.configuration.js';

const schema: IRuntimeSchema = {
  'type': 'object',
  'properties': {
    'service': {
      'type': 'string',
      'const': 'player',
    },
    'application': {
      'type': 'object',
      'properties': {
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
              'businessTimeZone': {
                'type': 'string',
              },
              'countries': {
                'type': 'array',
                'items': {
                  'type': 'string',
                },
              },
              'reasonCodes': {
                'type': 'array',
                'items': {
                  'type': 'string',
                },
              },
              'policies': {
                'type': 'array',
                'items': {
                  'type': 'object',
                  'properties': {
                    'policyVersion': {
                      'type': 'string',
                    },
                    'capability': {
                      'enum': [
                        'PLACE_BET',
                        'DEPOSIT',
                        'WITHDRAW',
                      ],
                    },
                    'allowedStatuses': {
                      'type': 'array',
                      'items': {
                        'enum': [
                          'REGISTERED',
                          'ACTIVE',
                          'SUSPENDED',
                          'CLOSED',
                        ],
                      },
                    },
                    'requiredLevel': {
                      'enum': [
                        'BASIC',
                        'ENHANCED',
                      ],
                    },
                    'requiredChecks': {
                      'type': 'array',
                      'items': {
                        'enum': [
                          'IDENTITY',
                          'AGE',
                          'RESIDENCE',
                        ],
                      },
                    },
                    'minimumAge': {
                      'type': 'number',
                    },
                    'maxValidityDays': {
                      'type': 'number',
                    },
                    'blockingRestrictions': {
                      'type': 'array',
                      'items': {
                        'enum': [
                          'BETTING_BLOCK',
                          'DEPOSIT_BLOCK',
                          'WITHDRAWAL_REVIEW',
                        ],
                      },
                    },
                  },
                  'required': [
                    'policyVersion',
                    'capability',
                    'allowedStatuses',
                    'requiredLevel',
                    'requiredChecks',
                    'maxValidityDays',
                    'blockingRestrictions',
                  ],
                  'additionalProperties': false,
                },
              },
              'casePolicyCapabilities': {
                'type': 'array',
                'items': {
                  'type': 'object',
                  'properties': {
                    'level': {
                      'enum': [
                        'BASIC',
                        'ENHANCED',
                      ],
                    },
                    'capability': {
                      'enum': [
                        'PLACE_BET',
                        'DEPOSIT',
                        'WITHDRAW',
                      ],
                    },
                  },
                  'required': [
                    'level',
                    'capability',
                  ],
                  'additionalProperties': false,
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
                          'REGISTER_PLAYER',
                          'PROFILE_READ',
                          'PROFILE_WRITE',
                          'CONTACT_WRITE',
                          'CONTACT_VERIFY',
                          'MANAGE_PLAYER',
                          'MANAGE_KYC',
                          'DECIDE_KYC',
                          'KYC_STATUS',
                          'MANAGE_RESTRICTIONS',
                          'RESTRICTION_READ',
                          'EVALUATE_ELIGIBILITY',
                          'SYNTHETIC_KYC',
                          'READ_PLAYER_REFERENCE',
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
              'businessTimeZone',
              'countries',
              'reasonCodes',
              'policies',
              'casePolicyCapabilities',
              'trustedActors',
            ],
            'additionalProperties': false,
          },
        },
        'protection': {
          'type': 'object',
          'properties': {
            'activeKeyId': {
              'type': 'string',
            },
            'encryptionKeys': {
              'type': 'object',
              'properties': {},
              'required': [],
              'additionalProperties': {
                'type': 'string',
              },
            },
            'contactHmacKey': {
              'type': 'string',
            },
          },
          'required': [
            'activeKeyId',
            'encryptionKeys',
            'contactHmacKey',
          ],
          'additionalProperties': false,
        },
        'proofs': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'operatorId': {
                'type': 'string',
              },
              'contactId': {
                'type': 'string',
              },
              'proofRef': {
                'type': 'string',
              },
            },
            'required': [
              'operatorId',
              'contactId',
              'proofRef',
            ],
            'additionalProperties': false,
          },
        },
        'checks': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'operatorId': {
                'type': 'string',
              },
              'check': {
                'type': 'object',
                'properties': {
                  'checkId': {
                    'type': 'string',
                  },
                  'caseId': {
                    'type': 'string',
                  },
                  'checkType': {
                    'enum': [
                      'IDENTITY',
                      'AGE',
                      'RESIDENCE',
                    ],
                  },
                  'attemptNo': {
                    'type': 'number',
                  },
                  'provider': {
                    'type': 'string',
                    'const': 'SYNTHETIC',
                  },
                  'providerCheckRef': {
                    'type': 'string',
                  },
                  'status': {
                    'enum': [
                      'PASSED',
                      'FAILED',
                    ],
                  },
                  'resultCode': {
                    'type': 'string',
                  },
                  'completedAt': {
                    'type': 'string',
                  },
                },
                'required': [
                  'checkId',
                  'caseId',
                  'checkType',
                  'attemptNo',
                  'provider',
                  'providerCheckRef',
                  'status',
                  'resultCode',
                  'completedAt',
                ],
                'additionalProperties': false,
              },
            },
            'required': [
              'operatorId',
              'check',
            ],
            'additionalProperties': false,
          },
        },
        'recordActors': {
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
        'outboxRetryMs': {
          'type': 'number',
        },
      },
      'required': [
        'persistence',
        'namespace',
        'operators',
        'protection',
        'proofs',
        'checks',
        'recordActors',
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
                    'REGISTER_PLAYER',
                    'PROFILE_READ',
                    'PROFILE_WRITE',
                    'CONTACT_WRITE',
                    'CONTACT_VERIFY',
                    'MANAGE_PLAYER',
                    'MANAGE_KYC',
                    'DECIDE_KYC',
                    'KYC_STATUS',
                    'MANAGE_RESTRICTIONS',
                    'RESTRICTION_READ',
                    'EVALUATE_ELIGIBILITY',
                    'SYNTHETIC_KYC',
                    'READ_PLAYER_REFERENCE',
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
    'worker',
    'operations',
  ],
  'additionalProperties': false,
};

export function readProcessConfiguration(file: string): IPlayerProcessConfiguration {
  return readSettings<IPlayerProcessConfiguration>(file, schema);
}
