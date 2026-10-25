/** `web:esbuild`: a new vanilla project bundled by esbuild, in its own directory, at the latest versions. */
import type { Action, Generator } from '@codejen/jen';
import { join } from 'node:path';
import { fail } from './common.ts';
import { latest } from './npm.ts';
import { NAME_PARAM, projectName } from './project.ts';
import { ext, source, testSource, typesFor } from '@codejen/jen/js';
import { styled } from './styled.ts';
import { fill, template } from './templates.ts';

const esbuildGenerator: Generator = {
  description: 'create a new project bundled by esbuild, in its own directory',
  params: {
    ...NAME_PARAM,
    types: { default: 'none', choices: ['ts', 'jsdoc', 'none'], description: 'none: plain JavaScript' },
    withTest: { default: false, description: 'add a test setup and a first test' },
    runner: { default: 'node', choices: ['node', 'vitest'], description: 'test runner (node: node:test)' },
  },
  examples: ['--name=tool', '--name=tool --types=ts --withTest --runner=vitest'],
  actions: (answers, helpers, ctx) => {
    const name = projectName('web:esbuild', answers, helpers, ctx);
    // A new project starts plain, whatever tsconfig.json is around it.
    const types = typesFor('web:esbuild', { types: answers.types || 'none' }, ctx);
    const runner = String(answers.runner || 'node');
    if (runner !== 'node' && runner !== 'vitest') fail(`web:esbuild --runner: expected node or vitest, got "${runner}"`);
    const test = answers.withTest ? runner : null;
    const e = ext(types);
    const cwd = join(ctx.root, ctx.destDir);
    const versions = (names: string[]) => Object.fromEntries(names.sort().map((n) => [n, latest('web:esbuild', n, cwd)]));

    // esbuild only strips types; `check` runs the type checker.
    const bundle = `esbuild src/main${e} src/style.css --bundle --outdir=dist`;
    const scripts = {
      dev: `${bundle} --watch --servedir=.`,
      build: bundle,
      ...(types === 'ts' && { check: 'tsc' }),
      ...(test && { test: test === 'vitest' ? 'vitest' : 'node --test' }),
    };
    const devDependencies = [
      'esbuild',
      ...(types === 'ts' ? ['typescript'] : []),
      ...(test === 'vitest' ? ['vitest'] : test === 'node' && types !== 'none' ? ['@types/node'] : []),
    ];
    const pkg = { name, private: true, version: '0.0.0', type: 'module', scripts, devDependencies: versions(devDependencies) };

    // Relative imports end in the file's own extension: esbuild takes `.ts`, and so does Node for tests.
    const compilerOptions = {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ES2022', 'DOM'],
      types: test === 'node' ? ['node'] : [],
      strict: true,
      ...(types === 'ts' ? { noEmit: true, allowImportingTsExtensions: true, verbatimModuleSyntax: true } : { checkJs: true }),
      skipLibCheck: true,
    };
    const config: Action[] =
      types === 'none' ? [] : [{ add: `${name}/${types === 'ts' ? 'tsconfig' : 'jsconfig'}.json`, template: `${JSON.stringify({ compilerOptions, include: ['src'] }, null, 2)}\n` }];

    return [
      { add: `${name}/package.json`, template: `${JSON.stringify(pkg, null, 2)}\n` },
      { add: `${name}/index.html`, template: fill(template('esbuild/index.html'), { title: name }) },
      { add: `${name}/.gitignore`, template: template('esbuild/gitignore') },
      { add: `${name}/src/style.css`, template: template('esbuild/style.css') },
      { add: `${name}/src/main${e}`, template: source(types, fill(template('esbuild/main.ts'), { ext: e })) },
      { add: `${name}/src/counter${e}`, template: styled('esbuild/counter', types) },
      ...(test
        ? [
            {
              add: `${name}/src/counter.test${e}`,
              template: testSource(types, test, e, {
                module: 'counter',
                imports: ['setupCounter'],
                describe: 'setupCounter',
                tests: [{ name: 'is a function', body: (a) => [a.equal('typeof setupCounter', "'function'")] }],
              }),
            },
          ]
        : []),
      ...config,
    ];
  },
};

export default esbuildGenerator;
