# Workspace boundaries

Services own their implementation under `apps/<owner>/src`. The Gateway will own capability modules. The architecture checker parses TypeScript imports, re-exports, dynamic imports and require calls and resolves aliases with the TypeScript resolver.

Allowed core edges are domain to domain, ports to ports/domain, app to app/ports/domain. Adapters use ports/domain and their own adapter helpers. Only leaf `infra/*.tokens.ts` constants may cross from infra into adapters; composition modules remain inaccessible. Core code cannot import NestJS, persistence drivers, broker SDKs, generated transport contracts or integration utilities. Cross-service implementation imports are forbidden, including aliases and re-exports.

`pnpm architecture` checks production sources; `pnpm test` includes negative import fixtures and positive token/port fixtures. CI executes the check on every change. Add directories only when they contain an implementation; package names identify real shared responsibilities.

Nx builds dependencies before consumers and tracks workspace package dependencies. CI uses a frozen pnpm lockfile. The root ESLint configuration is the sole TypeScript formatter.
