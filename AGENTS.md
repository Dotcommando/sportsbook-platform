# Sportsbook Platform Repository Instructions

Design for worldwide use. Store instants in UTC. Use configured IANA time zones
for player-facing display and operator business calendars; never hardcode the
owner's location or depend on the server's local time zone. Date-only values
remain calendar dates.

## 1. Scope And Development Model

Build a backend sportsbook platform with durable business capabilities,
financial correctness, service ownership and operational reliability. Performance
measurements and video artifacts are secondary uses of the working platform;
they do not define its architecture or replace product acceptance criteria.
The stack is pnpm workspaces, Nx, strict TypeScript, NestJS, PostgreSQL,
NATS JetStream, Protobuf/Buf and internal Apollo Federation 2.
Service inventories, release scope and temporary exclusions belong in plans,
not these durable instructions. Do not scaffold unused services or directories.

Development is plan-driven. Write executable plans in English under `plans/`.
`plans/ACTIVE_PLAN.md` contains exactly one sibling plan filename, with no
additional commentary. Work on that plan unless the owner changes scope.
Resolve the current plan only through `plans/ACTIVE_PLAN.md`; do not hardcode
a plan filename in repository instructions.

This file owns durable development and architecture rules. The active plan owns
implementation order and step-specific acceptance criteria. Public architecture
decisions belong in `docs/adr/`, boundary audits in `docs/audits/`, and technical
documentation in `docs/arch/`. Record deliberate architecture changes in
an ADR; a plan step cannot silently override these rules. Explicit owner
instructions take precedence over repository conventions.

Before implementation:

1. Read the applicable `AGENTS.md`.
2. Read `plans/ACTIVE_PLAN.md` and the active plan when available locally.
3. Read relevant specifications, ADRs, contracts and fixtures.
4. Find the first non-completed step within the authorized scope.
5. Confirm that it still matches the repository state.
6. Ensure it defines observable behavior, verification and a concrete DoD.
7. Mark the step `In Progress` before implementation.

Use `Pending`, `In Progress`, `Implemented` (code exists; verification pending),
and `Done` (implementation and DoD verified). A step is one coherent, reviewable
increment; avoid trivial file-creation steps and unrelated subsystem batches.
At most one implementation step may be `In Progress` at a time. Mark only the
step currently being implemented; move it to `Implemented` or `Done` before
starting the next step. Several `Implemented` steps may await a shared verification
checkpoint. Update statuses by exact step identity, never by a numeric prefix or
batch-wide replacement, and read back the status inventory after each update.
Resolve routine choices from the active plan and repository conventions. Ask only
when a material ambiguity cannot be resolved from those sources. Do not perform
unrelated work merely because it is nearby.

### Private planning and public contributions

`plans/` and every nested `AGENTS.md` are local-only; only this root `AGENTS.md`
is intended for publication. Keep private plans, estimates, recording preparation
and unreleased evidence in ignored local storage. Do not copy their contents into
public documentation, commit messages, PR descriptions, CI logs, artifacts or
other tracked files. Public docs may describe implemented behavior and approved
technical decisions without disclosing private planning material.

A public checkout may have no `plans/` directory. In that case, follow an explicit
issue or owner request and the public specifications; do not recreate private
plans or invent their contents. Check Git's index before publication: ignore
patterns do not remove files that are already tracked. Preserve local planning
files when correcting accidental tracking, and report any prior publication.

## 2. Architecture And Responsibility Boundaries

Follow Hexagonal Architecture / Ports & Adapters. Dependencies point inward:

- `domain` owns business rules and state transitions, independent of frameworks.
- `app` owns application use cases and their orchestration.
- `ports/inbound` defines operations offered by the application; use cases
  implement these contracts and inbound adapters call them.
- `ports/outbound` defines capabilities required by the application;
  outbound adapters implement these contracts.
- `adapters/inbound` contains HTTP/gRPC controllers, GraphQL
  resolvers and message consumers. They translate protocol inputs/outputs and
  invoke use cases; they do not own business rules or workflow orchestration.
- `adapters/outbound` contains persistence adapters, service clients and publishers.
- `infra` contains configuration, bootstrap and composition: NestJS modules,
  providers and DI wiring. Concrete integrations belong in the adapters above.

`ports`, `app` and `domain` are sibling directories. Imports follow
`ports -> domain`, `app -> ports/domain`, and `adapters -> ports/domain`;
`infra` wires all layers. `domain` does not import ports, and ports do not import
`app`, adapters or `infra`. Inbound adapters call inbound interfaces, not concrete
use-case classes. Define operation contracts in ports and business types in
domain so an interface never needs an implementation import.
Adapters may import feature-owned `infra/*.tokens.ts` for framework injection;
these files are leaf constants with no implementation imports. This exception
does not permit adapter imports of composition modules or concrete use cases.

