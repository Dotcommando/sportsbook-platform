# Ledger persistence and recovery

Ledger has pg, TypeORM, Prisma and Sequelize transaction providers. Each supports
conditional READ COMMITTED, locked READ COMMITTED and SERIALIZABLE. Composition
selects the provider and writer once. Use cases have no ORM/strategy branch.

Financial operations execute equivalent parameterized SQL in the selected
provider's native transaction: pg PoolClient, TypeORM transaction QueryRunner,
Prisma interactive transaction or Sequelize transaction. This includes ownership
reads, chart upserts, idempotency, projection CAS, reservation/withdrawal changes,
the protected journal function, audit queries and outbox persistence. These are
SQL-based financial adapters, not a measurement of idiomatic ORM model CRUD.

Conditional updates check observed versions and final nonnegative liabilities.
FOR UPDATE locks required projection rows in account UUID order before the same
domain policy runs. SERIALIZABLE retries the entire local callback on 40001;
40P01 and version conflicts have separate bounded budgets. Retry delay/jitter,
statement/lock timeouts, acquisition limits and connection budgets are explicit.
Callbacks contain no remote calls. A failed attempt rolls back projections,
journal, business state, command response and event intent together.

Only the initiating actor or authorized owning player can read a command result.
The canonical sorted-key SHA-256 covers operation, semantic arguments, operator,
actor and delegated player; bigint values are decimal strings. Retry, correlation,
deadline and capability-refresh metadata do not change the semantic key. Original
input and prepared IDs persist with the result. Ambiguous COMMIT replies preserve
unknown outcome; callers recover/retry the original request ID.

UUIDv5 names are UTF-8 JSON ["v1", operatorId, originalIdentity, purpose], using an
explicit immutable namespace. Ledger purposes start with ledger: to avoid event
identity collisions when owners share a namespace. Wallet account identities use
wallet ID and account kind; system accounts include currency. Broker message IDs
exclude time/retry/replica metadata. Operational lease IDs include an acquisition
attempt to reject an old publisher's acknowledgment after reassignment.

History pages use repeatable-read transactions, scoped/filter-bound versioned
timestamp/UUID cursors and a fixed posting-time cutoff. Each page is a committed
snapshot; separate requests do not hold a shared database snapshot. A late commit
with an earlier posting timestamp can become visible on a later page. Financial
reconciliation does not use paginated history: it calculates complete totals in
one independent repeatable-read snapshot and paginates only violation details.

Outbox claims use short transactions and SKIP LOCKED. Publishing occurs after the
claim transaction ends. Mark delivery only for a matching current lease and a
durable receipt; ambiguous delivery retains the original message ID for retry.
Failures preserve a bounded retry schedule and failure code. Broker integration
is a separate adapter; database effects never rely on broker deduplication alone.

Provider metrics count actual pg client query dispatches, including ORM transaction
commands. Retry categories, transaction outcomes, pool active/idle/waiting,
acquisition latency and coordination latency are separate. Coordination latency
includes SQL/network time and is not labeled as pure database lock-wait duration.
An independent pg_stat_activity gauge reports sessions currently waiting on locks.

Use separate migration/runtime roles. Runtime bootstrap rejects journal DML or
DDL/admin privileges and missing posting execution rights. It also rejects a
namespace inconsistent with the existing system chart. Never use migration
credentials for a financial provider.
