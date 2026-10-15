import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../../', import.meta.url));

const options = { cwd: root };

const lint = new ESLint(options);

const fix = new ESLint({ ...options, fix: true });

const extensions = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'];

for (const extension of extensions) {
  test(
    `compressed ${extension} source fails and fixes are stable`,
    async () => {
      const typed = ['ts', 'mts', 'cts'].includes(extension);
      const signature = typed ? '(): number' : '()';
      const source = `function read${signature} {const value = 1;\n\nreturn value;}\n\nread();\n`;
      const filePath = path.join(root, 'tools/lint/fixtures', `readability.${extension}`);
      const [result] = await lint.lintText(source, { filePath });

      assert.ok(result.messages.some(message => message.ruleId === '@stylistic/brace-style'));
      assert.ok(result.errorCount > 0);
      const [formatted] = await fix.lintText(source, { filePath });
      const output = formatted.output ?? source;
      const [checked] = await lint.lintText(output, { filePath });
      const [repeated] = await fix.lintText(output, { filePath });

      assert.equal(checked.errorCount, 0, JSON.stringify(checked.messages));
      assert.equal(repeated.output ?? output, output);
      assert.match(output, /\{\n {2}const value = 1;/);
    },
  );
  test(
    `${extension} rejects multiple statements and unbraced branches`,
    async () => {
      const filePath = path.join(root, 'tools/lint/fixtures', `readability.${extension}`);
      const [result] = await lint.lintText(
        'console.log(1); console.log(2);\nif (true) console.log(3);\n',
        {
          filePath,
        },
      );

      assert.ok(
        result.messages.some(message => message.ruleId === '@stylistic/max-statements-per-line'),
      );
      assert.ok(result.messages.some(message => message.ruleId === 'curly'));
    },
  );
}

test(
  'long code lines fail even when they contain a short string',
  async () => {
    const [result] = await lint.lintText(
      `console.log('short', ${Array(30).fill('1234').join(', ')});\n`,
      {
        filePath: path.join(root, 'tools/lint/fixture.mjs'),
      },
    );

    assert.ok(result.messages.some(message => message.ruleId === '@stylistic/max-len'));
  },
);

test(
  'existing owner rules retain their exact options',
  async () => {
    const config = await lint.calculateConfigForFile(path.join(root, 'tools/lint/fixture.ts'));
    const names = [
      '@stylistic/array-bracket-spacing',
      '@stylistic/comma-dangle',
      '@stylistic/comma-spacing',
      '@stylistic/keyword-spacing',
      '@stylistic/lines-between-class-members',
      '@stylistic/no-multi-spaces',
      '@stylistic/no-multiple-empty-lines',
      '@stylistic/object-curly-newline',
      '@stylistic/object-property-newline',
      '@stylistic/operator-linebreak',
      '@stylistic/padding-line-between-statements',
      '@stylistic/quotes',
      '@stylistic/space-before-blocks',
      '@stylistic/space-infix-ops',
      '@typescript-eslint/ban-ts-comment',
      '@typescript-eslint/consistent-type-assertions',
      '@typescript-eslint/consistent-type-definitions',
      '@typescript-eslint/consistent-type-imports',
      '@typescript-eslint/explicit-function-return-type',
      '@typescript-eslint/no-array-constructor',
      '@typescript-eslint/no-duplicate-enum-values',
      '@typescript-eslint/no-empty-object-type',
      '@typescript-eslint/no-explicit-any',
      '@typescript-eslint/no-extra-non-null-assertion',
      '@typescript-eslint/no-misused-new',
      '@typescript-eslint/no-namespace',
      '@typescript-eslint/no-non-null-asserted-optional-chain',
      '@typescript-eslint/no-require-imports',
      '@typescript-eslint/no-this-alias',
      '@typescript-eslint/no-unnecessary-type-constraint',
      '@typescript-eslint/no-unsafe-declaration-merging',
      '@typescript-eslint/no-unsafe-function-type',
      '@typescript-eslint/no-unused-expressions',
      '@typescript-eslint/no-unused-vars',
      '@typescript-eslint/no-wrapper-object-types',
      '@typescript-eslint/prefer-as-const',
      '@typescript-eslint/prefer-namespace-keyword',
      '@typescript-eslint/prefer-optional-chain',
      '@typescript-eslint/triple-slash-reference',
      'max-len',
      'no-array-constructor',
      'no-restricted-syntax',
      'no-undef',
      'no-unused-expressions',
      'no-unused-vars',
      'padding-line-between-statements',
      'simple-import-sort/exports',
      'simple-import-sort/imports',
    ];
    const rules = Object.fromEntries(names.map(name => [name, config.rules[name]]));
    const hash = createHash('sha256').update(JSON.stringify(rules)).digest('hex');

    assert.equal(hash, '52047d3738b7c25e91ce4042951be1ab6543ebdee399e36af476447c15a93849');
  },
);
