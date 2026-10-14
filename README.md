# Sportsbook platform

Backend workspace with isolated NestJS service composition roots. Business endpoints and persistence are added incrementally.

Use Node.js from `.node-version` and pnpm from `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm graph
pnpm test:postgres
pnpm nx run api-gateway:dev
pnpm affected --base=origin/master --head=HEAD
```

`pnpm format` applies the root ESLint rules. Nx schedules package builds before their consumers. Service skeletons create a standalone Nest context; no network listener or business resource is bound. The smoke tests compile and initialize every composition root without external services.

See [architecture checks](docs/arch/workspace.md), [Protobuf contracts](docs/arch/protobuf-tooling.md), [SQL migrations](docs/arch/sql-migrations.md) and [local infrastructure](infra/README.md).
