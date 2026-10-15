# Adding a contract-owning subgraph

Before implementation, identify the owning capability and service, initiating
actors, inbound use cases, outbound ports, input/output shapes, failure semantics
and observable acceptance scenarios. Agree changed operation contracts with the
owner. Public access remains REST through Gateway.

Use a versioned `sportsbook.<owner>.v1` Protobuf package and an independently
owned Federation SDL. Register the actual SDL source/export and explicit private
routing URL in `infra/router/registry.json`. Pin composition/runtime versions;
run the schema exporter and Rover composition to update deployable artifacts.

Define an entity key containing trusted operator scope and a stable entity ID.
Resolve references through an authorized inbound query port. Extension fields
belong to the service owning their capability. Keep private profiles, documents,
credentials and internal storage details out of minimal shared entities.

Define each collection's pagination or cardinality contract and lossless scalar
encoding. Keep those bounds independent of REST/gRPC/GraphQL/NATS message limits
and GraphQL structural admission. Preserve deadlines and signed delegation across
Router hops. Unknown command outcomes must retain their original recovery keys.

Verify valid and malformed requests, ownership/operator isolation, unavailable
owners, cross-subgraph references and GraphQL error propagation. Add negative
composition fixtures for incompatible entity/field changes. Buf breaking checks
and Federation composition checks are separate mandatory checks; neither
substitutes for application workflows or database invariants.