Use these directories within each service or Gateway capability module. Do not
add a `presentation` directory inside or alongside `adapters/inbound`. Organize
inbound adapters by entry point (`rest`, `grpc`, `graphql`, `nats`, `cli`) and
outbound adapters by integration (`persistence`, `clients`, `nats`) as needed.
An NATS consumer is inbound; a publisher is outbound. Create only directories
with actual implementations. Repository-root `infra/` contains deployment and
local environment definitions; service-local `src/infra/` wires that service.

Neither `domain`, `app` nor `ports` imports NestJS, ORM/driver types, generated
Protobuf DTOs, HTTP/GraphQL decorators or NATS SDKs. Convert external payloads
at adapter boundaries. Unit-of-Work contracts expose domain/application concepts,
never `PoolClient`, Prisma transaction clients or ORM sessions. Keep business
decisions out of controllers and other adapters.

Prevent abstraction leaks in `app` and `ports` through semantics as well as imports. Names,
contracts, parameters, results and errors describe business capabilities, not
concrete ORMs, databases, transports or brokers. Do not expose provider-specific
fields or wrap SDK APIs in superficially neutral interfaces. Technology-specific
translation and implementation details stay in adapters and `infra`.

Start planning from domains: responsibilities, business rules, invariants and
scenarios. Before implementing a domain/application operation, agree its input
and output interfaces with the owner, including results and failure semantics.
Then implement the method defined by those contracts. Do not derive contracts
from a ready-made implementation or a technology API. Changes to agreed
contracts require agreement before implementation; unchanged contracts already
approved in the current work do not need repeated approval.

Each service owns its domain, application, database/schema, migrations and events.
Never import another application's `src` or access its database directly. Shared
cross-service business contracts are versioned external contracts, not domain
entities or repository implementations. Technical helpers need a real second
consumer or meaningful duplication; do not introduce speculative abstractions.

The public API is REST/JSON only. Internal gRPC, REST/JSON, subgraphs and the
self-hosted Apollo Router remain private. gRPC is the ordinary internal default;
transport variants implement equivalent ports and business semantics. Govern
Protobuf with versioned `sportsbook.<service>.v1` packages, Buf lint/format/breaking
checks and deterministic typed-client generation. Federation composition has its
own compatibility checks; it does not replace Buf or application workflows.

Keep pagination/batch counts, encoded message sizes and protocol-specific
structural limits separate. Each exchange method and direction owns its limits;
record their units and approved values in `docs/arch/transport-limits.md`.
Do not silently truncate business results or change pagination when switching
internal transports.

Gateway modules follow public capabilities rather than mirror downstream
services. Their use cases compose small ports; business decisions and workflow
recovery remain with the service owning the business outcome. Concrete service
responsibilities and call paths belong in plans and architecture documentation.

### Application file roles and DI

Before changing application behavior, identify the use case, initiating actor or
adapter, agreed input/output contracts and affected scenarios in the active plan
when available. For shared capabilities, name the supported use cases and the
separate responsibility. A service is not the default destination for workflows.

- The application-layer directory is always `app`, never `application`.
- Use cases belong in `app/use-cases/`, optionally by feature, using
  `<action>.use-case.ts` and `<Action>UseCase`. They own sequencing, preconditions
  and outcomes; avoid forwarding-only wrappers around old services.
- Reusable capabilities belong in `app/services/` with
  `<name>.service.ts` and `<Name>Service`; justify their shared responsibility.
- Ports belong in `ports/inbound/` and `ports/outbound/`, beside `app` and `domain`.
  NestJS controllers use `.controller.ts` and
  `Controller` names under `adapters/inbound/rest/` or `adapters/inbound/grpc/`;
  they never belong to `domain` or `app`. NestJS modules stay in `infra`.
- Support files name their role, such as `.dto.ts`, `.error.ts`, `.policy.ts`,
  `.factory.ts` or `.tokens.ts`. Do not label data/contracts as services.
- Shared DI symbols belong to feature-owned `infra` `.tokens.ts` files.
  Controllers do not export shared tokens. Keep class tokens where appropriate;
  `domain`, `app` and `ports` must not import composition token modules.

Resolve validated service configuration once at bootstrap into immutable
per-process settings. DI binds concrete ORM, concurrency and transport adapters then.
Do not parse config or branch on ORM/transport/strategy in request use cases.
Reject unsupported combinations, invalid pools/routes and excessive aggregate
connection budgets before binding listeners. Never silently degrade a variant.

## 3. PostgreSQL Schema And Naming Rules

- SQL identifiers use `snake_case`; TypeScript properties use `camelCase`.
- Domain root tables are plural (`players`, `bets`). Supporting tables use
  domain prefixes (`player_profiles`, `bet_legs`, `ledger_entries`).
- Primary keys identify their entity (`player_id`, `bet_id`, `bet_leg_id`,
  `ledger_transaction_id`), never a generic `id`. Logical references are scalar
  IDs, with stable opaque identifiers rather than exposed database sequences.
- Every business table has a required trusted `operator_id`. Scope relevant
  queries, uniqueness and authorization by operator; validate player ownership.
  Never trust unchecked caller-supplied operator/player identities.
