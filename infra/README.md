# Local infrastructure

Workspace build, lint, type checking and skeleton tests need Node.js and pnpm only. PostgreSQL, NATS JetStream and the internal Apollo Router will be container dependencies of their owning integrations. No database, broker, Router or Docker daemon is required by the current skeletons.

Service databases and credentials must be isolated. Instants use UTC; operator business calendars and player display require explicit IANA time zones. Local environment files are ignored.

The SQL integration check requires Docker and creates its own disposable PostgreSQL container, pinned by digest in the test harness. Run `pnpm test:postgres`; it leaves existing containers/databases untouched and removes its own container on completion. Per-service .env.example separates runtime DATABASE_URL from MIGRATION_DATABASE_URL. Ordinary skeleton tests require neither Docker nor a configured database.
