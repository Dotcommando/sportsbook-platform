import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { IRuntimeSchema } from '@sportsbook/runtime-settings';
import { ESLint } from 'eslint';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../../', import.meta.url));

const targets = [
  ['ledger', 'ledger', 'ILedgerProcessConfiguration'],
  ['player', 'player', 'IPlayerProcessConfiguration'],
  ['betting', 'betting', 'IBettingProcessConfiguration'],
  ['event-simulator', 'events', 'IEventsProcessConfiguration'],
  ['api-gateway', 'gateway', 'IGatewayProcessConfiguration'],
];

const files = targets.map(
  ([owner, prefix]) =>
    path.join(root, 'apps', owner ?? '', 'src/infra', prefix + '-process.configuration.ts'),
);

const config = ts.readConfigFile(path.join(root, 'tsconfig.base.json'), ts.sys.readFile);

const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);

const sourcePaths = Object.fromEntries(
  ['runtime-settings', 'service-transport', 'observability', 'persistence'].map(
    name => ['@sportsbook/' + name, [path.join(root, 'packages', name, 'src/index.ts')]],
  ),
);

const program = ts.createProgram(
  files,
  { ...parsed.options, paths: { ...parsed.options.paths, ...sourcePaths } },
);

const checker = program.getTypeChecker();

const formatter = new ESLint({ cwd: root, fix: true });

function schemaFor(type: ts.Type, stack: ReadonlySet<ts.Type> = new Set()): IRuntimeSchema {
  if (type.flags & ts.TypeFlags.Undefined) {
    throw new Error('Unexpected undefined configuration root');
  }
  if (type.isStringLiteral()) {
    return { type: 'string', const: type.value };
  }
  if (type.isNumberLiteral()) {
    return { type: 'number', const: type.value };
  }
  if (type.flags & ts.TypeFlags.BigIntLike) {
    return { xBigint: true };
  }
  if (type.flags & ts.TypeFlags.String) {
    return { type: 'string' };
  }
  if (type.flags & ts.TypeFlags.Number) {
    return { type: 'number' };
  }
  if (type.flags & ts.TypeFlags.BooleanLike) {
    return { type: 'boolean' };
  }
  if (type.isUnion()) {
    const members = type.types.filter(member => !(member.flags & ts.TypeFlags.Undefined));

    if (members.length === 1 && members[0]) {
      return schemaFor(members[0], stack);
    }

    const schemas = members.map(member => schemaFor(member, stack));

    if (schemas.every(s => s.const !== undefined)) {
      return {
        enum: schemas.map(
          s => {
            if (s.const === undefined) {
              throw new Error('Missing literal');
            }

            return s.const;
          },
        ),
      };
    }
    if (schemas.every(s => s.type === 'boolean')) {
      return { type: 'boolean' };
    }

    return { anyOf: schemas };
  }
  if (stack.has(type) || stack.size > 40) {
    throw new Error('Recursive configuration type: ' + checker.typeToString(type));
  }

  const next = new Set(stack);

  next.add(type);

  if (checker.isArrayType(type) || checker.isArrayLikeType(type)) {
    const item = checker.getIndexTypeOfType(type, ts.IndexKind.Number);

    if (!item) {
      throw new Error('Missing array type');
    }

    return { type: 'array', items: schemaFor(item, next) };
  }
  if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length) {
    throw new Error('Configuration cannot contain functions: ' + checker.typeToString(type));
  }
  if (type.flags & ts.TypeFlags.Object || type.isIntersection()) {
    const properties: Record<string, IRuntimeSchema> = {};
    const required: string[] = [];

    for (const symbol of checker.getPropertiesOfType(type)) {
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];

      if (!declaration) {
        throw new Error('Missing property declaration');
      }

      const property = checker.getTypeOfSymbolAtLocation(symbol, declaration);

      properties[symbol.name] = schemaFor(property, next);

      if (!(symbol.flags & ts.SymbolFlags.Optional)) {
        required.push(symbol.name);
      }
    }
    const index = checker.getIndexTypeOfType(type, ts.IndexKind.String);

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: index ? schemaFor(index, next) : false,
    };
  }
  throw new Error('Unsupported configuration type: ' + checker.typeToString(type));
}

for (let index = 0; index < targets.length; index++) {
  const target = targets[index];
  const file = files[index];

  if (!target || !file) {
    throw new Error('Missing configuration target');
  }

  const [owner, prefix, name] = target;

  if (!owner || !prefix || !name) {
    throw new Error('Missing configuration registration');
  }

  const source = program.getSourceFile(file);

  if (!source) {
    throw new Error('Missing configuration source');
  }

  const declaration = source.statements.find(
    statement => ts.isInterfaceDeclaration(statement) && statement.name.text === name,
  );

  if (!declaration) {
    throw new Error('Missing configuration interface ' + name);
  }

  const schema = schemaFor(checker.getTypeAtLocation(declaration));
  const output =
    "import { readSettings } from '@sportsbook/runtime-settings';\nimport type { IRuntimeSchema } from '@sportsbook/runtime-settings';\nimport type { "
    + name
    + " } from './"
    + prefix
    + "-process.configuration.js';\n\nconst schema: IRuntimeSchema = "
    + JSON.stringify(schema, null, 2)
    + ';\n\nexport function readProcessConfiguration(file: string): '
    + name
    + ' {\n  return readSettings<'
    + name
    + '>(file, schema);\n}\n';
  const destination = path.join(path.dirname(file), prefix + '-process.settings.ts');
  const formatted = (await formatter.lintText(output, { filePath: destination }))[0];

  if (!formatted || formatted.errorCount) {
    throw new Error('Cannot format generated owner settings ' + owner);
  }

  const content = formatted.output ?? output;

  if (process.argv.includes('--check')) {
    if (readFileSync(destination, 'utf8') !== content) {
      throw new Error('Stale generated settings ' + owner);
    }
  } else {
    writeFileSync(destination, content);
  }
}

console.log('Owner-local process settings schemas verified.');
