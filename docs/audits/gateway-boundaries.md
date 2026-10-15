# Gateway boundary audit

Gateway owns public REST identity, input translation and capability composition.
Players, wallet, bets, events and Dashboard modules expose eighteen inbound use
cases. Controllers invoke inbound interfaces; application code imports only local
ports/domain types. Outbound capability ports are small and never expose generated
messages, ORM sessions, GraphQL documents or broker records.

Placement delegates to Betting with verified player/operator scope and the original
command ID. It does not inspect eligibility, validate a market or reserve funds in
Ledger. Wallet funding and withdrawal use separate authorized Player/Ledger
capabilities. The withdrawal ID derives from original scoped identity and a stable
purpose. Recovery and sporting/financial decisions remain with their owners.

Dashboard starts independent required reads in parallel, validates returned owner
and currency, preserves section observation times and fails on a required-section
error. It does not imply a distributed snapshot. Ordinary queries never dispatch
payments or settle bets.

Bootstrap binds concrete gRPC, REST or GraphQL clients per capability. Connections
and GraphQL documents are reused. No request use case branches on transport. Signed
service delegation preserves trusted scope and deadlines; public request fields
cannot replace identity. Numeric money, duplicate/unknown JSON keys and invalid
wire formats fail at the adapter. Unknown financial replies remain unknown.

Transport limits have separate protocol/direction settings. Structural GraphQL
admission does not change public pagination. The same contract tests cover each
transport, full nested journals, 200-record pages and explicit byte-limit errors.
The public listener contains no GraphQL or gRPC entry point. Minimal federated
Player entities exclude private profile and KYC fields.

Automated architecture checks enforce the import graph across production sources.
The public contract suite runs against actual owner transport adapters for gRPC,
REST and GraphQL; the Router suite repeats it through the composed graph and
checks cross-owner references and a stopped required dependency. A separate
isolated PostgreSQL test proves Gateway -> Betting -> Ledger placement, original
command replay across all transports, stable persisted child IDs, one financial
cancellation effect and restart recovery after an unknown reservation outcome.
Its eligibility/quote ports are deterministic fakes; its financial implementations
and Ledger reconciliation are real. The suite does not depend on live providers.
