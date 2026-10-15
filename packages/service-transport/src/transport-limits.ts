export const REST_LIMITS = Object.freeze({requestBytes:65536, responseBytes:1048576});

export const GRPC_LIMITS = Object.freeze({requestBytes:65536, responseBytes:1048576});

export const GRAPHQL_LIMITS = Object.freeze({requestBytes:65536, responseBytes:1048576, depth:8, rootFields:20, selectedFields:1000, entityBatch:200});

export const NATS_LIMITS = Object.freeze({eventBytes:65536});
