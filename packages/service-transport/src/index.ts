import type { IDelivery, IDeliveryBatch, IDurableConsumerSettings } from './durable-consumer.js';
import { DeliveryDisposition, DurableConsumer } from './durable-consumer.js';
import type { BrokerCredentials, IDurablePublisherSettings } from './durable-publisher.js';
import { BrokerCredentialKind, DurablePublisher } from './durable-publisher.js';
import { installHttpResponseLimits } from './http-limits.js';
import type { IJetStreamTopology } from './jetstream-topology.js';
import { configureJetStream } from './jetstream-topology.js';
import { MessagingMetric, MessagingMetrics } from './messaging-metrics.js';
import {
  boundedServiceFetch,
  callServiceGrpc,
  graphqlServiceFailure,
  type IServiceClientSettings,
  type IServiceFailure,
  type IServiceIdentitySettings,
  protobufJsonDefaults,
  ServiceCallError,
  serviceFailure,
  ServiceIdentity,
  ServiceProtocol,
} from './service-client.js';
import { GRAPHQL_LIMITS, GRPC_LIMITS, NATS_LIMITS, REST_LIMITS } from './transport-limits.js';

export {
  configureJetStream,
  DeliveryDisposition,
  DurableConsumer,
  type IDelivery,
  type IDeliveryBatch,
  type IDurableConsumerSettings,
  type IJetStreamTopology,
  MessagingMetric,
  MessagingMetrics,
};

import type { IGraphqlSettings } from './graphql.js';
import { businessGraphqlError, FederationBoundary } from './graphql.js';
import type { IPrivateHost, IPrivateHostSettings } from './host.js';
import { startPrivateHost, validatePrivateHost } from './host.js';
import type { IIdentityClaims, IIdentitySettings } from './identity.js';
import { BoundaryError, instantValue, SignedIdentity, uuidValue } from './identity.js';
import type { IShape } from './wire.js';
import {
  camel,
  camelWire,
  decodeGraphqlShape,
  decodeShape,
  jsonWire,
  matchesShape,
  objectValue,
  ShapeKind,
  snake,
  strictJson,
  StringFormat,
  stringValue,
} from './wire.js';

export {
  BoundaryError,
  BrokerCredentialKind,
  type BrokerCredentials,
  businessGraphqlError,
  camel,
  camelWire,
  decodeGraphqlShape,
  decodeShape,
  DurablePublisher,
  FederationBoundary,
  type IDurablePublisherSettings,
  type IGraphqlSettings,
  type IIdentityClaims,
  type IIdentitySettings,
  instantValue,
  type IPrivateHost,
  type IPrivateHostSettings,
  type IShape,
  jsonWire,
  matchesShape,
  objectValue,
  ShapeKind,
  SignedIdentity,
  snake,
  startPrivateHost,
  strictJson,
  StringFormat,
  stringValue,
  uuidValue,
  validatePrivateHost,
};

export {
  boundedServiceFetch,
  callServiceGrpc,
  GRAPHQL_LIMITS,
  graphqlServiceFailure,
  GRPC_LIMITS,
  installHttpResponseLimits,
  type IServiceClientSettings,
  type IServiceFailure,
  type IServiceIdentitySettings,
  NATS_LIMITS,
  protobufJsonDefaults,
  REST_LIMITS,
  ServiceCallError,
  serviceFailure,
  ServiceIdentity,
  ServiceProtocol,
};

export { AdmissionError, observeOperation, traceHeaders } from '@sportsbook/observability';
