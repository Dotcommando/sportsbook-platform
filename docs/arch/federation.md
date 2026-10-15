# Private Federation

Gateway is the public REST/JSON boundary. Its GraphQL client variants call a
self-hosted Apollo Router on the private network. Ledger, Player, Betting and
Events own their SDLs and execute the same authorized inbound operations as
their REST and gRPC adapters. Router has no business workflow or database access.

`infra/router/registry.json` records actual SDL source symbols, private routing
URLs and pinned tool images. Exported SDLs live in `infra/router/subgraphs/`.
`supergraph.graphql` is the deployable Rover output; its manifest contains the
artifact and source hashes. The compiler is Federation 2.14.0 with Rover 0.39.1;
the independent Node compatibility check uses `@apollo/composition` 2.14.4.
The Linux compiler archive and container images are checksum pinned.

From the repository root, with the pinned Node/pnpm toolchain:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @sportsbook/federation compose
pnpm --filter @sportsbook/federation check
pnpm --filter @sportsbook/federation exec tsx src/cli.ts --check-rover
pnpm --filter @sportsbook/federation test-integration
```

Composition requires Docker and, on first use, access to the pinned images and
checksum-verified Apollo compiler download. Ordinary schema/governance tests use
local files. No hosted graph registry, API key or paid external service is needed.

`infra/router/compose.yaml` places Router on the internal
`sportsbook-platform-private` network and publishes no host ports. Join the owning
service containers to that network with the registered DNS names and ports;
then run `docker compose -f infra/router/compose.yaml up -d router`. The private
endpoint is `/internal/graphql`. This file supplies Router only; service process
configuration belongs to each service's bootstrap. Introspection, the homepage
and sandbox are disabled. CI integration starts disposable live service adapters
and Router automatically, and removes only its own resources.

Signed private authorization, correlation and deadline headers pass unchanged
through Router. Each service verifies them and enforces operator/player scope.
Entity keys include `operatorId` and the owning entity ID. Reference resolvers
call authorized query ports; foreign operator references fail as `NOT_FOUND`.
The shared `Player` entity contains only operator/player identifiers and an
existence flag. Profile and KYC types require their separately authorized root
operations. `Wallet.player`, `Bet.player`, `Bet.event` and `Player.bets` are owned
by the services supplying those fields.

Betting owns `cancelBet`; Ledger owns `cancelStakeReservation` as specified in
[ADR 0006](../adr/0006-federated-cancellation-ownership.md). Router/subgraph
failures retain typed errors. A failed Router subrequest becomes
`DEPENDENCY_UNAVAILABLE`; dispatched financial mutations keep an unknown outcome.
Required Dashboard sections fail the whole request. Transport admission and
message limits are defined independently in [Transport limits](transport-limits.md).

Router limits its incoming HTTP body to 64 KiB. The owning subgraph adapters
enforce depth, root-field and selected-field budgets before invoking business
ports, including when requests arrive through Router. Gateway uses fixed reviewed
documents and bounds the complete Router response to 1 MiB. Router's native
operation-limit configuration requires a GraphOS license and is not enabled;
the autonomous runtime has no mandatory hosted control plane. These are separate
boundaries: Router does not provide a global structural budget across multiple
owners or a server-side aggregate-response byte limit. Callers must retain the
bounded client, and public clients cannot submit GraphQL documents.

CI checks exported SDL drift, deterministic pinned Rover artifacts, incompatible
entity types and cancellation field collisions separately from Buf breaking
checks. Runtime integration exercises all 18 public operations, four live
subgraphs, cross-service entities, authorization/deadline propagation and owner
failure. Financial integration uses isolated PostgreSQL databases and actual
Betting/Ledger application/persistence implementations, with deterministic fake
eligibility and quote ports. It verifies cross-transport replay, stable financial
IDs, one cancellation effect and restart recovery after an unknown reservation
outcome, followed by Ledger reconciliation. It does not contact payment or KYC
providers. New owners follow the [subgraph contract template](subgraph-contract-template.md).
