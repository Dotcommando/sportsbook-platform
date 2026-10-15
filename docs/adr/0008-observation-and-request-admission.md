# Observation and request admission

Status: Accepted

Instrumentation belongs to technical adapters and process composition. Business
ports and domain values carry no OpenTelemetry or broker SDK types. Each process
can explicitly configure an OTLP HTTP trace endpoint, sampling ratio, active work
limit, queue capacity and maximum queue wait under `operations.observation`.
Without this optional block, trace export is disabled and admission remains
bounded at 128 active operations, 128 queued operations and a one-second wait.

Application dispatch boundaries create server spans and propagate W3C context
through private REST, gRPC and GraphQL clients. Durable publication creates a
producer span; JetStream headers carry its context to consumer spans. An outbox
does not persist the original HTTP trace context. Its delivery therefore starts
a separate trace; the durable event retains the business correlation ID.
Authorization tokens, player data and financial values are not span attributes.
Trace export has bounded buffering and does not participate in financial commits.

Admission checks the authenticated deadline before executing a command. Queue
expiry and capacity rejection return retryable errors with a known absence of
dispatch. Once execution starts, its slot remains occupied until the underlying
Promise settles, including after caller cancellation. A disconnected caller does
not establish whether a dispatched financial command committed. Existing stable
command keys, stored outcomes and recovery operations retain that responsibility.

HTTP request counters and application operation counters are separate. Financial
TPS is the rate of POSTED journal transactions observed from Ledger storage;
read transactions, transport retries and idempotent replays do not create new
financial TPS. Multiple replicas expose the same database count, so aggregate
with a maximum rather than a sum. Setup writes must be excluded using the load
interval when interpreting a measurement.

Operational readiness checks the selected database and broker and any explicitly
configured dependency readiness URLs. Scrapes require a separate bearer key.
Readiness failure does not discard pending work. Worker reports expose pending
and failed items; broker lag and delivery metrics distinguish committed local
work from confirmed delivery.

The local harness runs pinned Prometheus, Grafana and Tempo containers on the
owned private network. Published observation ports bind to loopback. Every
container receives an explicit, unique address to avoid collisions between
Docker allocation and service listener bindings. Infrastructure collection is
separate from financial audit. Unavailable radio statistics are marked
unavailable, never represented as zero retransmissions.

Independent reconciliation uses read-only repeatable-read transactions in the
owning databases after writers stop. It verifies journal balance, projections,
liabilities, logical references, incomplete commands and both directions of
Betting/Ledger correspondence. A compensated rejected bet can legitimately have
a canceled reservation. An orphan reservation or unmatched terminal state fails
the audit regardless of request throughput.
