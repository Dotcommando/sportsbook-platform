# SQL migrations and runtime mappings

Ledger, Player, Betting and Events own their migration directories and catalog manifests. Gateway owns no database. Apply migrations with separate migration credentials:

```sh
pnpm --filter @sportsbook/migrations migrate ledger
```

Supply MIGRATION_DATABASE_URL explicitly. The runner validates SQL with a structured parser, rejects foreign keys and invalid money/time/tenant/naming shapes, verifies SHA-256 history, serializes concurrent runners and commits DDL plus its receipt atomically. Applied SQL cannot be edited, removed or reordered. Use a new migration for changes.

Runtime adapters receive immutable settings and service-owned mappings. TypeORM synchronization/migration execution is disabled; Sequelize defines models without sync; Prisma uses scalar-only mappings and a pg driver adapter; pg issues no startup DDL. Migration and runtime roles must differ, and runtime roles have no schema CREATE or table ownership.

`pnpm test:postgres` starts a dedicated digest-pinned PostgreSQL container on an ephemeral loopback port. It creates only disposable databases there, then removes the container. It never reads a configured production database or resets another environment. The same authoritative schema is rebuilt for pg, TypeORM, Prisma and Sequelize in Ledger/Player/Betting; Events supports its fixed pg backend and rejects the alternatives.

Tests compare full catalogs, required column types, uniqueness/indexes and zero FKs; assert no DDL during startup from PostgreSQL logs; detect schema drift; and exercise concurrent migration replay, checksum/history rejection and transactional rollback. Data preparation stays outside timed workloads. Business posting balance/immutability and orphan reconciliation are implemented and verified by the owning use cases.
