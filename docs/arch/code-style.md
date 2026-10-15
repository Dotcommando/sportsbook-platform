# Source formatting

The root `eslint.config.mjs` is the single source of TypeScript and JavaScript
formatting rules. It covers `.ts`, `.mts`, `.cts`, `.js`, `.mjs` and `.cjs`.
TypeScript retains its additional type-aware correctness checks.

Use two-space indentation, expanded function and control-flow blocks, braces on
every branch and loop, and at most one statement per line. Spacing, semicolons,
imports, blank lines and trailing commas are checked by the same configuration.
Code lines are limited to 120 characters. Standalone string literals, template
literals, regular expressions, URLs and standalone comments have exceptions so
formatting does not rewrite literal SQL, protocol payloads or other embedded data.
A short ordinary string inside a long expression does not bypass the line limit.

Run `pnpm format` to apply ESLint's available fixes and `pnpm lint` to check the
result. Some violations, including long expressions and multiple statements,
require editing the source. A successful fix command is not a replacement for
the final check. `pnpm lint` rejects warnings, runs the source-layout regressions
and checks architecture boundaries. `pnpm verify` includes this command in CI.

The layout regressions cover all six extensions, compressed blocks, multiple
statements, missing braces, line length, stable repeated fixes and preservation
of the pre-existing owner rule options. Changes to those established options must
deliberately update the regression snapshot.

The workspace VS Code settings enable ESLint fixes on explicit saves and recommend
the ESLint extension. Use the root configuration rather than another formatter.
Generated owner settings are formatted through the root ESLint configuration;
CI also checks that regenerating them would not change the saved source. Build
outputs and generated SDK/provider directories keep their existing exclusions.
