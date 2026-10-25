/**
 * Tests for @codejen/pack-js – style detection, the three output styles, and
 * each generator's actions against a small in-memory project (a stand-in for
 * jen's Context, so the tests don't need jen's dist built first).
 */
import assert from 'node:assert/strict';
import { posix } from 'node:path';
import { describe, it } from 'node:test';
import type { Action, Answers, Context, Helpers } from '@codejen/jen';
import pack from './src/index.ts';
import { detectTypes, formatType, importExt, parseNamed, sample, splitTop, stripTypes } from '@codejen/jen/js';
import { exportsOf } from './src/test.ts';

const words = (s: string): string[] => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_\-./]+/).filter(Boolean);
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);
const pascal = (s: string) => words(s).map(cap).join('');
/** The jen helpers these generators use. */
const helpers = {
  pascal,
  camel: (s: string) => pascal(s).charAt(0).toLowerCase() + pascal(s).slice(1),
  kebab: (s: string) => words(s).map((w) => w.toLowerCase()).join('-'),
} as Helpers;

/** A Context over an in-memory project; `destDir` is where the user stands (or --dir). */
function context(files: Record<string, string>, destDir = '.'): Context {
  const paths = Object.keys(files);
  return {
    root: '/project',
    cwd: destDir,
    destDir,
    exists: (p) => p in files,
    isDir: (p) => paths.some((f) => f.startsWith(`${p}/`)),
    read: (p) => files[p.replace(/^\//, '')] ?? null,
    readdir: (dir) =>
      [...new Set(paths.filter((f) => dir === '.' || f.startsWith(`${dir}/`)).map((f) => (dir === '.' ? f : f.slice(dir.length + 1)).split('/')[0]))].sort(),
    findUp: (name, text, from = '.') => {
      for (let dir = from; ; dir = posix.dirname(dir)) {
        const file = dir === '.' ? name : `${dir}/${name}`;
        if (file in files && (!text || files[file].includes(text))) return file;
        if (dir === '.') return null;
      }
    },
    grep: (name, text) =>
      paths
        .filter((f) => (typeof name === 'string' ? posix.basename(f) === name : name.test(posix.basename(f))))
        .filter((f) => !text || files[f].includes(text))
        .sort((a, b) => a.split('/').length - b.split('/').length),
  };
}

function run(generator: string, answers: Answers, ctx: Context = context({})): Action[] {
  const g = pack[generator];
  const defaults = Object.fromEntries(Object.entries(g.params ?? {}).map(([k, p]) => [k, p.default]));
  return g.actions({ ...defaults, ...answers }, helpers, ctx);
}

const added = (actions: Action[]) => actions.flatMap((a) => ('add' in a ? [a.add] : []));
const template = (actions: Action[], file: string) => {
  const a = actions.find((x) => 'add' in x && x.add === file);
  return a && 'template' in a ? a.template : assert.fail(`no ${file} added`);
};

const TS_PROJECT = { 'tsconfig.json': '{ "compilerOptions": { "strict": true } }' };

describe('output styles', () => {
  it('follows the nearest tsconfig.json or jsconfig.json', () => {
    assert.equal(detectTypes(context({})), 'none');
    assert.equal(detectTypes(context(TS_PROJECT)), 'ts');
    assert.equal(detectTypes(context({ 'jsconfig.json': '{}' })), 'jsdoc');
    assert.equal(detectTypes(context({ 'tsconfig.json': '{ "compilerOptions": { "checkJs": true } }' })), 'jsdoc');
    assert.equal(detectTypes(context({ ...TS_PROJECT, 'web/jsconfig.json': '{}' }, 'web/src')), 'jsdoc', 'the nearer config wins');
    assert.equal(detectTypes(context({ 'jsconfig.json': '{}', 'app/tsconfig.json': '{}' }, 'app')), 'ts');
  });

  it('takes --types over detection, and refuses unknown styles', () => {
    assert.deepEqual(added(run('module', { name: 'x', types: 'jsdoc' }, context(TS_PROJECT))), ['x.js']);
    assert.deepEqual(added(run('module', { name: 'x' }, context(TS_PROJECT))), ['x.ts']);
    assert.throws(() => run('module', { name: 'x', types: 'flow' }), /js:module --types: expected ts, jsdoc or none, got "flow"/);
  });

  it('imports .ts files only where the tsconfig allows it', () => {
    assert.equal(importExt(context(TS_PROJECT), 'ts'), '.js');
    assert.equal(importExt(context({ 'tsconfig.json': '{ "compilerOptions": { "allowImportingTsExtensions": true } }' }), 'ts'), '.ts');
    assert.equal(importExt(context({ 'tsconfig.json': '{ "rewriteRelativeImportExtensions": true }' }), 'ts'), '.ts');
    assert.equal(importExt(context({}), 'none'), '.js');
  });

  it('strips JSDoc types for plain JavaScript, keeping other comments', () => {
    const js = `// @ts-check
// A real comment.
/** @typedef {{ a: number }} A */

/**
 * @param {A} a
 * @returns {number}
 */
export function f(a) {
  const n = /** @type {number} */ (a.a);
  const el = /** @type {HTMLElement} */ (document.querySelector('x'));
  /** @type {string[]} */
  const list = [];
  return n + list.length + (el ? 1 : 0);
}
`;
    assert.equal(
      stripTypes(js),
      `// A real comment.

export function f(a) {
  const n = a.a;
  const el = (document.querySelector('x'));
  const list = [];
  return n + list.length + (el ? 1 : 0);
}
`,
    );
  });
});

describe('list params', () => {
  it('splits on top-level commas only, arrows included', () => {
    assert.deepEqual(splitTop('a:{x:number,y:number},b:Map<string,number>,c:(n:number)=>void'), ['a:{x:number,y:number}', 'b:Map<string,number>', 'c:(n:number)=>void']);
  });

  it('parses names with optional types and refuses duplicates', () => {
    assert.deepEqual(parseNamed('size:number, label', '--attrs'), [
      { name: 'size', type: 'number' },
      { name: 'label', type: null },
    ]);
    assert.throws(() => parseNamed('a,a', '--attrs'), /--attrs: "a" is listed twice/);
    assert.throws(() => parseNamed('1x', '--attrs'), /--attrs: "1x" is not a valid name/);
  });

  it('formats types and makes samples of them', () => {
    assert.equal(formatType('{value:number,ok?:boolean}'), '{ value: number, ok?: boolean }');
    assert.equal(formatType('  {  a :  string ;b:{c:number} }  '), '{ a: string; b: { c: number } }');
    assert.equal(formatType('{ }'), '{}');
    assert.equal(formatType('(n:number)=>void'), '(n: number)=>void');
    const start = performance.now();
    for (const hostile of [' '.repeat(100_000), `{${' '.repeat(100_000)}x`, `a${' \t'.repeat(50_000)}b`]) formatType(hostile);
    assert.ok(performance.now() - start < 1000, 'no quadratic backtracking');
    assert.equal(sample('{ value: number, tags: string[], kind: "a" | "b" }', 'ts'), `{ value: 0, tags: [], kind: "a" }`);
    assert.equal(sample('Date', 'ts'), 'undefined as never');
    assert.equal(sample('Date', 'jsdoc'), '/** @type {never} */ (undefined)');
  });
});

describe('type patterns', () => {
  it('js:class has #private fields, getters, create() and Symbol.dispose', () => {
    const ts = template(run('class', { name: 'timer', fields: 'id:number,label:string', disposable: true }, context(TS_PROJECT)), 'timer.ts');
    assert.match(ts, /export interface TimerOptions \{\n {2}id: number;\n {2}label: string;\n\}/);
    assert.match(ts, /export class Timer implements Disposable \{\n {2}#id: number;\n {2}#label: string;\n {2}#disposed = false;/);
    assert.match(ts, /constructor\(\{ id, label \}: TimerOptions\) \{/);
    assert.match(ts, /static create\(options: TimerOptions\): Timer \{/);
    assert.match(ts, /\[Symbol\.dispose\]\(\): void \{/);
    const bare = template(run('class', { name: 'thing' }, context(TS_PROJECT)), 'thing.ts');
    assert.doesNotMatch(bare, /constructor|Options|dispose/);
  });

  it('js:enum is an as-const object with its union type and a guard', () => {
    const ts = template(run('enum', { name: 'direction', values: 'up,top-left' }, context(TS_PROJECT)), 'direction.ts');
    assert.match(ts, /export const Direction = \{\n {2}Up: 'up',\n {2}TopLeft: 'top-left',\n\} as const;/);
    assert.match(ts, /export type Direction = \(typeof Direction\)\[keyof typeof Direction\];/);
    assert.match(ts, /export function isDirection\(value: unknown\): value is Direction/);
    assert.doesNotMatch(template(run('enum', { name: 'direction', values: 'up' }), 'direction.js'), /as const|@type/);
    assert.throws(() => run('enum', { name: 'direction', values: '' }), /needs at least one value/);
  });

  it('js:union checks its switch for exhaustiveness via never', () => {
    const ts = template(run('union', { name: 'shape', cases: 'circle:{radius:number},empty' }, context(TS_PROJECT)), 'shape.ts');
    assert.match(ts, /export interface Circle \{\n {2}kind: 'circle';\n {2}radius: number;\n\}/);
    assert.match(ts, /export type Shape = Circle \| Empty;/);
    assert.match(ts, /default:\n {6}return assertNever\(shape\);/);
    assert.match(ts, /function assertNever\(value: never\): never/);
    assert.throws(() => run('union', { name: 'shape', cases: 'circle:number,b' }), /circle has "number" – a case's fields go in braces/);
    assert.throws(() => run('union', { name: 'shape', cases: 'circle' }), /needs at least two cases/);
  });

  it('js:brand brands its underlying type behind a guard', () => {
    const ts = template(run('brand', { name: 'user-id' }, context(TS_PROJECT)), 'user-id.ts');
    assert.match(ts, /declare const brand: unique symbol;\n\nexport type UserId = string & \{ readonly \[brand\]: 'UserId' \};/);
    assert.match(ts, /export function userId\(value: string\): UserId \{/);
    assert.match(template(run('brand', { name: 'meters', underlying: 'number' }), 'meters.js'), /Number\.isFinite\(value\)/);
    assert.throws(() => run('brand', { name: 'x', underlying: 'Date' }), /--underlying: expected string, number or bigint/);
  });

  it('js:error names its class …Error and passes the cause on', () => {
    const actions = run('error', { name: 'not-found', fields: 'path:string' }, context(TS_PROJECT));
    const ts = template(actions, 'not-found-error.ts');
    assert.match(ts, /export interface NotFoundErrorOptions extends ErrorOptions \{\n {2}path: string;\n\}/);
    assert.match(ts, /override name = 'NotFoundError';\n {2}readonly path: string;/);
    assert.match(ts, /constructor\(message: string, \{ path, \.\.\.options \}: NotFoundErrorOptions\) \{\n {4}super\(message, options\);/);
    assert.deepEqual(added(run('error', { name: 'ParseError' })), ['parse-error.js']);
    assert.throws(() => run('error', { name: 'x', fields: 'cause:Error' }), /already on every Error/);
  });

  it('js:emitter is an EventTarget with a typed event map', () => {
    const ts = template(run('emitter', { name: 'store', events: 'change:{value:number}' }, context(TS_PROJECT)), 'store.ts');
    assert.match(ts, /export class Store extends EventTarget \{/);
    assert.match(ts, /new CustomEvent\(type, \{ detail \}\)/);
    assert.throws(() => run('emitter', { name: 'store', events: '' }), /needs at least one event/);
  });
});

describe('tests', () => {
  it('--withTest writes node:test, or Vitest in a Vite project', () => {
    const node = template(run('enum', { name: 'direction', values: 'up', withTest: true }, context(TS_PROJECT)), 'direction.test.ts');
    assert.match(node, /^import assert from 'node:assert\/strict';\nimport \{ describe, it \} from 'node:test';\nimport \{ Direction, isDirection \} from '\.\/direction\.js';/);
    assert.match(node, /assert\.equal\(Direction\.Up, 'up'\);/);
    const viteConfig = context({ ...TS_PROJECT, 'vite.config.ts': '' });
    assert.match(template(run('enum', { name: 'direction', values: 'up', withTest: true }, viteConfig), 'direction.test.ts'), /expect\(Direction\.Up\)\.toBe\('up'\);/);
    const viaPackage = context({ 'package.json': '{ "devDependencies": { "vitest": "^3.0.0" } }' });
    assert.match(template(run('module', { name: 'x', withTest: true }, viaPackage), 'x.test.js'), /from 'vitest'/);
    assert.match(template(run('module', { name: 'x', withTest: true, runner: 'node' }, viaPackage), 'x.test.js'), /from 'node:test'/);
    assert.throws(() => run('module', { name: 'x', withTest: true, runner: 'jest' }), /--runner: expected node or vitest/);
  });

  it('js:test finds the module\'s exports', () => {
    assert.deepEqual(exportsOf('export function a() {}\nexport async function b() {}\nexport class C {}\nexport const d = 1;\nconst e = 2;'), [
      { name: 'a', callable: true },
      { name: 'b', callable: true },
      { name: 'C', callable: true },
      { name: 'd', callable: false },
    ]);
    const ctx = context({ ...TS_PROJECT, 'src/format.ts': 'export function format() {}\nexport const PATTERN = 1;\n' }, 'src');
    const test = template(run('test', { name: 'format' }, ctx), 'format.test.ts');
    assert.match(test, /import \{ format, PATTERN \} from '\.\/format\.js';/);
    assert.match(test, /assert\.equal\(typeof format, 'function'\);/);
    assert.match(template(run('test', { name: 'missing' }), 'missing.test.js'), /import \* as missing from '\.\/missing\.js';/);
  });
});


// ─── Param descriptions ─────────────────────────────────────────────────────

/** Params that say what they're for by their name alone: the required name, and namespace. */
const selfExplanatory = (param: string, spec: { default?: unknown }): boolean =>
  (param === 'name' && spec.default === undefined) || param === 'namespace';

describe('param descriptions', () => {
  for (const [gen, g] of Object.entries(pack)) {
    it(`${gen}: every param says what it's for`, () => {
      const missing = Object.entries(g.params ?? {})
        .filter(([param, spec]) => !selfExplanatory(param, spec) && !spec.description?.trim())
        .map(([param]) => `--${param}`);
      assert.deepEqual(missing, []);
    });
  }
});

// ─── Examples ───────────────────────────────────────────────────────────────

/** The flags of an example call: `--name=Foo --moveOnly --members="int a, int b"` → { name: 'Foo', moveOnly: true, members: 'int a, int b' }. */
const exampleFlags = (args: string): Record<string, string | true> =>
  Object.fromEntries([...args.matchAll(/--([\w-]+)(?:=("[^"]*"|\S*))?/g)].map(([, k, v]) => [k, v === undefined ? true : v.replace(/^"(.*)"$/, '$1')]));

describe('examples', () => {
  for (const [gen, g] of Object.entries(pack)) {
    it(`${gen}: has examples that run as written`, () => {
      const params = g.params ?? {};
      assert.ok(g.examples?.length, 'no examples');
      for (const args of g.examples ?? []) {
        const flags = exampleFlags(args);
        for (const [flag, value] of Object.entries(flags)) {
          if (flag === 'dir' && !('dir' in params)) continue;
          assert.ok(flag in params, `${args}: no --${flag}`);
          const choices = params[flag].choices;
          if (choices) assert.ok(choices.includes(String(value)), `${args}: --${flag} takes ${choices.join(', ')}`);
        }
        const missing = Object.keys(params).filter((p) => params[p].default === undefined && !(p in flags));
        assert.deepEqual(missing, [], args);
      }
    });
  }
});
