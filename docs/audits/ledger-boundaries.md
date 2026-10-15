# Ledger boundary audit

Ledger's domain, application and ports contain business-owned types and no NestJS,
ORM, SQL-driver, Protobuf, GraphQL or broker DTOs. Each inbound controller or
resolver calls the same operation port. Native transaction resources remain within
persistence adapters; no callback can use its scoped stores after completion.

Closed findings:

- The operation bundle was moved from composition into inbound ports, removing
  an adapter dependency on an infrastructure implementation.
- Trusted identities are built from signed private bearer claims. gRPC context
  claims cannot expand signed delegation; REST rejects supplied context/operator
  fields. Capability and entity ownership checks also run in the application.
- Money/version values are validated as canonical decimal strings and decoded to
  bigint. Protobuf enum and saved-result oneof conversion happens at the adapter.
- Output guards cover finite operation schemas, IDs, instants, enums and bounded
  collections. Transport errors expose registered codes and preserve unknown outcomes.
- Runtime roles cannot mutate journal rows. All twelve backend/strategy combinations
  preserve the same atomic bookkeeping, rollback, replay and reconciliation rules.
- Architecture policy rejects imports of the shared transport package into core
  layers, in addition to the existing SDK and foreign-service source checks.

REST, Nest gRPC and Apollo Federation contract tests execute every registered RPC
operation. Deterministic fixtures produce identical journal effects across entry
points. Financial acceptance exercises all backends and concurrency strategies.

Listeners require explicit private bindings and signed issuer/audience/key settings.
The transport composition factory binds supplied operation ports; platform profile
and process configuration are separate composition responsibilities.

Sources: [Nest gRPC](https://docs.nestjs.com/microservices/grpc),
[Apollo subgraphs](https://www.apollographql.com/docs/apollo-server/using-federation/apollo-subgraph-setup).
