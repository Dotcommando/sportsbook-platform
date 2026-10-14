import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { checkArchitecture } from '../architecture.policy.js';

const root = path.resolve('virtual-architecture-fixtures');

const options: ts.CompilerOptions = { moduleResolution: ts.ModuleResolutionKind.NodeNext, module: ts.ModuleKind.NodeNext };

function violations(from: string, to: string, statement?: string, target = 'export const value = 1;'): string[] {
  const sourcePath = path.join(root, from);
  const targetPath = path.join(root, to);
  const specifier = path.relative(path.dirname(sourcePath), targetPath).replaceAll('\\', '/');
  const imported = specifier.startsWith('.') ? specifier : `./${specifier}`;

  return checkArchitecture([
    { filePath: sourcePath, content: statement ?? `import { value } from '${imported}';` },
    { filePath: targetPath, content: target },
  ], root, options).map(violation => violation.message);
}

for (const [from, targets] of Object.entries({
  domain: ['app', 'ports/inbound', 'adapters/inbound/rest', 'infra'],
  'ports/inbound': ['app', 'adapters/outbound/persistence', 'infra'],
  app: ['adapters/outbound/persistence', 'infra'],
  'adapters/inbound/rest': ['app', 'infra', 'adapters/outbound/persistence'],
  'adapters/outbound/persistence': ['app', 'infra', 'adapters/inbound/rest'],
})) {
  for (const to of targets) test(`rejects ${from} -> ${to}`, () => {
    assert.ok(violations(`apps/ledger/src/${from}/from.ts`, `apps/ledger/src/${to}/to.ts`).length > 0);
  });
}

for (const from of ['domain', 'ports/inbound', 'app']) {
  for (const dependency of ['@nestjs/common', 'pg', '@prisma/client', 'nats', 'graphql', '@sportsbook/ledger-client', '@sportsbook/observability', '@sportsbook/persistence']) {
    test(`rejects ${dependency} in ${from}`, () => {
      assert.ok(violations(`apps/ledger/src/${from}/from.ts`, 'packages/testing/src/to.ts', `import '${dependency}';`).length > 0);
    });
  }
}

for (const syntax of ['import', 'export', 'dynamic', 'require', 'type']) test(`rejects cross-service ${syntax}`, () => {
  const specifier = '../../../../player/src/domain/target.ts';
  const statements: Record<string, string> = {
    import: `import { value } from '${specifier}';`,
    export: `export { value } from '${specifier}';`,
    dynamic: `import('${specifier}');`,
    require: `require('${specifier}');`,
    type: `type T = import('${specifier}').Value;`,
  };

  assert.ok(violations('apps/ledger/src/app/use-cases/from.ts', 'apps/player/src/domain/target.ts', statements[syntax]).some(message => message.includes('cross-service')));
});

test('resolves cross-service aliases with TypeScript configuration', () => {
  const result = checkArchitecture([
    { filePath: path.join(root, 'apps/ledger/src/app/from.ts'), content: "import { value } from '@player/domain';" },
    { filePath: path.join(root, 'apps/player/src/domain/target.ts'), content: 'export const value = 1;' },
  ], root, { ...options, baseUrl: root, paths: { '@player/*': ['apps/player/src/*/target.ts'] } });

  assert.ok(result.some(violation => violation.message.includes('cross-service')));
});

test('allows inbound port and leaf injection token dependencies', () => {
  assert.deepEqual(violations('apps/ledger/src/adapters/inbound/rest/from.ts', 'apps/ledger/src/ports/inbound/to.ts'), []);
  assert.deepEqual(violations('apps/ledger/src/adapters/inbound/rest/from.ts', 'apps/ledger/src/infra/to.tokens.ts', undefined, "export const value = Symbol('port');"), []);
});

test('rejects a token file with implementation imports', () => {
  assert.ok(violations('apps/ledger/src/adapters/inbound/rest/from.ts', 'apps/ledger/src/infra/to.tokens.ts', undefined, "import 'pg'; export const value = Symbol('port');").length > 0);
});

test('allows core inward imports', () => {
  for (const [from, to] of [['app', 'ports/inbound'], ['app', 'domain'], ['ports/outbound', 'domain'], ['domain', 'domain']]) {
    assert.deepEqual(violations(`apps/ledger/src/${from}/from.ts`, `apps/ledger/src/${to}/to.ts`), []);
  }
});

test('rejects generated DTO imports in core and forbidden directory names', () => {
  assert.ok(violations('apps/ledger/src/app/from.ts', 'packages/contracts/src/generated/to.ts').length > 0);
  assert.ok(violations('apps/ledger/src/presentation/from.ts', 'apps/ledger/src/domain/to.ts').length > 0);
  assert.ok(violations('apps/ledger/src/application/from.ts', 'apps/ledger/src/domain/to.ts').length > 0);
});

test('rejects unresolved and computed imports', () => {
  const result = checkArchitecture([{ filePath: path.join(root, 'apps/ledger/src/app/from.ts'), content: "import './missing.js'; import(process.env.MODULE);" }], root, options);

  assert.equal(result.length, 2);
});

test('workspace and SDK symlinks under a service do not become service implementation imports', () => {
  const workspace = fileURLToPath(new URL('../../../', import.meta.url));
  const source = path.join(workspace, 'apps/ledger/src/adapters/outbound/persistence/fixture.ts');

  assert.ok(ts.resolveModuleName('@sportsbook/persistence', source, options, ts.sys).resolvedModule);
  const result = checkArchitecture([{ filePath: source, content: "import { PrismaPg } from '@prisma/adapter-pg'; import { createPersistenceRuntime } from '@sportsbook/persistence';" }], workspace, options);

  assert.deepEqual(result, []);
});
