/**
 * Tests for pack-web's script generators – projects, web components and keyboard
 * patterns – against a small in-memory project, like pack-js's own tests.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, posix } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { Action, Answers, Context, Helpers } from '@codejen/jen';
import { detectTypes, runnerFor } from '@codejen/jen/js';
import pack from './src/index.ts';
import { styled } from './src/styled.ts';
import { templatesIn } from './src/vite.ts';

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
  const actions = g.actions({ ...defaults, ...answers }, helpers, ctx);
  assert.ok(Array.isArray(actions), `${generator} runs synchronously`);
  return actions;
}

const added = (actions: Action[]) => actions.flatMap((a) => ('add' in a ? [a.add] : []));
const inserts = (actions: Action[]) => actions.flatMap((a) => ('insert' in a ? [a] : []));
const template = (actions: Action[], file: string) => {
  const a = actions.find((x) => 'add' in x && x.add === file);
  return a && 'template' in a ? a.template : assert.fail(`no ${file} added`);
};

const TS_PROJECT = { 'tsconfig.json': '{ "compilerOptions": { "strict": true } }' };
const JSDOC = /@(param|type|typedef|returns|template|ts-check)\b/;

describe('web:element', () => {
  const answers = { name: 'my-counter', attrs: 'count:number,label,open:boolean,max-value:number', events: 'change:{value:number},close' };

  it('reflects typed attributes through getters and setters', () => {
    const ts = template(run('element', answers, context(TS_PROJECT)), 'my-counter.ts');
    assert.match(ts, /static observedAttributes = \['count', 'label', 'open', 'max-value'\] as const;/);
    assert.match(ts, /get count\(\): number \{\n {4}return Number\(this\.getAttribute\('count'\) \?\? 0\);/);
    assert.match(ts, /set open\(value: boolean\) \{\n {4}this\.toggleAttribute\('open', value\);/);
    assert.match(ts, /get maxValue\(\): number/);
    assert.match(ts, /attributeChangedCallback\(_name: MyCounterAttribute, oldValue: string \| null, newValue: string \| null\): void/);
    assert.match(ts, /customElements\.define\('my-counter', MyCounter\);/);
    assert.match(ts, /declare global \{\n {2}interface HTMLElementTagNameMap \{\n {4}'my-counter': MyCounter;/);
  });

  it('types its events, and emit() takes no detail where there is none', () => {
    const ts = template(run('element', answers, context(TS_PROJECT)), 'my-counter.ts');
    assert.match(ts, /export interface MyCounterEventMap \{\n {2}change: CustomEvent<\{ value: number \}>;\n {2}close: CustomEvent<void>;\n\}/);
    assert.match(ts, /emit<K extends keyof MyCounterEventMap>\(type: K, \.\.\.\[detail\]: MyCounterEventMap\[K\]\['detail'\] extends void \? \[\] : \[MyCounterEventMap\[K\]\['detail'\]\]\)/);
    assert.match(ts, /bubbles: true, composed: true/);
    assert.match(ts, /override addEventListener<K extends keyof MyCounterEventMap>/);
  });

  it('writes JSDoc, with the tag in a shared elements.d.ts', () => {
    const actions = run('element', answers, context({ 'jsconfig.json': '{}' }, 'src/components'));
    const js = template(actions, 'my-counter.js');
    assert.match(js, /^\/\/ @ts-check\n/);
    assert.match(js, /static observedAttributes = \/\*\* @type \{const\} \*\/ \(\[/);
    assert.match(js, / \* @typedef \{\{\n \* {3}change: CustomEvent<\{ value: number \}>;/);
    assert.match(js, /@override/);
    assert.match(template(actions, 'elements.d.ts'), /interface HTMLElementTagNameMap \{\n {2}\/\/ jen:elements\n\}/);
    assert.deepEqual(inserts(actions), [{ insert: '/src/components/elements.d.ts', before: 'jen:elements', line: "'my-counter': import('./my-counter.js').MyCounter;" }]);
  });

  it('reuses an elements.d.ts further up', () => {
    const ctx = context({ 'jsconfig.json': '{}', 'src/elements.d.ts': 'interface HTMLElementTagNameMap {\n  // jen:elements\n}\n' }, 'src/ui');
    const actions = run('element', { name: 'x-y' }, ctx);
    assert.deepEqual(added(actions), ['x-y.js']);
    assert.deepEqual(inserts(actions), [{ insert: '/src/elements.d.ts', before: 'jen:elements', line: "'x-y': import('./ui/x-y.js').XY;" }]);
  });

  it('writes plain JavaScript without types or a tag map', () => {
    const actions = run('element', answers);
    const js = template(actions, 'my-counter.js');
    assert.doesNotMatch(js, JSDOC);
    assert.doesNotMatch(js, /addEventListener|EventMap/);
    assert.match(js, /emit\(type, \.\.\.args\) \{\n {4}const \[detail\] = args;/);
    assert.deepEqual(added(actions), ['my-counter.js']);
  });

  it('is light DOM by default, styled from the root it is in', () => {
    const ts = template(run('element', { name: 'x-light' }, context(TS_PROJECT)), 'x-light.ts');
    assert.doesNotMatch(ts, /attachShadow|:host|<slot>/);
    assert.match(ts, /x-light\[hidden\] \{/);
    assert.match(ts, /const root = \(this\.getRootNode\(\) as Document \| ShadowRoot\);/);
  });

  it('attaches a shadow root with --shadow=open or closed', () => {
    const open = template(run('element', { name: 'x-open', shadow: 'open' }), 'x-open.js');
    assert.match(open, /#root = this\.attachShadow\(\{ mode: 'open' \}\);/);
    assert.match(open, /this\.#root\.adoptedStyleSheets = \[sheet\];\n {4}this\.#root\.innerHTML = '<slot><\/slot>';/);
    assert.match(open, /:host\(\[hidden\]\) \{/);
    assert.doesNotMatch(open, /getRootNode/);
    assert.match(template(run('element', { name: 'x-closed', shadow: 'closed' }), 'x-closed.js'), /#root = this\.attachShadow\(\{ mode: 'closed' \}\);/);
  });

  it('is form-associated with --form, adding a value attribute', () => {
    const ts = template(run('element', { name: 'x-rating', attrs: 'max:number', form: true }, context(TS_PROJECT)), 'x-rating.ts');
    assert.match(ts, /static formAssociated = true;/);
    assert.match(ts, /#internals = this\.attachInternals\(\);/);
    assert.match(ts, /'max', 'value'\] as const/);
    assert.match(ts, /this\.#internals\.setFormValue\(this\.value\);/);
    const numeric = template(run('element', { name: 'x-rating', attrs: 'value:number', form: true }, context(TS_PROJECT)), 'x-rating.ts');
    assert.match(numeric, /setFormValue\(String\(this\.value\)\)/);
  });

  it('wires into a page or an entry module with --into', () => {
    const ctx = context({ ...TS_PROJECT, 'index.html': '<body>\n</body>\n', 'src/main.ts': "// @ts-check\nimport './style.css';\n" }, 'src/components');
    assert.deepEqual(inserts(run('element', { name: 'my-counter', into: '/index.html' }, ctx)), [
      { insert: '/index.html', before: /<\/body>/, line: '<my-counter></my-counter>' },
      { insert: '/index.html', before: /<\/body>/, line: '<script type="module" src="./src/components/my-counter.ts"></script>' },
    ]);
    const [line] = inserts(run('element', { name: 'my-counter', into: '/src/main.ts' }, ctx));
    assert.equal('line' in line && line.line, "import './components/my-counter.js';");
    const marker = line.before as RegExp;
    assert.deepEqual(['// @ts-check', '', ' * x', "import './style.css';"].map((l) => marker.test(l)), [false, false, false, true]);
  });

  it('refuses names that are not custom element names, and built-in attributes', () => {
    assert.throws(() => run('element', { name: 'counter' }), /web:element --name: "counter" is not a custom element name/);
    assert.throws(() => run('element', { name: 'x-y', attrs: 'hidden:boolean' }), /"hidden" is a built-in attribute/);
    assert.throws(() => run('element', { name: 'x-y', attrs: 'when:Date' }), /when is "Date" – attributes are string, number or boolean/);
    assert.throws(() => run('element', { name: 'x-y', shadow: 'yes' }), /--shadow: expected open, closed or none/);
  });
});

describe('keyboard patterns', () => {
  const FILES = { roving: 'roving-tabindex', menu: 'menu', 'grid-navigation': 'grid-navigation', hotkeys: 'hotkeys' };

  it('write one module each, in all three styles', () => {
    for (const [generator, file] of Object.entries(FILES)) {
      assert.deepEqual(added(run(generator, {}, context(TS_PROJECT))), [`${file}.ts`]);
      assert.match(template(run(generator, { types: 'jsdoc' }), `${file}.js`), /^\/\/ @ts-check\n\/\/ .*W3C/);
      const plain = template(run(generator, {}), `${file}.js`);
      assert.match(plain, /^\/\/ .*ARIA Authoring Practices Guide by the W3C: https:\/\/www\.w3\.org\/WAI\/ARIA\/apg\//, 'credits the APG');
      assert.doesNotMatch(plain, JSDOC);
      assert.doesNotMatch(plain, /\n\n\n/);
    }
  });

  it('web:roving hands the arrow keys to a native focusgroup, detected by its property, and keeps selecting itself', () => {
    for (const types of ['ts', 'jsdoc'] as const) {
      const source = styled('roving-tabindex', types);
      assert.match(source, /'focusGroup' in HTMLElement\.prototype/);
      assert.match(source, /adactio\.com\/journal\/22445/, 'credits Jeremy Keith');
      assert.match(source, /if \(!native\) \{\n\s+root\.addEventListener\(\n\s+'keydown'/);
      assert.match(source, /root\.setAttribute\('focusgroup'/);
    }
  });

  it('keep the TypeScript and JSDoc templates in step', () => {
    const exported = (text: string) => [...text.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
    for (const file of Object.values(FILES)) assert.deepEqual(exported(styled(file, 'jsdoc')), exported(styled(file, 'ts')), file);
  });

  it('hotkeys match modifiers, mod per platform, and symbols regardless of Shift', async () => {
    const { parseCombo, matches, keyLabels } = await import(String(new URL('./templates/hotkeys.js', import.meta.url)));
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    const key = (k: string, mods: Record<string, boolean> = {}, code = '') => ({ key: k, code, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });
    assert.ok(matches(parseCombo('mod+k'), key('k', mac ? { metaKey: true } : { ctrlKey: true })));
    assert.ok(!matches(parseCombo('mod+k'), key('k')));
    assert.ok(matches(parseCombo('?'), key('?', { shiftKey: true })));
    assert.ok(matches(parseCombo('shift+a'), key('A', { shiftKey: true })));
    assert.ok(!matches(parseCombo('a'), key('A', { shiftKey: true })));
    assert.ok(matches(parseCombo('alt+k'), key('˚', { altKey: true }, 'KeyK')), 'by physical key when Alt changes event.key');
    assert.ok(matches(parseCombo('esc'), key('Escape')));
    assert.throws(() => parseCombo('hyper+k'), /unknown modifier "hyper"/);
    assert.deepEqual(keyLabels('shift+k'), ['Shift', 'k']);
    assert.deepEqual(keyLabels('esc'), ['Esc']);
  });
});

describe('projects', () => {
  /** A stand-in for npm on PATH: logs its calls, prints versions and create-vite's help, and creates a project. */
  const FAKE_NPM = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify({ args, cwd: process.cwd() }) + '\\n');
