# SQL schema ownership and persistence bootstrap

Status: Accepted.

Each stateful service owns versioned SQL migrations and a checked catalog manifest. A migration tool applies the same SQL independently of the selected persistence library, records SHA-256 checksums, serializes migration attempts with a database advisory lock, and commits each migration with its receipt. Modified, missing or reordered applied migrations fail verification.

TypeORM, Prisma, Sequelize and pg connect to an already migrated schema. Runtime bootstrap does not synchronize, migrate, push or alter it. Scalar logical references have no foreign-key constraints. Local atomic writes, ownership validation and reconciliation provide integrity at the application boundary.

Events owns PostgreSQL state for its mutable clock, phases, quotes, results and outbox. Immutable seed files may supply its catalog. Gateway owns no database.

Schema tests use disposable databases, a role without DDL privileges, catalog comparison and database statement logging. Identical catalogs and zero DDL at runtime startup are required for each persistence library. Business posting/immutability enforcement is added with the owning financial implementation.

The no-FK policy trades database referential enforcement for additional application validation and operational reconciliation. This is a project-specific decision, not a general recommendation against foreign keys.
