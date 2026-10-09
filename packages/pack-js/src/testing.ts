/** Test files for `js:test` and `--withTest`: `node:test`, or Vitest in a Vite project, in the project's style. */
import type { Action, Answers, Context } from '@codejen/jen';
import { fail, objectFields, splitTop } from './common.ts';
import { type Types, ext, importExt, source } from './style.ts';

export type Runner = 'node' | 'vitest';

export const RUNNER_PARAM = { runner: { default: '' } };

export const WITH_TEST_PARAMS = { withTest: { default: false }, ...RUNNER_PARAM };

/** `--runner`, else Vitest if the nearest package.json lists it or a Vite/Vitest config is around, else `node:test`. */
export function runnerFor(generator: string, answers: Answers, ctx: Context): Runner {
  const given = String(answers.runner ?? '');
  if (given === 'node' || given === 'vitest') return given;
  if (given) fail(`${generator} --runner: expected node or vitest, got "${given}"`);
  const pkg = ctx.findUp('package.json', undefined, ctx.destDir);
  if (pkg && /"vitest"\s*:/.test(ctx.read(pkg) ?? '')) return 'vitest';
  return ctx.grep(/^vite(st)?\.config\.[cm]?[jt]s$/).length > 0 ? 'vitest' : 'node';
}

export interface Assert {
  equal(actual: string, expected: string): string;
  deepEqual(actual: string, expected: string): string;
  ok(value: string): string;
  throws(fn: string, error: string): string;
}

const ASSERT: Record<Runner, Assert> = {
  node: {
    equal: (a, b) => `assert.equal(${a}, ${b});`,
    deepEqual: (a, b) => `assert.deepEqual(${a}, ${b});`,
    ok: (v) => `assert.ok(${v});`,
    throws: (fn, e) => `assert.throws(${fn}, ${e});`,
  },
  vitest: {
    equal: (a, b) => `expect(${a}).toBe(${b});`,
    deepEqual: (a, b) => `expect(${a}).toEqual(${b});`,
    ok: (v) => `expect(${v}).toBe(true);`,
    throws: (fn, e) => `expect(${fn}).toThrow(${e});`,
  },
};

export interface TestSpec {
  /** The module under test, relative to the test file, without extension: `timer`. */
  module: string;
  imports: string[];
  describe: string;
  tests: { name: string; body: (assert: Assert) => string[] }[];
}

export function testSource(types: Types, runner: Runner, importExtension: string, spec: TestSpec): string {
  const header =
    runner === 'node' ? ["import assert from 'node:assert/strict';", "import { describe, it } from 'node:test';"] : ["import { describe, expect, it } from 'vitest';"];
  const imports = spec.imports.length ? `{ ${spec.imports.join(', ')} }` : `* as ${spec.describe.replace(/\W/g, '_')}`;
  const tests = spec.tests.map(
    (t) => `  it('${t.name.replaceAll("'", "\\'")}', () => {\n${t.body(ASSERT[runner]).map((line) => `    ${line}`).join('\n')}\n  });`,
  );
  return source(
    types,
    `${header.join('\n')}
import ${imports} from './${spec.module}${importExtension}';

describe('${spec.describe}', () => {
${tests.join('\n\n')}
});
`,
  );
}

/** The action adding `<module>.test.ts` (or `.js`) next to the module. */
export function testAction(generator: string, answers: Answers, ctx: Context, types: Types, spec: TestSpec): Action {
  const runner = runnerFor(generator, answers, ctx);
  return { add: `${spec.module}.test${ext(types)}`, template: testSource(types, runner, importExt(ctx, types), spec) };
}

/** Something of `type` for a test to pass in: plain values for the types it knows, else a cast. */
export function sample(type: string | null, types: Types): string {
  const t = (type ?? 'unknown').trim();
  const fields = objectFields(t);
  if (fields) return fields.length ? `{ ${fields.map((f) => `${f.name}: ${sample(f.type, types)}`).join(', ')} }` : '{}';
  if (t === 'string') return "''";
  if (t === 'number') return '0';
  if (t === 'boolean') return 'false';
  if (t === 'bigint') return '0n';
  if (t === 'null') return 'null';
  if (t === 'undefined' || t === 'void' || t === 'unknown' || t === 'any') return 'undefined';
  if (/\[\]$/.test(t) || /^(Readonly)?Array</.test(t)) return '[]';
  const union = splitTop(t.replaceAll('|', ','));
  if (union.length > 1) return sample(union[0], types);
  if (/^(['"`]).*\1$/.test(t) || /^-?\d/.test(t)) return t;
  return types === 'ts' ? 'undefined as never' : types === 'jsdoc' ? `/** @type {never} */ (undefined)` : 'undefined';
}