- Money uses integer minor units: PostgreSQL `BIGINT` and TypeScript `bigint`.
  Document lossless transport encoding; never convert money or 64-bit IDs through
  JavaScript `number`. Odds use exact `NUMERIC` and exact application arithmetic
  with documented deterministic rounding. Currency is explicit.
- Timestamps use `TIMESTAMPTZ` / UTC. Define lifecycle timestamps, version fields,
  audit immutability and retention according to the owning entity.

**No foreign-key constraints anywhere**, even within one service or in
ORM-generated DDL. Logical references do not permit `FOREIGN KEY` / `REFERENCES`
constraints. `PRIMARY KEY`, `UNIQUE`, `CHECK`, ordinary/composite/partial indexes
remain required where they enforce business rules or support measured queries.

Use SQL-first, versioned, checksum-verified migrations independent of ORM choice.
All TypeORM, Prisma, Sequelize and `pg` variants use the same authoritative schema.
Disable ORM synchronization and automatic DDL; schema changes use migrations.
ORM relationships must not recreate constraints or alter tables. Run static
migration checks, schema assertions and this catalog audit against each service
database after every migration batch:

```sql
SELECT conrelid::regclass AS table_name, conname AS constraint_name
FROM pg_constraint
WHERE contype = 'f';
```

Expected result: zero rows. Also verify required uniqueness, indexes and column
types. Compensate for absent FKs with application validation, atomic related
local writes, operator checks and scheduled orphan/pending-state reconciliation.
No physical cascading deletes; lifecycle and anonymization are explicit.

Add required business indexes first. Profile secondary indexes with
`EXPLAIN (ANALYZE, BUFFERS)` in diagnostic runs. Avoid indexing every column
combination. Use stable `(created_at, bet_id)` keyset pagination for large bet
lists. Document query isolation and pagination for financial reads.

## 4. Coding Rules

Use strict TypeScript and precise types, narrowing and explicit contracts. Use
an `I` prefix for new internal object-shape interfaces
unless an established public contract uses another name. Closed string sets use
enums. Keep constants/enums in the narrowest module owning their semantics.

Use structured parsers/APIs instead of ad hoc string manipulation when practical.
Method names describe their action. CRUD-style services default to batch
operations. Add abstractions only for real complexity, meaningful duplication or
durable boundaries. Avoid unrelated cosmetic refactors, preserve owner comments,
and add comments only for essential context. Default to ASCII unless non-ASCII
is required. Never use destructive Git commands without an explicit request.

Use the root `eslint.config.mjs` for linting and TypeScript formatting in every
microservice and shared package. Do not invent additional rules, duplicate the
config per service or introduce another TypeScript formatter.

The same root configuration governs JavaScript (`.js`, `.mjs`, `.cjs`) and
TypeScript (`.ts`, `.mts`, `.cts`). Before marking source changes Done, run
`pnpm format`, resolve any remaining diagnostics, and run `pnpm lint`. Auto-fix
alone is not verification: some layout violations require manual expansion.
Preserve the owner's existing rule options when extending the configuration.

## 5. Configuration And Secrets

When variables change, update the affected local `.env` and tracked
`.env.example` without publishing credentials. Keep environment/responsibility
credentials separate. Use `password` for password placeholders and `secret` for
keys/tokens/secrets. Example URLs use localhost unless another endpoint is
required. Service endpoints and selected providers/adapters are explicit;
configuration validation fails instead of silently falling back. Local `.env`
files, private evidence and credentials must not enter Git or published artifacts.

## 6. Verification And Definition Of Done

Every step has a concrete DoD. Prefer batched checks after roughly three coherent
steps when the active plan permits; correctness-sensitive changes may require
immediate verification. Every bug fix includes a regression reproducing the
original failure at an observable boundary. Never claim unexecuted Red/Green,
test, migration, measurement or deployment results.

Use fake ports and deterministic synthetic fixtures. Tests do not silently call
live external or paid services. Persistence/fault tests use
isolated configured environments; never reset production or unrelated data.
All supported adapter variants pass the same functional, concurrency, fault and
reconciliation suites. Unsupported combinations fail explicitly. Architecture
tests enforce the layer import graph above and reject cross-service source access.

Verify the success/failure scenarios and domain invariants defined by the agreed
contracts and active plan. Keep domain-specific acceptance requirements and
failure matrices in that plan rather than repository instructions.

Performance measurements are separate tasks with methodology and recording
details in private plans. They exercise the platform's real workflows and must
preserve all business and financial guarantees. Do not require a measurement
matrix or video artifact to complete an ordinary platform feature.

A behavioral DoD includes implemented port-level behavior, success/failure
regressions, relevant typecheck/tests/lint/build, updated contracts/ADRs/audits,
schema/no-FK checks when applicable, and verified domain invariants. Add a
factual `Done` section to the private plan after verification: what changed,
commands actually run, outcomes and unresolved limitations. Do not prefill `Done`.

This repository has no inherited deployment authorization or procedure from
another project. Follow a project-specific authorized deployment procedure when
one is established; local build success is not deployment success.
