import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import type { IArchitectureSource } from './architecture.policy.js';
import { checkArchitecture } from './architecture.policy.js';

function collect(directory: string): IArchitectureSource[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return ['node_modules', 'dist', 'test', 'generated'].includes(entry.name) ? [] : collect(filePath);
    }

    return /\.[cm]?ts$/.test(entry.name) && !/\.(?:test|spec|d)\.ts$/.test(entry.name)
      ? [{ filePath, content: readFileSync(filePath, 'utf8') }]
      : [];
  });
}

const root = process.cwd();

const config = ts.readConfigFile(path.join(root, 'tsconfig.eslint.json'), ts.sys.readFile);

if (config.error) {
  throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
}

const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);

if (parsed.errors.length > 0) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  }));
}

const violations = checkArchitecture([
  ...collect(path.join(root, 'apps')),
  ...collect(path.join(root, 'packages')),
], root, parsed.options);

for (const violation of violations) {
  console.error(`${violation.filePath}: ${violation.message}`);
}

if (violations.length > 0) {
  process.exitCode = 1;
} else {
  console.log('Architecture boundaries passed.');
}
