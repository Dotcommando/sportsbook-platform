# Local process runner

Build the workspace before invoking the runner:

```sh
pnpm build
pnpm --filter @sportsbook/experiment-runner bench run <profile-relative-to-repository>
pnpm --filter @sportsbook/experiment-runner bench matrix <profile-relative-to-repository>
pnpm --filter @sportsbook/experiment-runner bench report <run-uuid>
```

Docker with Compose is required. A platform run builds the pinned Linux image,
checks that the source tree did not change during the build, and uses the resulting
image identity. Every run receives fresh owner databases, separate runtime roles,
a restricted NATS topology and the five executable processes. PostgreSQL schemas
are created exclusively by checksum-verified owner migrations and checked against
their schema manifests, including the zero-foreign-key catalog check.

YAML profiles are strict, immutable version-1 documents. They select resources per
service, a protocol per supported call edge, a decimal-string seed, bounded load,
warmup, repetitions and telemetry settings. A matrix declares one dimension and
runs points and repetitions sequentially. Unsupported owner/provider combinations,
connection-budget violations and ambiguous rate/concurrency settings fail.

Service `configuration` and platform `fixture` paths are confined to the checkout.
Each owner settings type lives in its `src/infra/*-process.configuration.ts`.
The schema generator can be checked with:

```sh
pnpm --filter @sportsbook/experiment-runner exec tsx src/generate-settings.ts --check
```

Settings templates may use exact string placeholders `$RUN_BIND`,
`$RUN_DATABASE_URL`, `$RUN_IDENTITY_KEY`, `$RUN_BROKER_PASSWORD` and
`$RUN_SCRAPE_KEY`. These are resolved outside request handling. The runner supplies
the selected resources, internal endpoints and generated run credentials; identity
issuers/audiences and trusted operator/actor policies remain explicit.

A synthetic fixture contains `version: 1`, owner-scoped `setup` commands, public
REST `actions`, and an audit actor. Each command contains a method, relative path,
body and trusted actor claims; setup commands also name their owning service and
expected status. Workload actions can only target `/v1/` on Gateway. `$REQUEST_ID`
and `$NOW` are typed fixture placeholders; generated request identities retain the
exact seed. Setup may wait briefly for an asynchronously provisioned resource
using the same command identity. Timed load does not hide failures through retries.

Open-loop scheduling counts offered requests that exceed the in-flight budget as
technical failures. Closed-loop scheduling bounds concurrency. Latency uses a
fixed-size histogram with approximately one-percent logarithmic buckets. Results
separate completion, business rejection, technical failure, unknown outcome and
replay counts. The local runner currently requires one explicit local generator;
it rejects remote devices before provisioning.

Writes stop before the independent database audit. The audit checks journal
balance, projections, wallet liabilities, references, duplicate commands and
Betting/Ledger terminal state. Failed audits and unfinished financial operations
invalidate the result. Private artifacts live under `experiments/results/<uuid>`;
manifests/results have SHA256 sidecars and report generation verifies provenance.
Bootstrap failures retain diagnostics and clean up only their own resources.

Transport byte/structure limits remain independent of pagination and worker batch
bounds; see [independent transport limits](../adr/0005-independent-transport-limits.md).
