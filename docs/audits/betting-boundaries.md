# Betting boundary audit

Betting domain, application and ports contain no framework, driver, broker or
generated Protobuf types. Private REST/gRPC/Federation adapters inject inbound
operation interfaces. Application use cases own initiation, sequencing and
outcomes. Shared recovery capabilities resume durable reservation, cancellation
and settlement intents for their initiating and recovery use cases.

Persistence adapters implement operator/owner scoping, CAS, logical-reference
checks, local transaction atomicity and bounded worker claims. No adapter reaches
another service's database. SQL migrations are shared across supported ORM
runtimes, synchronization is disabled and catalog checks require zero foreign keys.

Outbound service clients mint explicitly configured private service identities,
retain trusted operator/player delegation and validate versioned wire responses.
Ledger wallet resolution stays in its client adapter; wallet ownership/currency
are checked before reserve. Network faults preserve unknown financial outcomes.

Result consumers invoke RecordEventResult only; they do not call Ledger or perform
unbounded settlement. Publication and financial RPCs occur after local commit.
Private federated Bet/Player/Event links enforce operator scope and delegate reads
to inbound ports. Player profile and KYC evidence are absent from these entities.
