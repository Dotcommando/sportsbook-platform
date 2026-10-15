# Local infrastructure

Workspace build, lint, type checking and ordinary tests need Node.js and pnpm only. PostgreSQL, NATS JetStream and the private Apollo Router are container dependencies of their explicit integration checks.

Service databases and credentials must be isolated. Instants use UTC; operator business calendars and player display require explicit IANA time zones. Local environment files are ignored.

The SQL integration check requires Docker and creates its own disposable PostgreSQL container, pinned by digest in the test harness. Run `pnpm test:postgres`; it leaves existing containers/databases untouched and removes its own container on completion. Per-service .env.example separates runtime DATABASE_URL from MIGRATION_DATABASE_URL. Ordinary skeleton tests require neither Docker nor a configured database.

The private Router configuration, pinned images and versioned supergraph are in
`router/`. See [Federation](../docs/arch/federation.md) for composition, private
network startup and isolated Gateway/Router financial integration checks. Router
publishes no host ports in the deployment fragment; the public API remains REST.