if (args[0] === 'view') console.log('1.2.' + args[1].length);
else if (args.includes('--help')) console.log('Usage: create-vite\\n\\nAvailable templates:\\nvanilla-ts          vanilla\\nreact-ts            react\\n');
else {
  const name = args[3];
  fs.mkdirSync(name + '/public', { recursive: true });
  fs.writeFileSync(name + '/package.json', JSON.stringify({ name, template: args[args.indexOf('--template') + 1] }));
  fs.writeFileSync(name + '/public/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]));
}
`;
  let root = '';
  let log = '';
  const env = { PATH: process.env.PATH, JEN_NO_FETCH: process.env.JEN_NO_FETCH };
  before(() => {
    root = mkdtempSync(join(tmpdir(), 'pack-web-js-'));
    mkdirSync(join(root, 'bin'));
    writeFileSync(join(root, 'bin/npm'), FAKE_NPM, { mode: 0o755 });
    log = join(root, 'npm.log');
    process.env.FAKE_NPM_LOG = log;
    process.env.PATH = `${join(root, 'bin')}${delimiter}${env.PATH}`;
    delete process.env.JEN_NO_FETCH;
  });
  after(() => {
    process.env.PATH = env.PATH;
    if (env.JEN_NO_FETCH !== undefined) process.env.JEN_NO_FETCH = env.JEN_NO_FETCH;
    rmSync(root, { recursive: true, force: true });
  });
  beforeEach(() => writeFileSync(log, ''));
  const calls = () => readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as { args: string[]; cwd: string });
  /** A project in a real directory, so npm has somewhere to run. */
  const real = (files: Record<string, string> = {}, destDir = '.'): Context => ({ ...context(files, destDir), root });
  const pkg = (actions: Action[], dir: string) =>
    JSON.parse(template(actions, `${dir}/package.json`)) as { name: string; template: string; scripts: Record<string, string>; devDependencies: Record<string, string> };
  /** The files actions add, as a project for the next run. */
  const files = (actions: Action[]) => Object.fromEntries(actions.flatMap((a) => ('template' in a ? [[a.add, a.template]] : [])));

  it('web:vite runs npm create vite@latest and plans the files it makes', () => {
    const actions = run('vite', { name: 'Shop', framework: 'react', types: 'ts' }, real());
    assert.deepEqual(
      calls().map((c) => c.args.join(' ')),
      ['--yes create vite@latest -- --help', '--yes create vite@latest shop -- --template react-ts --no-interactive --no-immediate'],
    );
    assert.ok(!existsSync(calls()[0].cwd), 'the scratch directory is gone');
    assert.deepEqual(added(actions), ['shop/package.json', 'shop/public/logo.png']);
    assert.deepEqual(pkg(actions, 'shop'), { name: 'shop', template: 'react-ts' });
    const logo = actions.find((a) => 'add' in a && a.add === 'shop/public/logo.png');
    assert.ok(logo && 'bytes' in logo, 'binary files stay binary');
    assert.equal(pkg(run('vite', { name: 'shop' }, real()), 'shop').template, 'vanilla');
  });

  it('web:vite checks --framework against create-vite\'s own list, and --types', () => {
    assert.throws(() => run('vite', { name: 'shop', framework: 'angular' }, real()), /web:vite --framework: create-vite has no angular template; expected vanilla, react, got "angular"/);
    assert.throws(() => run('vite', { name: 'shop', types: 'jsdoc' }, real()), /create-vite has no JSDoc templates/);
    assert.throws(() => run('vite', { name: 'shop', types: 'flow' }, real()), /web:vite --types: expected ts or none, got "flow"/);
  });

  it('web:esbuild writes a vanilla project at the latest versions', () => {
    const actions = run('esbuild', { name: 'tool' }, real());
    assert.deepEqual(added(actions), ['tool/package.json', 'tool/index.html', 'tool/.gitignore', 'tool/src/style.css', 'tool/src/main.js', 'tool/src/counter.js']);
    assert.deepEqual(calls().map((c) => c.args.join(' ')), ['view esbuild version']);
    assert.deepEqual(pkg(actions, 'tool').devDependencies, { esbuild: '^1.2.7' });
    assert.deepEqual(pkg(actions, 'tool').scripts, { dev: 'esbuild src/main.js src/style.css --bundle --outdir=dist --watch --servedir=.', build: 'esbuild src/main.js src/style.css --bundle --outdir=dist' });
    assert.match(template(actions, 'tool/index.html'), /<link rel="stylesheet" href="dist\/style\.css">\n {4}<script type="module" src="dist\/main\.js"><\/script>/);
    assert.match(template(actions, 'tool/src/main.js'), /^import \{ setupCounter \} from '\.\/counter\.js';\n/);
    assert.doesNotMatch(template(actions, 'tool/src/counter.js'), JSDOC);
    assert.doesNotMatch(template(actions, 'tool/src/style.css'), /\dpx/);
    assert.ok(!('framework' in pack.esbuild.params!));
  });

  it('web:esbuild follows --types and ignores a tsconfig.json around it', () => {
    const ts = run('esbuild', { name: 'tool', types: 'ts', withTest: true }, real());
    assert.deepEqual(Object.keys(pkg(ts, 'tool').devDependencies), ['@types/node', 'esbuild', 'typescript']);
    assert.equal(pkg(ts, 'tool').scripts.check, 'tsc');
    assert.equal(pkg(ts, 'tool').scripts.test, 'node --test');
    assert.match(template(ts, 'tool/tsconfig.json'), /"allowImportingTsExtensions": true/);
    assert.match(template(ts, 'tool/src/counter.ts'), /export function setupCounter\(button: Element\): void/);
    assert.match(template(ts, 'tool/src/counter.test.ts'), /from 'node:test';\nimport \{ setupCounter \} from '\.\/counter\.ts';/);
    const jsdoc = run('esbuild', { name: 'tool', types: 'jsdoc' }, real());
    assert.match(template(jsdoc, 'tool/jsconfig.json'), /"checkJs": true/);
    assert.match(template(jsdoc, 'tool/src/counter.js'), /^\/\/ @ts-check\n\/\*\*\n \* @param \{Element\} button/);
    assert.deepEqual(added(run('esbuild', { name: 'tool' }, real(TS_PROJECT))).filter((f) => /config|\.ts$/.test(f)), []);
    assert.throws(() => run('esbuild', { name: 'tool', types: 'flow' }, real()), /web:esbuild --types: expected ts, jsdoc or none/);
    assert.throws(() => run('esbuild', { name: 'tool', runner: 'jest' }, real()), /web:esbuild --runner: expected node or vitest/);
  });

  it('later runs in an esbuild project (js:test, js:module …) follow its runner and types', () => {
    const project = files(run('esbuild', { name: 'tool', types: 'ts', withTest: true, runner: 'vitest' }, real()));
    assert.match(project['tool/package.json'], /"vitest": "\^1\.2\.6"/);
    assert.equal(runnerFor('js:test', {}, context(project, 'tool/src')), 'vitest');
    assert.equal(detectTypes(context(project, 'tool/src')), 'ts');
  });

  it('refuses a name it can\'t use, a directory that isn\'t empty, and JEN_NO_FETCH', () => {
    assert.throws(() => run('vite', { name: '' }, real()), /web:vite --name: needs a name/);
    assert.throws(() => run('vite', { name: '@scope/x' }, real()), /makes no directory or package name/);
    assert.throws(() => run('vite', { name: 'shop' }, real({ 'shop/notes.md': '' })), /web:vite: shop\/ already exists and isn't empty/);
    assert.throws(() => run('esbuild', { name: 'tool' }, real({ 'web/tool/a.js': '' }, 'web')), /web:esbuild: web\/tool\/ already exists/);
    assert.deepEqual(calls(), [], 'no npm call before the checks pass');
    process.env.JEN_NO_FETCH = '1';
    try {
      assert.throws(() => run('vite', { name: 'shop' }, real()), /web:vite needs the npm registry, and JEN_NO_FETCH is set/);
    } finally {
      delete process.env.JEN_NO_FETCH;
    }
  });

  it('reads the template list from create-vite\'s help', () => {
    assert.deepEqual(templatesIn('Usage: x\n\nOptions:\n  -t, --template NAME  use a template\n\nAvailable templates:\nvanilla-ts          vanilla\nreact-compiler-ts   react-compiler\n'), [
      'vanilla-ts',
      'vanilla',
      'react-compiler-ts',
      'react-compiler',
    ]);
  });
});
