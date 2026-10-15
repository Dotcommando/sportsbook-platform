import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

export interface IArchitectureSource {
  filePath: string;
  content: string;
}

export interface IArchitectureViolation {
  filePath: string;
  message: string;
}

interface ILocation {
  service?: string;
  layer?: string;
  feature?: string;
  adapterDirection?: string;
}

const coreLayers = new Set(['domain', 'app', 'ports']);

const allowedLayers: Readonly<Record<string, ReadonlySet<string>>> = {
  domain: new Set(['domain']),
  ports: new Set(['ports', 'domain']),
  app: new Set(['app', 'ports', 'domain']),
  adapters: new Set(['ports', 'domain']),
};

const forbiddenCorePackages = /^(?:@nestjs\/|@apollo\/|@grpc\/|@bufbuild\/|@prisma\/|@sequelize\/|@nats-io\/|typeorm(?:\/|$)|sequelize(?:\/|$)|pg(?:\/|$)|prisma(?:\/|$)|nats(?:\/|$)|graphql(?:\/|$)|protobufjs(?:\/|$)|@sportsbook\/(?:contracts|.*-client|observability|testing|persistence|service-transport)(?:\/|$))/;

function normalize(filePath: string): string {
  return path.resolve(filePath).replaceAll('\\', '/');
}

function locate(filePath: string, root: string): ILocation {
  const relative = path.relative(root, filePath).replaceAll('\\', '/');
  const service = /^apps\/([^/]+)\//.exec(relative)?.[1];
  const match = /^apps\/[^/]+\/src\/(.*?)(domain|app|ports|adapters|infra)\//.exec(relative);

  return {
    ...(service ? { service } : {}),
    ...(match?.[2] ? { layer: match[2], feature: match[1] ?? '' } : {}),
    ...(match?.[2] === 'adapters' ? { adapterDirection: relative.split('/adapters/')[1]?.split('/')[0] ?? '' } : {}),
  };
}

function isLeafToken(source: ts.SourceFile): boolean {
  return source.statements.length > 0 && source.statements.every(statement =>
    ts.isVariableStatement(statement)
    && statement.declarationList.declarations.every(declaration => {
      const initializer = declaration.initializer;

      return initializer !== undefined && (
        ts.isStringLiteral(initializer)
        || (ts.isCallExpression(initializer)
          && ts.isIdentifier(initializer.expression)
          && initializer.expression.text === 'Symbol'
          && initializer.arguments.every(ts.isStringLiteral))
      );
    }),
  );
}

export function checkArchitecture(
  sources: readonly IArchitectureSource[],
  root: string,
  compilerOptions: ts.CompilerOptions = {},
): IArchitectureViolation[] {
  const files = new Map(sources.map(source => [normalize(source.filePath), source.content]));
  const violations: IArchitectureViolation[] = [];
  const host: ts.ModuleResolutionHost = {
    fileExists: filePath => files.has(normalize(filePath)) || existsSync(filePath),
    readFile: filePath => files.get(normalize(filePath)) ?? (existsSync(filePath) ? readFileSync(filePath, 'utf8') : undefined),
    directoryExists: directory => [...files.keys()].some(filePath => filePath.startsWith(`${normalize(directory)}/`)) || ts.sys.directoryExists(directory),
    getCurrentDirectory: () => root,
  };

  for (const source of sources) {
    const filePath = normalize(source.filePath);
    const location = locate(filePath, root);
    const ast = ts.createSourceFile(filePath, source.content, ts.ScriptTarget.Latest, true);
    const report = (message: string): void => { violations.push({ filePath: path.relative(root, filePath), message }); };
    const relativePath = path.relative(root, filePath).replaceAll('\\', '/');

    if (/(?:^|\/)presentation\//.test(relativePath)) report('presentation directories are forbidden');
    if (/(?:^|\/)application\//.test(relativePath)) report('use app instead of application');

    const inspectDependency = (specifier: string): void => {
      const resolved = ts.resolveModuleName(specifier, filePath, compilerOptions, host).resolvedModule?.resolvedFileName;
      const targetPath = resolved ? normalize(existsSync(resolved) ? realpathSync(resolved) : resolved) : specifier.startsWith('.') ? normalize(path.resolve(path.dirname(filePath), specifier)) : undefined;
      const target = targetPath ? locate(targetPath, root) : {};

      if (target.service && target.service !== location.service) report(`cross-service implementation import: ${specifier}`);
      if (specifier.startsWith('@sportsbook/') && /(?:^|\/)apps\/[^/]+\/src\//.test(specifier)) report(`cross-service source alias: ${specifier}`);
      if (location.layer && coreLayers.has(location.layer)
        && (forbiddenCorePackages.test(specifier) || /(?:^|\/)(?:generated|adapters|infra)\//.test(targetPath ?? specifier))) {
        report(`integration dependency in ${location.layer}: ${specifier}`);
      }
      if (location.layer && target.layer) {
        const isToken = location.layer === 'adapters' && target.layer === 'infra'
          && target.feature === location.feature && /\.tokens\.ts$/.test(targetPath ?? '');
        const tokenContent = targetPath ? host.readFile(targetPath) : undefined;
        const sameAdapter = location.layer === 'adapters' && target.layer === 'adapters'
          && location.feature === target.feature && location.adapterDirection === target.adapterDirection;

        if (isToken && (!tokenContent || !isLeafToken(ts.createSourceFile(targetPath ?? '', tokenContent, ts.ScriptTarget.Latest, true)))) {
          report(`token file must contain leaf constants only: ${specifier}`);
        } else if (!isToken && !sameAdapter && allowedLayers[location.layer] && !allowedLayers[location.layer]?.has(target.layer)) {
          report(`forbidden ${location.layer} -> ${target.layer} import: ${specifier}`);
        }
      }
      if (location.layer && location.layer !== 'infra' && targetPath && target.service === location.service && !target.layer) {
        report(`unclassified implementation dependency from ${location.layer}: ${specifier}`);
      }
      if (specifier.startsWith('.') && !resolved) report(`unresolved local import: ${specifier}`);
    };
    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) inspectDependency(node.moduleSpecifier.text);
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) inspectDependency(node.moduleReference.expression.text);
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) inspectDependency(node.argument.literal.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        const argument = node.arguments[0];

        if (argument && ts.isStringLiteral(argument)) inspectDependency(argument.text);
        else report('computed module imports are forbidden');
      }
      ts.forEachChild(node, visit);
    };

    visit(ast);
  }

  return violations;
}
