/** `js:test`: a test file for an existing module, with a first test per export it finds. */
import type { Generator } from '@codejen/jen';
import { posix } from 'node:path';
import { fail } from './common.ts';
import { TYPES_PARAM, typesFor } from './style.ts';
import { RUNNER_PARAM, testAction } from './testing.ts';

/** Named exports of a module's source: functions and classes, then other values. */
export function exportsOf(text: string): { name: string; callable: boolean }[] {
  const found = [...text.matchAll(/^export\s+(?:async\s+)?(function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)];
  return found.map((m) => ({ name: m[2], callable: m[1] !== 'const' && m[1] !== 'let' && m[1] !== 'var' }));
}

const testGenerator: Generator = {
  description: 'create a test file for a module: node:test, or Vitest in a Vite project',
  params: {
    name: {},
    ...RUNNER_PARAM,
    ...TYPES_PARAM,
  },
  actions: (answers, { kebab, camel }, ctx) => {
    const types = typesFor('js:test', answers, ctx);
    const module = kebab(String(answers.name).replace(/\.[cm]?[jt]s$/, ''));
    if (!module) fail('js:test --name: needs the module to test, e.g. --name=format-date');
    const text = ['.ts', '.js'].map((e) => ctx.read(posix.join(ctx.destDir, `${module}${e}`))).find((t) => t !== null) ?? null;
    const exported = text ? exportsOf(text) : [];
    const name = camel(module);
    return [
      testAction('js:test', answers, ctx, types, {
        module,
        imports: exported.map((e) => e.name),
        describe: exported.length ? module : name,
        tests: exported.length
          ? exported.map((e) => ({
              name: e.callable ? `${e.name} is callable` : `exports ${e.name}`,
              body: (a) => [e.callable ? a.equal(`typeof ${e.name}`, "'function'") : a.ok(`${e.name} !== undefined`)],
            }))
          : [{ name: 'exists', body: (a) => [a.ok(`typeof ${name} === 'object'`)] }],
      }),
    ];
  },
};

export default testGenerator;
