# Private service transports

Service adapters share technical identity, lossless encoding and admission helpers.
They do not share domain entities or use cases. Each service supplies its own
finite DTO guards, inbound operation ports and Federation entity resolvers.

Private JWTs use explicitly configured HS256 issuer, audience and signing key.
Tokens carry trusted operator, actor, delegated player and capability claims.
Caller correlation/deadline headers cannot extend token expiry or the configured
maximum request duration. No identity fields from a REST body override these claims.
This synthetic private identity mechanism does not create an Identity service.

REST uses snake_case and canonical decimal strings for bigint values. GraphQL uses
camelCase and string money/version fields. gRPC retains the versioned Protobuf
schema and performs its enum/oneof conversion at the boundary. All entry points
call the same business operation ports and preserve typed error/unknown outcomes.

Requests are limited to 64 KiB and responses separately to 1 MiB per synchronous
protocol. GraphQL limits depth to eight, root fields to twenty and selected field
occurrences to 1000, without multiplying by page/list sizes. Fragment cycles and unknown fields fail before execution. Introspection
requires explicit enablement; Federation's authenticated service/entity operations
remain available for composition and query planning.

See [Transport limits](transport-limits.md) and
[the admission decision](../adr/0005-independent-transport-limits.md) for the
independent REST, gRPC, GraphQL and NATS limits and their units.

The host accepts explicit loopback/private IP bindings, with separate HTTP and
gRPC ports. Network policies must also restrict callers in deployment. Tests start
ephemeral loopback listeners and close them after each scenario.
