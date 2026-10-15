# Runtime observation and fault verification

Platform profiles with `telemetry.enabled: true` provision Prometheus, Grafana,
Tempo and an infrastructure metrics endpoint. The run's private `compose.json`
records exact images, resources and published loopback ports. Obtain an address
while the run is active with `docker compose --project-name <owned-project>
--file <private-compose.json> port grafana 3000`; use ports 9090 for Prometheus
and 3200 for Tempo. The dashboard UID is `sportsbook-platform`. Anonymous access
on the local Grafana listener is read-only; administrative credentials are
generated per run. Cleanup removes these ephemeral services.

The dashboard separates public HTTP requests/s, operation latency quantiles and
committed financial TPS. It includes operation error categories, active/queued
work, Ledger retry/pool/lock counters, PostgreSQL WAL and block IO, process CPU,
RSS and event-loop lag, container CPU and JetStream lag. Worker last-batch gauges
show applied, pending and failed work. Missing adapter-specific gauges represent
unavailable observations. Pool acquisition and lock-coordination values are
cumulative milliseconds; use their rate or delta when comparing time windows.

Tempo's data source is available in Grafana Explore. Request spans use stable
names such as `api-gateway.PlaceBet`, `betting.PlaceBet` and
`ledger.ReserveStake`. Publisher/consumer spans use their versioned subject.
Durable outbox traces start at delivery, independently of the original HTTP
trace; see [the observation decision](../adr/0008-observation-and-request-admission.md).

Raw infrastructure samples, collection errors and owner scrapes are saved under
the ignored run directory and referenced by the result. The local generator has
no instrumented Wi-Fi interface: `sportsbook_wifi_retransmissions_available` is
zero and the private artifact records why. This is not a retransmission count.
Telemetry collection and its configured sampling overhead must be held constant
across compared runs. Short controls establish functionality, not capacity.

Run the independent financial auditor after stopping all financial writers:

```sh
pnpm --filter @sportsbook/experiment-runner bench audit <relative-settings.json>
```

Its explicit private settings contain `runId`, `ledgerUrl`, `bettingUrl` and
`writersStopped: true`. Use dedicated configured environments and keep connection
credentials out of Git. The command prints the audit and exits nonzero on FAIL;
it performs no repairs. Cross-database snapshots require quiescent writers.
Normal platform runs perform this audit automatically before accepting VALID.

The opt-in process regression builds an isolated platform and verifies real
workers, a public bet/refund, process interruption around COMMIT, lost replies,
broker readiness, trace export, dashboard provisioning and independent audit:

```sh
pnpm build
pnpm --filter @sportsbook/experiment-runner test-processes
```

Fault controls live in the harness. Container kill/restart and broker stop check
the run label before acting. The one-use loopback proxy can drop or delay an
upstream reply without changing business logic. A precommit test uses a temporary
database barrier in the isolated database; normal schemas have no such hooks.
The PostgreSQL and messaging suites additionally cover concurrency variants,
worker restart, redelivery beyond broker deduplication and poison handling.

Tempo configuration follows the pinned 3.0 monolithic format documented by
[Grafana](https://grafana.com/docs/tempo/latest/configuration/); it uses local
ephemeral storage. This local composition is not a production deployment recipe.
