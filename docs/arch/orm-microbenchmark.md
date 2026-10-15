# Pure ORM controls

The experiment runner accepts `kind: ORM` profiles with empty service and edge
inventories. It starts only an isolated PostgreSQL target. Direct Node child
processes call one selected persistence implementation; no sportsbook workflow,
broker or service transport participates in the measurement.

The `orm` section selects `backend`, `lane`, `operation`, `poolMax`, `rows`,
`batchSize`, `pageSize` and `maxOperations`. A local closed-loop workload supplies
concurrency, warmup and measured duration. Operation and row budgets are explicit.
Unsupported combinations fail before measurement. Each sample receives a fresh
database with the same SQL-first schema, tenant-scoped fixtures and no foreign-key
constraints. Runtime roles cannot create or alter tables.

The local target has one CPU and 512 MiB of memory, durable PostgreSQL defaults,
and autovacuum disabled for its short-lived databases. Fixtures are analyzed after
each reset. Workers share the same 512 MiB V8 old-space limit and explicit GC
before timing. Effective database settings and worker flags are recorded.

Eight operations are available: insertion, batch insertion, primary-key lookup,
indexed keyset pagination, update, join, read-modify-write and row locking.
Idiomatic and equivalent-SQL lanes are reported separately. The native `pg` lane
is a baseline. TypeORM and Sequelize use their regular entity/model APIs in the
idiomatic lane. Prisma 7.10 uses the PostgreSQL driver adapter and its generated
client; row locking requires raw locking SQL within the Prisma transaction.
The common SQL lane shares operation SQL, while transaction setup statements can
differ between libraries. Diagnostics retain these differences.

Separate diagnostic workers capture SQL, bound values, query-call counts and
`EXPLAIN (ANALYZE, BUFFERS)`. Diagnostic writes run in rollback transactions.
Timed workers serialize no SQL; a lightweight counter at `pg.Client.query` counts
driver query calls, including transaction control. This is not packet-level RTT
measurement. Pool priming, fixture reset, diagnostics and independent row/value
and logical-reference audits are outside the timed phase.

CPU measurements belong to the measured child process. Memory fields distinguish
V8 heap capacity, used heap, heap delta and RSS; heap capacity is not cumulative
allocation volume. Connection counts are observed after priming. Batched inserts
count client operations; each operation writes the configured number of rows.

`IOrmBenchResult` includes these measurements and its own data audit. Financial
platform runs retain their independent financial result and reconciliation gate.
Results, source/build identities and reports remain in ignored local storage.
Aggregate reports require at least three valid samples per configuration and one
source/build/control identity. They retain invalid results and sample variance.
No performance ranking is inferred from functional controls.
