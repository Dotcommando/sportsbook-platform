# Local JetStream and delivery recovery

Start the development broker with `docker compose -f infra/nats/compose.yaml up -d --wait`.
Provide the required environment variables in ignored `infra/nats/.env`, using
`.env.example` as the variable inventory. Each service receives only its own NATS
username/password; the topology credential is separate. Run
`pnpm --filter @sportsbook/messaging configure` to create streams and the durable
consumer. Repeating configuration accepts identical settings and rejects drift.
The broker is bound to loopback; its health and monitoring endpoint is port 8222.

The pinned NATS server stores four owner streams on disk. Publishers can write
only their own `sportsbook.<owner>.v1.*` subjects. Versioned Protobuf envelopes
carry UUID message IDs, explicit operator scope and bounded non-PII payloads.
Settings in `infra/nats/topology.json` define retention, deduplication, delivery
backoff and capacity. Configuration performs no stream deletion or purging.

`BETTING_RESULTS` is a durable pull consumer of
`sportsbook.events.v1.event_result` with AckExplicit. The Betting credential can
fetch/inspect/acknowledge this consumer and observe its own delivery advisories;
it cannot publish authoritative Events results. The inbound consumer maps its
configured operator/source actor routes to application context. Malformed,
unroutable or conflicting events terminate as poison. Temporary failures are
negatively acknowledged with a bounded delay. Delivery limits generate advisories
that require investigation and an authorized redrive after correcting the cause.

RecordEventResult returns success only after inbox, immutable result and scheduling
sweep commit together. The consumer then confirms its acknowledgment. A crash
between commit and acknowledgment causes redelivery; the inbox and business result
uniqueness suppress repeated effects even after broker deduplication expires.
Settlement workers process committed bounded intents independently of the consumer.

Every owner retains outbox intent in its local database transaction. Publishers
lease due records, release their database connection, publish with Nats-Msg-Id and
mark delivery only after JetStream acknowledgment. Lost publish responses can
repeat publication with the same message ID. Shutdown bounds publisher draining
and closes the connection if the broker is unavailable.

MessagingMetrics exposes Prometheus text for observed outbox backlog, successful
publication, publish failures, consumer lag, delivery/redelivery, retries, poison,
acknowledgment failures and advisories. Private process metrics can combine each
service's outbox and broker adapters through the same metrics instance. Counters
are per process; broker monitoring supplies durable consumer state. Exhausted
messages are retained under stream retention and are not silently declared applied.

Run `pnpm --filter @sportsbook/messaging test-integration` for isolated PostgreSQL
and NATS acceptance. The fixture kills a consumer process after its commit and
before ACK, restarts the broker with its data preserved, loses a publish reply and
repeats messages after the deduplication window. It checks bounded delivery,
poison/advisory metrics, publisher permissions and one financial settlement.
