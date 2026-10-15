# Events boundary audit

Events domain, application and ports contain no NestJS, driver, broker or generated
wire types. Reads and control use cases depend on inbound/outbound interfaces;
REST, gRPC and Federation adapters inject the inbound operation bundle through
leaf tokens. Bootstrap owns immutable configuration and concrete resource binding.

Authenticated private transport identities supply operator, actor, capabilities,
correlation and deadline. Body identities cannot replace them. Application controls
require a configured SYSTEM actor with MATCH_CONTROL; quote validation requires a
configured service actor. Persistence scopes queries to the operator's active run.

The PostgreSQL unit owns command claims, phase and result writes and outbox intent.
Broker I/O occurs through the separate publication worker after commit. Events
imports no other service's source or database. Its federated entity exposes event
identity and sports data; Player remains a separate minimal reference entity.
