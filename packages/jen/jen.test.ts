/**
 * Tests for jen – node:test, no dependencies.
 *
 *   node --test jen.test.ts
 *
 * The CLI runs as a real process in temporary project directories, each
 * with its own XDG_CONFIG_HOME, so your real user directory stays untouched.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { helpers } from './src/jen.ts';

const JEN = join(import.meta.dirname, 'src/jen.ts');

const tempDirs: string[] = [];

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

/** Creates a temp directory containing the given files. */
function fixture(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'jen-test-'));
  tempDirs.push(dir);
  for (const [path, content] of Object.entries(files)) {
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return dir;
}

interface RunOptions {
  cwd: string;
  userDir?: string;
  home?: string;
}

function jen(args: string[], { cwd, userDir, home }: RunOptions) {
  const xdg = userDir ?? fixture();
  const result = spawnSync(process.execPath, [JEN, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, ...(home && { HOME: home }), XDG_CONFIG_HOME: xdg, JEN_PATH: '', JEN_NO_FETCH: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const read = (dir: string, path: string): string => readFileSync(join(dir, path), 'utf8');

/** `--list` text with each generator's source heading put back on its line – `name source description` – to match against. */
function flatList(out: string): string {
  let source = '';
  return out
    .split('\n')
    .map((line) => {
      if (line.startsWith('recipes')) return (source = '', line)[1];
      if (/^\S/.test(line)) return (source = line, '')[1];
      const m = /^ {2}(\S+) +(.*)$/.exec(line);
      return m && source ? `${m[1]} ${source} ${m[2]}` : line;
    })
    .join('\n');
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CLASS_GEN = `
export const description = 'C++ class';
export const params = {
  name: {},
  dir: { default: 'src' },
  moveOnly: { default: false },
};
export const actions = ({ name, dir, moveOnly }, { pascal }) => [
  { add: \`\${dir}/\${pascal(name)}.h\`, template: \`class \${pascal(name)}\${moveOnly ? ' /* move-only */' : ''} {};\\n\` },
  { add: \`\${dir}/\${pascal(name)}.cpp\`, template: \`#include "\${pascal(name)}.h"\\n\` },
  { insert: \`\${dir}/CMakeLists.txt\`, before: '# scaffold:sources', line: \`\${pascal(name)}.cpp\` },
];
`;

const CMAKE = 'target_sources(app PRIVATE\n\tmain.cpp\n\t# scaffold:sources\n)\n';

const cppProject = (extra: Record<string, string> = {}) =>
  fixture({ '.jen/class.mjs': CLASS_GEN, 'src/CMakeLists.txt': CMAKE, ...extra });

// ─── Helpers ────────────────────────────────────────────────────────────────

describe('helpers', () => {
  it('converts between cases', () => {
    assert.equal(helpers.pascal('rigid_body'), 'RigidBody');
    assert.equal(helpers.pascal('rigid body'), 'RigidBody');
    assert.equal(helpers.pascal('rigidBody'), 'RigidBody');
    assert.equal(helpers.camel('rigid-body'), 'rigidBody');
    assert.equal(helpers.snake('RigidBody'), 'rigid_body');
    assert.equal(helpers.kebab('RigidBody'), 'rigid-body');
    assert.equal(helpers.constant('rigidBody'), 'RIGID_BODY');
  });

  it('keeps acronyms together', () => {
    assert.equal(helpers.pascal('GLHandle'), 'GLHandle');
  });

  it('handles empty strings', () => {
    assert.equal(helpers.pascal(''), '');
    assert.equal(helpers.camel(''), '');
  });
});

// ─── CLI basics ─────────────────────────────────────────────────────────────

describe('CLI', () => {
  it('shows the help', () => {
    const r = jen(['--help'], { cwd: fixture() });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /the code jen\(erator\)/);
  });

  it('reports unknown generators with exit code 1', () => {
    const r = jen(['nope'], { cwd: fixture() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /"nope" not found/);
  });

  it('hints at --from for an unknown pack prefix when fetching is off (JEN_NO_FETCH)', () => {
    const r = jen(['lua:function'], { cwd: fixture() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /jen --from @codejen\/pack-lua lua:function/);
    assert.doesNotMatch(r.stdout + r.stderr, /Fetching/);
  });

  it('gives no --from hint for unprefixed names or known sources', () => {
    assert.doesNotMatch(jen(['nope'], { cwd: fixture() }).stderr, /--from/);
    assert.doesNotMatch(jen(['project:nope'], { cwd: cppProject() }).stderr, /--from/);
  });

  it('shows the help and exits 1 when no generator is given', () => {
    const r = jen([], { cwd: cppProject() });
    assert.equal(r.code, 1);
    assert.match(r.stdout, /the code jen\(erator\)/);
    assert.doesNotMatch(r.stdout, /C\+\+ class/);
  });

  it("shows jen's version", () => {
    const { version } = JSON.parse(read(import.meta.dirname, 'package.json')) as { version: string };
    for (const flag of ['--version', '-v']) {
      const r = jen([flag], { cwd: fixture() });
      assert.equal(r.code, 0, r.stderr);
      assert.equal(r.stdout, `${version}\n`);
    }
  });

  it('does not run main() on import', async () => {
    const mod = await import('./src/jen.ts');
    assert.equal(typeof mod.helpers.pascal, 'function');
  });
});

// ─── Actions ────────────────────────────────────────────────────────────────

describe('add + insert', () => {
  it('writes nothing with --dry-run', () => {
    const dir = cppProject();
    const r = jen(['class', '--name=foo', '-n'], { cwd: dir });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /\+ src[/\\]Foo\.h/);
    assert.equal(existsSync(join(dir, 'src/Foo.h')), false);
    assert.equal(read(dir, 'src/CMakeLists.txt'), CMAKE);
  });

  it('creates files and inserts them with indentation', () => {
    const dir = cppProject();
    const r = jen(['class', '--name=rigid_body', '--moveOnly'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'src/RigidBody.h'), 'class RigidBody /* move-only */ {};\n');
    assert.equal(read(dir, 'src/RigidBody.cpp'), '#include "RigidBody.h"\n');
    assert.equal(
      read(dir, 'src/CMakeLists.txt'),
      'target_sources(app PRIVATE\n\tmain.cpp\n\tRigidBody.cpp\n\t# scaffold:sources\n)\n',
    );
  });

  it('is idempotent', () => {
    const dir = cppProject();
    jen(['class', '--name=foo'], { cwd: dir });
    const cmake = read(dir, 'src/CMakeLists.txt');
    const r = jen(['class', '--name=foo'], { cwd: dir });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /Nothing to do/);
    assert.equal(read(dir, 'src/CMakeLists.txt'), cmake);
  });

  it('overwrites only with --force', () => {
    const dir = cppProject({ 'src/Foo.h': 'alt' });
    const r = jen(['class', '--name=foo'], { cwd: dir });
    assert.equal(read(dir, 'src/Foo.h'), 'alt');
    assert.match(r.stdout, /\n {2}info: src[/\\]Foo\.h exists, skipped\n/);
    // once, after the plan
    assert.match(r.stdout, /\n {2}info: 1 file exists and was skipped – --force overwrites it\n✓/);
    const again = jen(['class', '--name=foo'], { cwd: dir });
    assert.match(again.stdout, /\n {2}info: 2 files exist and were skipped – --force overwrites them\n/);
    assert.equal(again.stdout.match(/--force overwrites/g)?.length, 1);
    const forced = jen(['class', '--name=foo', '--force'], { cwd: dir });
    assert.equal(read(dir, 'src/Foo.h'), 'class Foo {};\n');
    assert.doesNotMatch(forced.stdout, /--force overwrites/);
  });

  it('reports missing markers without aborting', () => {
    const dir = cppProject({ 'src/CMakeLists.txt': 'add_executable(app main.cpp)\n' });
    const r = jen(['class', '--name=foo'], { cwd: dir });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /\n {2}warning: src[/\\]CMakeLists\.txt has no marker "# scaffold:sources", skipped\n/);
    assert.ok(existsSync(join(dir, 'src/Foo.h')));
  });

  it('allows insert into a file created in the same run', () => {
    const dir = fixture({
      '.jen/lib.mjs': `export const actions = () => [
        { add: 'lib/CMakeLists.txt', template: 'add_library(lib\\n  # scaffold:sources\\n)\\n' },
        { insert: 'lib/CMakeLists.txt', before: '# scaffold:sources', line: 'a.cpp' },
        { insert: 'lib/CMakeLists.txt', before: '# scaffold:sources', line: 'b.cpp' },
      ];`,
    });
    const r = jen(['lib'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'lib/CMakeLists.txt'), 'add_library(lib\n  a.cpp\n  b.cpp\n  # scaffold:sources\n)\n');
  });

  it('accepts a RegExp marker: inserts before the first matching line', () => {
    const dir = fixture({
      'shader.glsl': 'out vec4 c;\n\nfloat map(vec3 p) { return 1.0; }\n\nvoid main() {}\n',
      '.jen/fn.mjs': `export const actions = () => [
        { insert: 'shader.glsl', before: /^(?:float|void)\\s+\\w+\\s*\\(/g, line: 'float a() { return 0.0; }\\n' },
        { insert: 'shader.glsl', before: /^(?:float|void)\\s+\\w+\\s*\\(/g, line: 'float b() { return 0.0; }\\n' },
        { insert: 'shader.glsl', before: /^(?:float|void)\\s+\\w+\\s*\\(/g, line: 'float a() { return 0.0; }\\n' },
        { insert: 'shader.glsl', before: /^nope/, line: 'never' },
      ];`,
    });
    const r = jen(['fn'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    // b lands before a: a is now the first function. The repeated a is skipped (already present).
    assert.equal(
      read(dir, 'shader.glsl'),
      'out vec4 c;\n\nfloat b() { return 0.0; }\n\nfloat a() { return 0.0; }\n\nfloat map(vec3 p) { return 1.0; }\n\nvoid main() {}\n',
    );
    assert.match(r.stdout, /info: shader\.glsl already has float a\(\)/);
    assert.match(r.stdout, /warning: shader\.glsl has no marker \/\^nope\/, skipped/);
  });

  it('accepts a line number: inserts before that line, at its indentation', () => {
    const dir = fixture({
      'page.html': '<body>\n  <header>\n    <nav></nav>\n  </header>\n</body>\n',
      '.jen/at.mjs': `export const actions = () => [
        { insert: 'page.html', before: 3, line: '<button>Menu</button>' },
        { insert: 'page.html', before: 3, line: '<button>Menu</button>' },
        { insert: 'page.html', before: 7, line: '<footer></footer>' },
        { insert: 'page.html', before: 9, line: 'never' },
        { insert: 'page.html', before: 0, line: 'never' },
      ];`,
    });
    const r = jen(['at'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    // The second insert is already present; line 7 is one past the (now 6-line) file, so the footer is appended.
    assert.equal(read(dir, 'page.html'), '<body>\n  <header>\n    <button>Menu</button>\n    <nav></nav>\n  </header>\n</body>\n<footer></footer>\n');
    assert.match(r.stdout, /~ page\.html:3 {2}\+ <button>Menu<\/button>\n/);
    assert.match(r.stdout, /warning: page\.html has no line 9 \(7 lines\), skipped/);
    assert.match(r.stdout, /warning: page\.html has no line 0/);
  });

  it('indents one level deeper before a closing line: the insert goes inside', () => {
    const dir = fixture({
      'page.html': '<body>\n  <nav>\n    <a href="/">Home</a>\n  </nav>\n</body>\n',
      'app.js': 'function f() {\n\tg();\n}\n',
      '.jen/inside.mjs': `export const actions = () => [
        { insert: 'page.html', before: '</nav>', line: '<button>Menu</button>' },
        { insert: 'page.html', before: /<\\/body>/, line: '<footer>\\n  <p>Hi</p>\\n</footer>' },
        { insert: 'app.js', before: 3, line: 'h();' },
      ];`,
    });
    const r = jen(['inside'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(
      read(dir, 'page.html'),
      '<body>\n  <nav>\n    <a href="/">Home</a>\n    <button>Menu</button>\n  </nav>\n  <footer>\n    <p>Hi</p>\n  </footer>\n</body>\n',
    );
    assert.equal(read(dir, 'app.js'), 'function f() {\n\tg();\n\th();\n}\n');
  });

  it('says which line a text marker on several lines used, and where each insert went', () => {
    const dir = fixture({
      'page.html': '<body>\n  <nav>\n  </nav>\n  <main></main>\n  <nav>\n  </nav>\n</body>\n',
      '.jen/twice.mjs': `export const actions = () => [{ insert: 'page.html', before: '</nav>', line: '<a href="/">Home</a>' }];`,
    });
    const r = jen(['twice'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'page.html'), '<body>\n  <nav>\n    <a href="/">Home</a>\n  </nav>\n  <main></main>\n  <nav>\n  </nav>\n</body>\n');
    assert.match(r.stdout, /~ page\.html:3 {2}\+ <a href="\/">Home<\/a>\n {2}info: page\.html "<\/nav>" is on lines 3 and 6 – used line 3\n/);
  });
});

describe('insert after', () => {
  const INDEX = "import { users } from './users.js';\nimport { health } from './health.js';\n\nexport const routes = [\n  users,\n  health,\n];\n";

  it('registers in an index file without a marker: after the last import, before the closing ];', () => {
    const dir = fixture({
      'src/routes/index.js': INDEX,
      '.jen/route.mjs': `export const params = { name: {} };
export const actions = ({ name }) => [
  { insert: { find: 'index.js', containing: 'export const routes' }, after: /^import /, line: \`import { \${name} } from './\${name}.js';\` },
  { insert: { find: 'index.js', containing: 'export const routes' }, before: /^\\];/, line: \`\${name},\` },
];`,
    });
    for (let i = 0; i < 2; i++) assert.equal(jen(['route', '--name=orders'], { cwd: dir }).code, 0);
    assert.equal(
      read(dir, 'src/routes/index.js'),
      "import { users } from './users.js';\nimport { health } from './health.js';\nimport { orders } from './orders.js';\n\nexport const routes = [\n  users,\n  health,\n  orders,\n];\n",
    );
  });

  it('takes the text as the Find default, goes one level deeper after an opening line, and warns without a match', () => {
    const dir = fixture({
      'list.js': 'const xs = [\n\t1,\n];\n',
      'plain.txt': 'a\nb',
      '.jen/after.mjs': `export const actions = () => [
        { insert: { find: 'list.js' }, after: 'const xs = [', line: '0,' },
        { insert: 'plain.txt', after: 'b', line: 'c' },
        { insert: 'plain.txt', after: /^$/, line: 'never' },
      ];`,
    });
    const r = jen(['after'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'list.js'), 'const xs = [\n\t0,\n\t1,\n];\n');
    assert.equal(read(dir, 'plain.txt'), 'a\nb\nc');
    assert.match(r.stdout, /~ list\.js:2 {2}\+ 0,\n/);
    // the empty string after a file's last newline is no blank line
    assert.match(r.stdout, /warning: plain\.txt has no marker \/\^\$\/, skipped/);
  });
});

describe('--where (removed)', () => {
  it('fails instead of generating into the current directory', () => {
    const dir = cppProject();
    for (const flag of [`--where=${fixture()}`, '-w']) {
      const r = jen(['class', '--name=foo', flag], { cwd: dir });
      assert.equal(r.code, 1);
      assert.match(r.stderr, /--where\/-w was removed/);
    }
    assert.equal(existsSync(join(dir, 'src/Foo.h')), false);
  });

  it('is still available as a generator\'s own param', () => {
    const dir = fixture({ '.jen/at.mjs': `export const params = { where: {} };
export const actions = ({ where }) => [{ add: 'at.txt', template: where }];` });
    const r = jen(['at', '--where=home'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'at.txt'), 'home');
  });
});

describe('modify', () => {
  it('replaces via RegExp', () => {
    const dir = fixture({
      'VERSION': 'version=0.1.0\n',
      '.jen/bump.mjs': `export const actions = () => [
        { modify: 'VERSION', pattern: /\\d+\\.\\d+\\.\\d+/, replace: '0.2.0' },
      ];`,
    });
    const r = jen(['bump'], { cwd: dir });
    assert.match(r.stdout, /~ VERSION {2}replaced, now: 0\.2\.0\n/);
    assert.equal(read(dir, 'VERSION'), 'version=0.2.0\n');
  });

  it('says what a removal removes', () => {
    const dir = fixture({
      'a.glsl': '#version 300 es\nprecision highp float;\nvoid main() {}\n',
      '.jen/strip.mjs': `export const actions = () => [{ modify: 'a.glsl', pattern: /^precision .*\\n/gm, replace: '' }];`,
    });
    assert.match(jen(['strip'], { cwd: dir }).stdout, /~ a\.glsl {2}removed: precision highp float;\n/);
  });

  it('reports when nothing matches', () => {
    const dir = fixture({
      'VERSION': 'nix\n',
      '.jen/bump.mjs': `export const actions = () => [{ modify: 'VERSION', pattern: /\\d+/, replace: '1' }];`,
    });
    const r = jen(['bump'], { cwd: dir });
    assert.match(r.stdout, /\n {2}info: VERSION nothing matched\n/);
    assert.doesNotMatch(r.stdout, /\\d/);
    assert.match(r.stdout, /Nothing to do/);
  });
});

describe('append', () => {
  const RULE = '.flow > * + * {\n  margin-block-start: 1em;\n}';
  const GEN = `export const actions = () => [
    { append: 'layout.css', text: '\\n/* after Every Layout */\\n${RULE.replaceAll('\n', '\\n')}' },
  ];`;

  it('adds text at the end, and nothing twice', () => {
    const dir = fixture({ 'layout.css': '.a {\n  color: red;\n}', '.jen/flow.mjs': GEN });
    const r = jen(['flow'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /~ layout\.css {2}\+ \.flow > \* \+ \* \{ \(appended\)/);
    assert.equal(read(dir, 'layout.css'), `.a {\n  color: red;\n}\n\n/* after Every Layout */\n${RULE}\n`);
    const again = jen(['flow'], { cwd: dir });
    assert.match(again.stdout, /\n {2}info: layout\.css already has \.flow > \* \+ \* \{\n/);
    assert.match(again.stdout, /Nothing to do/);
  });

  it('works on a file the same run creates, in the file\'s indent style', () => {
    const dir = fixture({
      '.editorconfig': 'root = true\n[*.css]\nindent_style = tab\n',
      '.jen/new.mjs': `export const actions = () => [
        { add: 'layout.css', template: '' },
        { append: 'layout.css', text: '${RULE.replaceAll('\n', '\\n')}' },
      ];`,
    });
    const r = jen(['new'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'layout.css'), '.flow > * + * {\n\tmargin-block-start: 1em;\n}\n');
  });

  it('shows the first rule in the plan, not a comment – a universal selector is no comment', () => {
    const dir = fixture({
      'a.css': '',
      '.jen/reset.mjs': `export const actions = () => [{ append: 'a.css', text: '/*\\n * reset\\n */\\n*,\\n*::before {\\n  margin: 0;\\n}' }];`,
    });
    assert.match(jen(['reset'], { cwd: dir }).stdout, /~ a\.css {2}\+ \*, \(appended\)/);
  });

  it('skips a missing file with a note, once', () => {
    const dir = fixture({ '.jen/flow.mjs': GEN.replace('];', "{ append: 'layout.css', text: 'x' },\n  ];") });
    const r = jen(['flow'], { cwd: dir });
    assert.match(r.stdout, /\n {2}warning: layout\.css is missing, skipped\n/);
    assert.equal(r.stdout.match(/warning:/g)?.length, 1);
  });
});

describe('note', () => {
  it('tells something and changes nothing, with or without a file', () => {
    const dir = fixture({
      '.jen/tell.mjs': `export const actions = () => [
        { note: '.reel is already here, nothing to add', file: 'css/layout.css' },
        { note: 'all done before' },
      ];`,
    });
    const r = jen(['tell'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /\n {2}info: css[/\\]layout\.css \.reel is already here, nothing to add\n {2}info: all done before\n/);
    assert.match(r.stdout, /Nothing to do/);
    assert.ok(!existsSync(join(dir, 'css')));
  });

  it('places its file from --dir, like any action path', () => {
    const dir = fixture({ '.jen/tell.mjs': `export const actions = () => [{ note: 'is fine', file: 'a.css' }];` });
    assert.match(jen(['tell', '--dir=css'], { cwd: dir }).stdout, /info: css[/\\]a\.css is fine/);
  });

  it('with warning: true, is a warning – which --strict turns into exit code 1', () => {
    const dir = fixture({ '.jen/check.mjs': `export const actions = () => [{ note: 'uses .crad', file: 'index.html', warning: true }, { note: 'checked 1 page' }];` });
    const r = jen(['check'], { cwd: dir });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /\n {2}warning: index\.html uses \.crad\n {2}info: checked 1 page\n/);
    assert.equal(jen(['check', '--strict'], { cwd: dir }).code, 1);
    const fine = fixture({ '.jen/check.mjs': `export const actions = () => [{ note: 'checked 1 page' }];` });
    assert.equal(jen(['check', '--strict'], { cwd: fine }).code, 0);
  });

  it('with written: true, only shows when the file is written', () => {
    const dir = fixture({
      '.jen/page.mjs': `export const actions = () => [
        { add: 'page.html', template: '<link rel="stylesheet" href="a.css">' },
        { note: 'links a.css', file: 'page.html', written: true },
        { note: 'about the page anyway', file: 'page.html' },
      ];`,
    });
    assert.match(jen(['page'], { cwd: dir }).stdout, /info: page\.html links a\.css\n/);
    const rerun = jen(['page'], { cwd: dir }).stdout;
    assert.doesNotMatch(rerun, /links a\.css/);
    assert.match(rerun, /info: page\.html exists, skipped\n {2}info: page\.html about the page anyway\n/);
    assert.match(jen(['page', '--force'], { cwd: dir }).stdout, /info: page\.html links a\.css\n/);
  });
});

describe('delete', () => {
  const DESTROY = `export const params = { name: {} };
    export const actions = ({ name }, { pascal }) => [
      { delete: \`src/\${pascal(name)}.h\` },
      { delete: \`src/\${pascal(name)}.cpp\` },
      { modify: 'src/CMakeLists.txt', pattern: new RegExp(\`^\\\\s*\${pascal(name)}\\\\.cpp\\\\n\`, 'm'), replace: '' },
    ];`;

  it('undoes class (delete + modify)', () => {
    const dir = cppProject({ '.jen/destroy.mjs': DESTROY });
    jen(['class', '--name=foo'], { cwd: dir });
    const r = jen(['destroy', '--name=foo'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /- src[/\\]Foo\.h/);
    assert.match(r.stdout, /1 written, 2 deleted/);
    assert.equal(existsSync(join(dir, 'src/Foo.h')), false);
    assert.equal(existsSync(join(dir, 'src/Foo.cpp')), false);
    assert.equal(read(dir, 'src/CMakeLists.txt'), CMAKE);
  });

  it('deletes nothing with --dry-run', () => {
    const dir = cppProject({ '.jen/destroy.mjs': DESTROY, 'src/Foo.h': 'x', 'src/Foo.cpp': 'x' });
    jen(['destroy', '--name=foo', '-n'], { cwd: dir });
    assert.ok(existsSync(join(dir, 'src/Foo.h')));
  });

  it('skips missing files', () => {
    const dir = cppProject({ '.jen/destroy.mjs': DESTROY });
    const r = jen(['destroy', '--name=foo'], { cwd: dir });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /info: src[/\\]Foo\.h does not exist/);
    assert.match(r.stdout, /Nothing to do/);
  });

  it('refuses paths outside the project and directories', () => {
    const outside = fixture({ 'keep.txt': 'stays' });
    const dir = fixture({
      'sub/a.txt': 'a',
      '.jen/evil.mjs': `export const actions = () => [
        { delete: ${JSON.stringify(join(outside, 'keep.txt'))} },
        { delete: '../keep.txt' },
        { delete: 'sub' },
        { delete: '.' },
      ];`,
    });
    const r = jen(['evil'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    // an absolute path is from the project root, so it can't leave it either
    assert.equal((r.stdout.match(/warning: .* is outside the project, skipped/g) ?? []).length, 2);
    assert.match(r.stdout, /warning: sub is a directory, skipped/);
    assert.equal(read(outside, 'keep.txt'), 'stays');
    assert.ok(existsSync(join(dir, 'sub/a.txt')));
  });

  it('can discard a file created in the same run', () => {
    const dir = fixture({
      '.jen/tmp.mjs': `export const actions = () => [
        { add: 'tmp.txt', template: 'x' },
        { delete: 'tmp.txt' },
        { add: 'keep.txt', template: 'k' },
      ];`,
    });
    const r = jen(['tmp'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(existsSync(join(dir, 'tmp.txt')), false);
    assert.equal(read(dir, 'keep.txt'), 'k');
  });
});

// ─── Params ─────────────────────────────────────────────────────────────────

describe('params', () => {
  it('uses defaults for params not given on the CLI', () => {
    const dir = cppProject();
    const r = jen(['class', '--name=foo'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'src/Foo.h'), 'class Foo {};\n');
  });

  it('shows the params and fails with exit code 1 when a required param is missing', () => {
    const r = jen(['class'], { cwd: cppProject() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /Missing: --name/);
    assert.match(r.stderr, /^class – C\+\+ class\n {2}--name \(required\)/);
    assert.equal(r.stdout, '');
  });

  it('understands boolean values via CLI', () => {
    const dir = cppProject();
    jen(['class', '--name=foo', '--moveOnly=yes'], { cwd: dir });
    assert.match(read(dir, 'src/Foo.h'), /move-only/);
    for (const no of ['no', 'off']) {
      const d = cppProject();
      jen(['class', '--name=foo', `--moveOnly=${no}`], { cwd: d });
      assert.doesNotMatch(read(d, 'src/Foo.h'), /move-only/);
    }
  });

  it('fails on a boolean value it does not understand', () => {
    const r = jen(['class', '--name=foo', '--moveOnly=nein'], { cwd: cppProject() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /--moveOnly: expected true or false/);
  });

  it('only takes a value from the choices, or the default', () => {
    const dir = fixture({
      '.jen/pick.mjs': `export const params = { kind: { default: '', choices: ['quad', 'mesh'] } };
        export const actions = ({ kind }) => [{ add: 'kind.txt', template: kind || 'none' }];`,
    });
    const r = jen(['pick', '--kind=Mesh'], { cwd: dir });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /pick --kind: expected one of "quad", "mesh", got "Mesh"/);
    assert.ok(!existsSync(join(dir, 'kind.txt')));
    assert.equal(jen(['pick', '--kind='], { cwd: dir }).code, 0);
    assert.equal(read(dir, 'kind.txt'), 'none');
    assert.equal(jen(['pick', '--kind=mesh', '--force'], { cwd: dir }).code, 0);
    assert.equal(read(dir, 'kind.txt'), 'mesh');
  });

  it('runs a generator whose params have descriptions', () => {
    const dir = fixture({
      '.jen/greet.mjs': `export const params = { who: { default: 'world', description: 'whom to greet' } };
        export const actions = ({ who }) => [{ add: 'hi.txt', template: \`hi \${who}\` }];`,
    });
    const r = jen(['greet', '--who=jen'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'hi.txt'), 'hi jen');
  });

  it('overrides a string default via CLI', () => {
    const gen = `export const params = { lang: { default: 'c' } };
      export const actions = ({ lang }) => [{ add: 'out.txt', template: lang }];`;
    const a = fixture({ '.jen/pick.mjs': gen });
    jen(['pick'], { cwd: a });
    assert.equal(read(a, 'out.txt'), 'c');

    const b = fixture({ '.jen/pick.mjs': gen });
    jen(['pick', '--lang=cpp'], { cwd: b });
    assert.equal(read(b, 'out.txt'), 'cpp');
  });
});

describe('unknown flags', () => {
  it('fails on a flag the generator has no param for, listing the known ones', () => {
    const dir = cppProject();
    const r = jen(['class', '--name=foo', '--copyable'], { cwd: dir });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /class has no --copyable\. Known: --name, --dir, --moveOnly\. \(jen class --help\)/);
    assert.equal(existsSync(join(dir, 'src/Foo.h')), false);
  });

  it('names every unknown flag in one message', () => {
    const r = jen(['class', '--name=foo', '--copyable', '--namepsace=gfx'], { cwd: cppProject() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /has no --copyable, --namepsace\./);
  });

  it('suggests the closest param for a near-miss', () => {
    const r = jen(['class', '--name=foo', '--moveonly'], { cwd: cppProject() });
    assert.match(r.stderr, /--moveonly \(did you mean --moveOnly\?\)/);
    // before the missing-param check, so a mistyped required param says what it is
    const typo = jen(['class', '--nmae=foo'], { cwd: cppProject() });
    assert.match(typo.stderr, /--nmae \(did you mean --name\?\)/);
  });

  it('still accepts --dir and jen\'s own flags', () => {
    const dir = fixture({
      '.jen/greet.mjs': `export const actions = () => [{ add: 'hi.txt', template: 'hi' }];`,
    });
    const r = jen(['greet', '--dir=src', '--dry-run', '--force'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(jen(['greet', '--dir=src', '-n', '-f'], { cwd: dir }).code, 0);
    assert.equal(jen(['--list', '--json'], { cwd: dir }).code, 0);
  });

  it('hands unknown flags to a passthrough generator', () => {
    const dir = fixture({
      '.jen/pass.mjs': `export const passthrough = true;
        export const actions = (_a, _h, ctx) => [{ add: 'flags.json', template: JSON.stringify(ctx.args.flags) }];`,
    });
    const r = jen(['pass', '--copyable', '--base-name=blog'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(JSON.parse(read(dir, 'flags.json')), { copyable: true, 'base-name': 'blog' });
  });
});

// ─── Describing generators ──────────────────────────────────────────────────

const DESCRIBED_GEN = `
export default {
  description: 'create a C++ class (header + source)',
  params: {
    name: {},
    namespace: { default: '' },
    dir: { default: 'src' },
    members: { default: 'int a, int b' },
    into: { default: '', path: true },
    moveOnly: { default: false, description: 'RAII wrapper: copy deleted, move defaulted (Rule of Five)' },
    withTest: { default: false, description: 'add a doctest case' },
  },
  actions: () => [{ add: 'never.txt', template: '' }],
};
`;

describe('jen <generator> --help', () => {
  const DIR_LINE = '  --dir=<folder>  where the files go';

  it('shows the generator and its params, plain like the CLI', () => {
    const dir = fixture({ '.jen/class.mjs': DESCRIBED_GEN });
    const r = jen(['class', '--help'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(
      r.stdout,
      [
        'class – create a C++ class (header + source)',
        '  --name (required)',
        '  --namespace=""',
        '  --dir=src',
        '  --members="int a, int b"',
        '  --into=""  (path)',
        '  --moveOnly  RAII wrapper: copy deleted, move defaulted (Rule of Five)',
        '  --withTest  add a doctest case',
        '',
      ].join('\n'),
    );
    assert.ok(!existsSync(join(dir, 'never.txt')));
  });

  it('shows a boolean that defaults to true with its value', () => {
    const dir = fixture({ '.jen/on.mjs': `export const params = { cmake: { default: true } }; export const actions = () => [];` });
    assert.equal(jen(['on', '--help'], { cwd: dir }).stdout, `on\n  --cmake=true\n${DIR_LINE}\n`);
  });

  it('shows the pack prefix', () => {
    const dir = fixture({
      'package.json': JSON.stringify({ dependencies: { '@codejen/pack-demo': '*' } }),
      'node_modules/@codejen/pack-demo/package.json': JSON.stringify({ name: '@codejen/pack-demo', type: 'module', exports: './index.mjs' }),
      'node_modules/@codejen/pack-demo/index.mjs': `export default { hello: { description: 'say hi', actions: () => [] } };`,
    });
    assert.equal(jen(['demo:hello', '--help'], { cwd: dir }).stdout, `demo:hello – say hi\n${DIR_LINE}\n`);
  });

  it("lists one pack's generators by its prefix", () => {
    const dir = fixture({
      'package.json': JSON.stringify({ dependencies: { '@codejen/pack-demo': '*' } }),
      'node_modules/@codejen/pack-demo/package.json': JSON.stringify({ name: '@codejen/pack-demo', type: 'module', exports: './index.mjs' }),
      'node_modules/@codejen/pack-demo/index.mjs': `export default { hello: { description: 'say hi', actions: () => [] } };`,
      '.jen/mine.mjs': `export const actions = () => [];`,
    });
    for (const args of [['demo', '--list'], ['demo']]) {
      const r = jen(args, { cwd: dir });
      assert.equal(r.code, 0, r.stderr);
      assert.match(flatList(r.stdout), /demo:hello\s+pack @codejen\/pack-demo\s+say hi/);
      assert.doesNotMatch(r.stdout, /mine|generator/);
    }
    const json = JSON.parse(jen(['demo', '--list', '--json'], { cwd: dir }).stdout) as { generators: Array<{ name: string }> };
    assert.deepEqual(json.generators.map((g) => g.name), ['demo:hello']);
    assert.match(flatList(jen(['project', '--list'], { cwd: dir }).stdout), /mine\s+project/);
  });

  it('fails for an unknown pack when fetching is off', () => {
    const r = jen(['lua', '--list'], { cwd: fixture() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /"lua" isn't installed here, and fetching is off \(JEN_NO_FETCH\) – install @codejen\/pack-lua, or run jen inside your project/);
    assert.doesNotMatch(r.stdout + r.stderr, /Fetching/);
    // not a name jen would fetch anyway
    assert.match(jen(['Lua_Pack', '--list'], { cwd: fixture() }).stderr, /"Lua_Pack" is no pack or source jen knows/);
  });

  it("suggests close names for an unknown generator in a known pack, else that pack's list", () => {
    const dir = fixture({
      'package.json': JSON.stringify({ dependencies: { '@codejen/pack-demo': '*' } }),
      'node_modules/@codejen/pack-demo/package.json': JSON.stringify({ name: '@codejen/pack-demo', type: 'module', exports: './index.mjs' }),
      'node_modules/@codejen/pack-demo/index.mjs': `export default { stat: { actions: () => [] }, card: { actions: () => [] } };`,
    });
    const typo = jen(['demo:stats'], { cwd: dir });
    assert.equal(typo.code, 1);
    assert.match(typo.stderr, /Generator "demo:stats" not found – did you mean demo:stat\? jen demo --list shows them all\./);
    assert.match(jen(['demo:nothing-like-it'], { cwd: dir }).stderr, /"demo:nothing-like-it" not found – jen demo --list shows them all\./);
    assert.match(jen(['crad'], { cwd: dir }).stderr, /"crad" not found – did you mean card\? jen --list shows all\./);
  });

  it('reports an unknown generator when fetching is off', () => {
    const r = jen(['lua:function', '--help'], { cwd: fixture() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /"lua:function" not found/);
  });

  it('shows choices, default first, and the examples', () => {
    const dir = fixture({
      '.jen/enum.mjs': `export default {
        params: { name: {}, std: { default: '23', choices: ['20', '23'] }, kind: { choices: ['a', 'b c'] } },
        examples: ['--name=State --kind=a', '--name=State --kind="b c" --std=20'],
        actions: () => [],
      };`,
    });
    assert.equal(
      jen(['enum', '--help'], { cwd: dir }).stdout,
      [
        'enum',
        '  --name (required)',
        '  --std=23|20',
        '  --kind=a|"b c" (required)',
        DIR_LINE,
        '',
        'examples:',
        '  jen enum --name=State --kind=a',
        '  jen enum --name=State --kind="b c" --std=20',
        '',
      ].join('\n'),
    );
  });

  it('says where path params are read from, and shows the usage lines', () => {
    const dir = fixture({
      '.jen/box.mjs': `export default {
        params: { into: { path: true, default: '', description: 'a stylesheet to add it to' }, out: { path: true, default: '' } },
        usage: ['<div class="box">…</div>', '--box-padding: 1rem  the padding'],
        actions: () => [],
      };`,
    });
    assert.equal(
      jen(['box', '--help'], { cwd: dir }).stdout,
      [
        'box',
        '  --into=""  a stylesheet to add it to (path)',
        '  --out=""  (path)',
        DIR_LINE,
        '',
        'usage:',
        '  <div class="box">…</div>',
        '  --box-padding: 1rem  the padding',
        '',
      ].join('\n'),
    );
    const box = JSON.parse(jen(['box', '--help', '--json'], { cwd: dir }).stdout) as { usage: string[] };
    assert.deepEqual(box.usage, ['<div class="box">…</div>', '--box-padding: 1rem  the padding']);
  });

  it("links a pack's homepage, and has npx fetch a third-party pack with --from", () => {
    const dir = fixture({
      'package.json': JSON.stringify({ dependencies: { 'jen-pack-demo': '*' } }),
      'node_modules/jen-pack-demo/package.json': JSON.stringify({ name: 'jen-pack-demo', type: 'module', exports: './index.mjs', homepage: 'https://example.com/demo' }),
      'node_modules/jen-pack-demo/index.mjs': `export default { hello: { examples: ['--loud'], actions: () => [] } };`,
    });
    assert.equal(
      jen(['demo:hello', '--help'], { cwd: dir }).stdout,
      [
        'demo:hello',
        DIR_LINE,
        '',
        'examples:',
        '  jen demo:hello --loud',
        '  without jen installed: npx --yes @codejen/jen --from jen-pack-demo demo:hello …',
        '',
        'docs: https://example.com/demo',
        '',
      ].join('\n'),
    );
  });

  it('still shows the general help without a generator', () => {
    const help = jen(['--help'], { cwd: fixture() }).stdout;
    assert.match(help, /--list, -l/);
    assert.match(help, /Without jen installed: npx --yes @codejen\/jen …/, 'once here, instead of under every generator\'s examples');
  });
});

describe('jen --list --json', () => {
  type Catalog = { packs: Array<Record<string, unknown>>; generators: Array<Record<string, unknown>> };
  const catalogIn = (dir: string, userDir?: string): Catalog => {
    const r = jen(['--list', '--json'], { cwd: dir, userDir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.stdout.trimEnd().split('\n').length, 1, 'compact when piped');
    return JSON.parse(r.stdout) as Catalog;
  };

  it('lists every generator by name, source and description – its params with --help --json', () => {
    const dir = fixture({ '.jen/class.mjs': DESCRIBED_GEN });
    const { generators } = catalogIn(dir);
    assert.deepEqual(generators.find((g) => g.name === 'class'), { name: 'class', source: 'project', description: 'create a C++ class (header + source)' });
    assert.ok(generators.some((g) => g.name === 'generator' && g.source === 'built-in'));
    assert.deepEqual(JSON.parse(jen(['class', '--help', '--json'], { cwd: dir }).stdout), {
      name: 'class',
      source: 'project',
      description: 'create a C++ class (header + source)',
      // only what differs from an optional string with an empty default
      params: {
        name: { required: true },
        namespace: {},
        dir: { default: 'src' },
        members: { default: 'int a, int b' },
        into: { path: true },
        moveOnly: { type: 'boolean', description: 'RAII wrapper: copy deleted, move defaulted (Rule of Five)' },
        withTest: { type: 'boolean', description: 'add a doctest case' },
      },
    });
  });

  it('adds choices, examples and the pack from its package.json', () => {
    const dir = fixture({
      'package.json': JSON.stringify({ dependencies: { '@codejen/pack-demo': '*' } }),
      'node_modules/@codejen/pack-demo/package.json': JSON.stringify({
        name: '@codejen/pack-demo',
        version: '1.2.3',
        description: 'demo pack',
        homepage: 'https://example.com/demo',
        type: 'module',
        exports: './src/index.mjs',
      }),
      'node_modules/@codejen/pack-demo/src/index.mjs': `export default {
        hello: { params: { mood: { default: 'calm', choices: ['calm', 'loud'] } }, examples: ['--mood=loud'], actions: () => [] },
      };`,
    });
    const PACK = { name: '@codejen/pack-demo', version: '1.2.3', description: 'demo pack', homepage: 'https://example.com/demo' };
    const { packs, generators } = catalogIn(dir);
    assert.deepEqual(packs, [PACK]);
    assert.deepEqual(generators.find((g) => g.name === 'demo:hello'), { name: 'demo:hello', source: 'pack @codejen/pack-demo' });
    assert.deepEqual(JSON.parse(jen(['demo:hello', '--help', '--json'], { cwd: dir }).stdout), {
      name: 'demo:hello',
      source: 'pack @codejen/pack-demo',
      pack: PACK,
      params: { mood: { default: 'calm', choices: ['calm', 'loud'] } },
      examples: ['jen demo:hello --mood=loud'],
    });
  });

  it('marks shadowed generators', () => {
    const userDir = fixture({ 'jen/class.mjs': `export const actions = () => [];` });
    const classes = catalogIn(fixture({ '.jen/class.mjs': DESCRIBED_GEN }), userDir).generators.filter((g) => g.name === 'class');
    assert.deepEqual(
      classes.map((g) => [g.source, g.shadowed]),
      [
        ['project', undefined],
        ['user', true],
      ],
    );
  });

  it('reports broken generators with an error instead of aborting', () => {
    const broken = catalogIn(fixture({ '.jen/broken.mjs': `export const foo = 1;` })).generators.find((g) => g.name === 'broken');
    assert.match(String(broken?.error), /does not export an actions\(\) function/);
  });

  it('leaves --json to a generator that has a param of that name', () => {
    const dir = fixture({
      '.jen/cfg.mjs': `export const params = { json: { default: false } };
        export const actions = ({ json }) => [{ add: 'out.txt', template: String(json) }];`,
    });
    const r = jen(['cfg', '--json'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'out.txt'), 'true');
  });
});

// ─── EditorConfig ───────────────────────────────────────────────────────────

describe('editorconfig', () => {
  it('reformats newly added files to match .editorconfig', () => {
    const dir = fixture({
      '.editorconfig': 'root = true\n\n[*.js]\nindent_style = tab\nindent_size = 2\n',
      '.jen/code.mjs': `export const actions = () => [
        { add: 'out.js', template: 'function f() {\\n    return 1;\\n}\\n' },
      ];`,
    });
    const r = jen(['code'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'out.js'), 'function f() {\n\t\treturn 1;\n}\n');
  });

  it('trims trailing whitespace and inserts a final newline', () => {
    const dir = fixture({
      '.editorconfig': 'root = true\n\n[*]\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n',
      '.jen/code.mjs': `export const actions = () => [
        { add: 'out.txt', template: 'const x = 1;   ' },
      ];`,
    });
    jen(['code'], { cwd: dir });
    assert.equal(read(dir, 'out.txt'), 'const x = 1;\n');
  });

  it('only reformats files matching the section glob', () => {
    const dir = fixture({
      '.editorconfig': 'root = true\n\n[*.py]\nindent_style = tab\nindent_size = 2\n',
      '.jen/code.mjs': `export const actions = () => [
        { add: 'out.js', template: 'function f() {\\n    return 1;\\n}\\n' },
      ];`,
    });
    jen(['code'], { cwd: dir });
    assert.equal(read(dir, 'out.js'), 'function f() {\n    return 1;\n}\n');
  });

  it('leaves single-line insert/modify content untouched, only add is reformatted', () => {
    const dir = fixture({
      '.editorconfig': 'root = true\n\n[*]\nindent_style = tab\nindent_size = 2\ntrim_trailing_whitespace = true\n',
      'existing.txt': 'line one   \n  # marker\n',
      '.jen/code.mjs': `export const actions = () => [
        { insert: 'existing.txt', before: '# marker', line: '    inserted' },
      ];`,
    });
    jen(['code'], { cwd: dir });
    assert.equal(read(dir, 'existing.txt'), 'line one   \n  inserted\n  # marker\n');
  });
});

// ─── Multi-line insert/modify ──────────────────────────────────────────────

describe('multi-line insert/modify', () => {
  const JS_FILE = 'function outer() {\n  // marker\n}\n';

  it('reindents a multi-line insert to the file’s own (sniffed) style, keeping relative nesting', () => {
    const dir = fixture({
      'src/out.js': JS_FILE,
      '.jen/code.mjs': `export const actions = () => [
        { insert: 'src/out.js', before: '// marker', line: 'if (x) {\\n\\tdoSomething();\\n\\tif (y) {\\n\\t\\tnested();\\n\\t}\\n}' },
      ];`,
    });
    const r = jen(['code'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(
      read(dir, 'src/out.js'),
      'function outer() {\n' +
        '  if (x) {\n' +
        '    doSomething();\n' +
        '    if (y) {\n' +
        '      nested();\n' +
        '    }\n' +
        '  }\n' +
        '  // marker\n' +
        '}\n',
    );
  });

  it('is idempotent for multi-line blocks too', () => {
    const dir = fixture({
      'src/out.js': JS_FILE,
      '.jen/code.mjs': `export const actions = () => [
        { insert: 'src/out.js', before: '// marker', line: 'a();\\nb();' },
      ];`,
    });
    jen(['code'], { cwd: dir });
    const once = read(dir, 'src/out.js');
    const r = jen(['code'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /info: src[/\\]out\.js already has a\(\); …/);
    assert.equal(read(dir, 'src/out.js'), once);
  });

  it('reindents a multi-line modify replacement to the matched line, leaving the first line inline', () => {
    const dir = fixture({
      'config.txt': 'section {\n    // TODO\n}\n',
      '.jen/code.mjs': `export const actions = () => [
        { modify: 'config.txt', pattern: /\\/\\/ TODO/, replace: 'foo();\\n  if (x) {\\n    bar();\\n  }' },
      ];`,
    });
    const r = jen(['code'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(
      read(dir, 'config.txt'),
      'section {\n    foo();\n        if (x) {\n            bar();\n        }\n}\n',
    );
  });

  it('lets .editorconfig override the sniffed style for inserted blocks', () => {
    const dir = fixture({
      '.editorconfig': 'root = true\n\n[*.js]\nindent_style = tab\nindent_size = 1\n',
      'src/out.js': JS_FILE,
      '.jen/code.mjs': `export const actions = () => [
        { insert: 'src/out.js', before: '// marker', line: 'a();\\n  b();' },
      ];`,
    });
    jen(['code'], { cwd: dir });
    assert.equal(read(dir, 'src/out.js'), 'function outer() {\n  a();\n  \tb();\n  // marker\n}\n');
  });
});

// ─── Search path ────────────────────────────────────────────────────────────

describe('search path', () => {
  it('finds .jen/ from a subdirectory', () => {
    const dir = cppProject({ 'src/deep/er/.keep': '' });
    const r = jen(['class', '--name=foo', '--dir=../..'], { cwd: join(dir, 'src/deep/er') });
    assert.equal(r.code, 0, r.stderr);
    assert.ok(existsSync(join(dir, 'src/Foo.h')));
  });

  it('understands export default', () => {
    const dir = fixture({
      '.jen/hello.mjs': `export default { description: 'hi', actions: () => [{ add: 'hi.txt', template: 'hi' }] };`,
    });
    jen(['hello'], { cwd: dir });
    assert.equal(read(dir, 'hi.txt'), 'hi');
  });

  it('loads TypeScript generators', () => {
    const dir = fixture({
      '.jen/typed.ts': `export const actions = (a: Record<string, unknown>): { add: string; template: string }[] =>
        [{ add: 'typed.txt', template: 'ok' }];`,
    });
    const r = jen(['typed'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'typed.txt'), 'ok');
  });

  it('project shadows user; user: selects explicitly', () => {
    const userDir = fixture({
      'jen/class.mjs': `export const description = 'from user';
        export const actions = () => [{ add: 'user.txt', template: 'u' }];`,
    });
    const dir = cppProject();

    const list = jen(['--list'], { cwd: dir, userDir });
    assert.match(flatList(list.stdout), /class\s+project\s+C\+\+ class/);
    assert.match(flatList(list.stdout), /class\s+user\s+from user \(shadowed\)/);

    jen(['user:class'], { cwd: dir, userDir });
    assert.equal(read(dir, 'user.txt'), 'u');
  });

  it('also searches JEN_PATH', () => {
    const extra = fixture({ 'extra.mjs': `export const actions = () => [{ add: 'e.txt', template: 'e' }];` });
    const dir = fixture();
    const r = spawnSync(process.execPath, [JEN, 'extra'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, XDG_CONFIG_HOME: fixture(), JEN_PATH: extra, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(read(dir, 'e.txt'), 'e');
  });

  it('reports broken generators in --list instead of crashing', () => {
    const dir = fixture({ '.jen/broken.mjs': `export const foo = 1;` });
    const r = jen(['--list'], { cwd: dir });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /broken.*does not export an actions\(\) function/);
  });
});

// ─── Packs ──────────────────────────────────────────────────────────────────

describe('packs', () => {
  const PACK = {
    'node_modules/@codejen/pack-cpp/package.json': JSON.stringify({
      name: '@codejen/pack-cpp',
      type: 'module',
      exports: './index.mjs',
    }),
    'node_modules/@codejen/pack-cpp/index.mjs': `export default {
      class: { description: 'from the pack', actions: () => [{ add: 'pack.txt', template: 'p' }] },
      example: { description: 'example', actions: () => [] },
    };`,
  };

  it('loads packs from the project package.json with prefix', () => {
    const dir = cppProject({
      ...PACK,
      'package.json': JSON.stringify({ devDependencies: { '@codejen/pack-cpp': '^1.0.0' } }),
    });
    const list = jen(['--list'], { cwd: dir });
    assert.match(flatList(list.stdout), /cpp:class\s+pack @codejen\/pack-cpp\s+from the pack \(shadowed\)/);
    assert.match(list.stdout, /cpp:example/);

    jen(['cpp:class'], { cwd: dir });
    assert.equal(read(dir, 'pack.txt'), 'p');
  });

  it('loads packs from the user package.json', () => {
    const userDir = fixture({
      'jen/package.json': JSON.stringify({ dependencies: { '@codejen/pack-cpp': '^1.0.0' } }),
    });
    const dir = fixture(PACK);
    const r = jen(['example', '-n'], { cwd: dir, userDir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /cpp:example \(pack @codejen\/pack-cpp\)/);
  });

  it('ignores dependencies that are not jen packs', () => {
    const dir = cppProject({
      'package.json': JSON.stringify({ dependencies: { typescript: '^5.0.0' } }),
    });
    const r = jen(['--list'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /pack typescript/);
  });

  it('recognizes the unscoped jen-pack- prefix too', () => {
    const dir = cppProject({
      'node_modules/jen-pack-brainfuck/package.json': JSON.stringify({
        name: 'jen-pack-brainfuck',
        type: 'module',
        exports: './index.mjs',
      }),
      'node_modules/jen-pack-brainfuck/index.mjs': `export default {
        hello: { description: 'from brainfuck', actions: () => [] },
      };`,
      'package.json': JSON.stringify({ dependencies: { 'jen-pack-brainfuck': '^1.0.0' } }),
    });
    const list = jen(['--list'], { cwd: dir });
    assert.match(flatList(list.stdout), /brainfuck:hello\s+pack jen-pack-brainfuck/);
  });

  it('warns about missing packs and continues', () => {
    const dir = cppProject({
      'package.json': JSON.stringify({ dependencies: { '@nobody/pack-missing': '^1.0.0' } }),
    });
    const r = jen(['--list'], { cwd: dir });
    assert.equal(r.code, 0);
    assert.match(r.stderr, /Pack @nobody\/pack-missing not found/);
    assert.match(flatList(r.stdout), /class\s+project/);
  });

  it('reports a broken package.json', () => {
    const dir = fixture({ 'package.json': '{ broken' });
    const r = jen(['--list'], { cwd: dir });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /package\.json/);
  });
});

// ─── Pack factories ─────────────────────────────────────────────────────────

describe('pack factories', () => {
  // a pack whose generators depend on what's installed, like pack-yeoman: one per "thing-*" package
  const FACTORY = {
    'node_modules/jen-pack-things/package.json': JSON.stringify({ name: 'jen-pack-things', type: 'module', exports: './index.mjs' }),
    'node_modules/jen-pack-things/index.mjs': `export default async (env) => Object.fromEntries(
  env.packages(/^thing-/).map((name) => [name.slice(6), {
    description: 'thing at ' + env.resolve(name).split('node_modules/')[1],
    passthrough: true,
    actions: async (answers, helpers, ctx) => [
      { add: name + '.json', template: JSON.stringify(ctx.args) + '\\n' },
      { add: name + '.fetched.json', template: JSON.stringify(await env.fetch('thing-two')) + '\\n' },
      { add: name + '.bin', bytes: new Uint8Array([0, 255, 10, 13]) },
    ],
  }]),
);`,
    'node_modules/thing-one/package.json': JSON.stringify({ name: 'thing-one', main: 'index.js' }),
    'node_modules/thing-one/index.js': '',
    'package.json': JSON.stringify({ devDependencies: { 'jen-pack-things': '^1.0.0', 'thing-one': '^1.0.0' } }),
  };

  it('lists the generators a factory builds from the installed packages', () => {
    const r = jen(['--list'], { cwd: fixture(FACTORY) });
    assert.equal(r.code, 0, r.stderr);
    assert.match(flatList(r.stdout), /things:one\s+pack jen-pack-things\s+thing at thing-one\/index\.js/);
  });

  it('awaits async actions and hands over every flag and positional in ctx.args', () => {
    const dir = fixture(FACTORY);
    const r = jen(['things:one', 'a', 'b', '--name=x', '--flag', '--dir=out'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(JSON.parse(read(dir, 'out/thing-one.json')), { flags: { name: 'x', flag: true }, positionals: ['a', 'b'] });
  });

  it('lets a pack fetch, but not when fetching is off (JEN_NO_FETCH)', () => {
    const dir = fixture(FACTORY);
    jen(['things:one'], { cwd: dir });
    assert.equal(read(dir, 'thing-one.fetched.json'), 'null\n');
  });

  it('writes bytes as they are', () => {
    const dir = fixture(FACTORY);
    jen(['things:one'], { cwd: dir });
    assert.deepEqual([...readFileSync(join(dir, 'thing-one.bin'))], [0, 255, 10, 13]);
  });

  it('points jen 2 users of a Yeoman generator to pack-yeoman', () => {
    const dir = fixture({ 'package.json': JSON.stringify({ devDependencies: { 'generator-code': '^1.0.0' } }) });
    const r = jen(['code'], { cwd: dir });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /@codejen\/pack-yeoman now: jen yeoman:code/);
  });
});

// ─── --from ─────────────────────────────────────────────────────────────────
//
// --from does a real `npm install` into a throwaway directory, so a genuine
// end-to-end run needs the network – not part of this offline suite. What's
// covered here is what fails before npm is ever spawned.

describe('--from', () => {
  it('needs a pack-prefixed generator for a package that is not a pack, without touching the network', () => {
    const r = jen(['--from', 'lodash', 'x'], { cwd: fixture() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /"lodash" isn't a jen pack – name the pack's generator that runs it/);
    assert.doesNotMatch(r.stdout + r.stderr, /Fetching/);
  });

  it('strips the version from a scoped package spec before checking it', () => {
    const r = jen(['--from', '@acme/not-a-pack@1.2.3', 'x'], { cwd: fixture() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /"@acme\/not-a-pack" isn't a jen pack/);
  });

  it('rejects anything that is not a plain npm package name', () => {
    const r = jen(['--from', 'git+https://example.com/x.git', 'x:y'], { cwd: fixture() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /isn't an npm package name/);
  });
});

// ─── Built-ins ──────────────────────────────────────────────────────────────

describe('Built-in "generator"', () => {
  it('creates a runnable generator in the project', () => {
    const dir = fixture();
    const r = jen(['generator', '--name=My Gen', '--location=project'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.ok(existsSync(join(dir, '.jen/my-gen.mjs')));

    const run = jen(['my-gen', '--name=world'], { cwd: dir });
    assert.equal(run.code, 0, run.stderr);
    assert.equal(read(dir, 'World.txt'), 'Hello world!\n');
  });

  it('creates a generator in the user directory', () => {
    const userDir = fixture();
    const dir = fixture();
    jen(['generator', '--name=mine', '--location=user'], { cwd: dir, userDir });
    assert.ok(existsSync(join(userDir, 'jen/mine.mjs')));
    assert.match(flatList(jen(['--list'], { cwd: dir, userDir }).stdout), /mine\s+user/);
  });
});

describe('Built-in "generator" --like', () => {
  const ROUTE = "/** GET /users – all users. */\nexport const users = { path: '/users', usersCount: 0 };\n// superusers, Users, USERS\n";
  const ROUTE_TEST = "import { users } from '../../src/routes/users.js';\ntest('users', () => users);\n";
  const INDEX = "import { users } from './users.js';\nexport const routes = [users];\n";
  const routes = () =>
    fixture({ 'package.json': '{}', 'src/routes/users.js': ROUTE, 'test/routes/users.test.js': ROUTE_TEST, 'src/routes/index.js': INDEX });
  const LIKE = '--like=src/routes/users.js,test/routes/users.test.js';

  it('drafts a generator that reproduces the files byte for byte', () => {
    const dir = routes();
    const r = jen(['generator', '--name=route', LIKE], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /reproduces src\/routes\/users\.js, test\/routes\/users\.test\.js – replaced users 12×/);
    assert.match(read(dir, '.jen/route.mjs'), /examples: \["--name=users"\]/);
    rmSync(join(dir, 'src/routes/users.js'));
    rmSync(join(dir, 'test/routes/users.test.js'));
    assert.equal(jen(['route', '--name=users'], { cwd: dir }).code, 0);
    assert.equal(read(dir, 'src/routes/users.js'), ROUTE);
    assert.equal(read(dir, 'test/routes/users.test.js'), ROUTE_TEST);
  });

  it('templates every case, but only whole names', () => {
    const dir = routes();
    jen(['generator', '--name=route', LIKE], { cwd: dir });
    const r = jen(['route', '--name=order-items'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(
      read(dir, 'src/routes/order-items.js'),
      "/** GET /order-items – all orderItems. */\nexport const orderItems = { path: '/order-items', usersCount: 0 };\n// superusers, OrderItems, ORDER_ITEMS\n",
    );
    assert.match(read(dir, 'test/routes/order-items.test.js'), /from '\.\.\/\.\.\/src\/routes\/order-items\.js'/);
  });

  it('takes a multi-word name from the file and keeps template literals exact', () => {
    const card = 'export function UserCard() {\n\treturn `<div class="user-card">${userCard} \\n \\` ${"x"}</div>`;\n}\r\n';
    const dir = fixture({ 'package.json': '{}', '.editorconfig': 'root = true\n[*]\nindent_style = space\nindent_size = 2\n', 'src/UserCard.jsx': card });
    assert.equal(jen(['generator', '--name=card', '--like=src/UserCard.jsx'], { cwd: dir }).code, 0);
    assert.match(read(dir, '.jen/card.mjs'), /\$\{pascal\(name\)\}.*\$\{kebab\(name\)\}.*\$\{camel\(name\)\}/s);
    rmSync(join(dir, 'src/UserCard.jsx'));
    const r = jen(['card', '--name=UserCard'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    // the generated file gets the project's EditorConfig, as any add; the draft's own template doesn't
    assert.equal(read(dir, 'src/UserCard.jsx'), card.replaceAll('\t', '  ').replaceAll('\r\n', '\n'));
  });

  it('names other files that mention the word, without changing them', () => {
    const dir = routes();
    const r = jen(['generator', '--name=route', LIKE], { cwd: dir });
    assert.match(r.stdout, /info: src\/routes\/index\.js mentions users too \(lines 1 and 2\)/);
    assert.match(r.stdout, /left as they are: usersCount, superusers/);
    assert.equal(read(dir, 'src/routes/index.js'), INDEX);
  });

  it('refuses directories, binaries, missing files, paths outside, and a word that never occurs', () => {
    const dir = fixture({ 'package.json': '{}', 'a/b.txt': 'b\n', 'bin.dat': 'x\0y', 'sub/x.txt': 'x\n' });
    const fails = (args: string[], re: RegExp, cwd = dir) => {
      const r = jen(['generator', '--name=g', ...args], { cwd });
      assert.equal(r.code, 1, args.join(' '));
      assert.match(r.stderr, re);
      assert.ok(!existsSync(join(dir, '.jen')));
    };
    fails(['--like=a'], /a is a directory/);
    fails(['--like=bin.dat'], /bin\.dat is a binary file/);
    fails(['--like=nope.js'], /nope\.js doesn't exist/);
    fails(['--like=../../x.txt'], /outside the project root/, join(dir, 'sub'));
    fails(['--like=a/b.txt', '--word=users'], /"users" doesn't occur in a\/b\.txt – pass --word=/);
    fails(['--word=users'], /--word only works with --like/);
  });

  it('writes nothing with --dry-run', () => {
    const dir = routes();
    const r = jen(['generator', '--name=route', LIKE, '--dry-run'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /\+ \.jen\/route\.mjs/);
    assert.ok(!existsSync(join(dir, '.jen/route.mjs')));
  });
});

// ─── Project root & destination ─────────────────────────────────────────────

const HERE_GEN = `
export const params = { name: {} };
export const actions = ({ name }, { pascal }, ctx) => [
  { add: \`\${pascal(name)}.h\`, template: ctx.destDir + ' ' + ctx.cwd + '\\n' },
  { add: \`\${pascal(name)}.cpp\`, template: '\\n' },
  { add: '/notes/' + name + '.txt', template: '\\n' },
  { insert: { find: 'CMakeLists.txt' }, before: '# jen:sources', path: \`\${pascal(name)}.cpp\` },
];
`;

const OWN_DIR_GEN = `
export const params = { name: {}, dir: { default: 'out' } };
export const actions = ({ name, dir }, _h, ctx) => [{ add: dir + '/' + name + '.txt', template: ctx.destDir + '\\n' }];
`;

const SOURCES = 'add_library(app\n  # jen:sources\n)\n';

const project = (files: Record<string, string> = {}) =>
  fixture({ 'package.json': '{}', '.jen/here.mjs': HERE_GEN, '.jen/owndir.mjs': OWN_DIR_GEN, ...files });

describe('project root', () => {
  it('walks up from a subfolder; a path starting with / is relative to it', () => {
    const dir = project({ 'docs/.keep': '' });
    const r = jen(['here', '--name=foo'], { cwd: join(dir, 'docs') });
    assert.equal(r.code, 0, r.stderr);
    assert.ok(existsSync(join(dir, 'notes/foo.txt')));
    assert.match(r.stdout, /root: \.\. \(\.jen\)/);
  });

  it('finds the root by package.json or .git when there is no .jen/', () => {
    const user = fixture({ 'jen/here.mjs': HERE_GEN });
    const viaPkg = fixture({ 'package.json': '{}', 'a/b/.keep': '' });
    assert.equal(jen(['here', '--name=foo'], { cwd: join(viaPkg, 'a/b'), userDir: user }).code, 0);
    assert.ok(existsSync(join(viaPkg, 'notes/foo.txt')));
    const viaGit = fixture({ '.git/HEAD': '', 'a/.keep': '' });
    assert.equal(jen(['here', '--name=foo'], { cwd: join(viaGit, 'a'), userDir: user }).code, 0);
    assert.ok(existsSync(join(viaGit, 'notes/foo.txt')));
  });

  it('does not look for .jen/ above the repository', () => {
    const outer = project({ 'repo/.git/HEAD': '', 'repo/a/.keep': '' });
    const r = jen(['here', '--name=foo'], { cwd: join(outer, 'repo/a') });
    assert.equal(r.code, 1);
    assert.ok(!existsSync(join(outer, 'foo.txt')));
  });

  it('does not look for .jen/ above the home directory', () => {
    const outer = project({ 'home/a/.keep': '' });
    const r = jen(['here', '--name=foo'], { cwd: join(outer, 'home/a'), home: join(outer, 'home') });
    assert.equal(r.code, 1);
    assert.ok(!existsSync(join(outer, 'foo.txt')));
  });

  it('ignores a world-writable .jen/', { skip: process.platform === 'win32' }, () => {
    const dir = project();
    chmodSync(join(dir, '.jen'), 0o777);
    const r = jen(['here', '--name=foo'], { cwd: dir });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /ignoring .*\.jen: not owned by you, or writable by others/);
    assert.ok(!existsSync(join(dir, 'foo.txt')));
  });

});

describe('destination', () => {
  it('is the current directory, at the project root too', () => {
    const dir = project({ 'src/net/.keep': '' });
    jen(['here', '--name=a'], { cwd: dir });
    assert.equal(read(dir, 'A.h').trim(), '. .');
    jen(['here', '--name=b'], { cwd: join(dir, 'src/net') });
    assert.equal(read(dir, 'src/net/B.h').trim(), 'src/net src/net');
  });

  it('--dir is relative to the current directory', () => {
    const dir = project({ 'docs/.keep': '' });
    jen(['here', '--name=foo', '--dir=../src/main/cpp'], { cwd: join(dir, 'docs') });
    assert.equal(read(dir, 'src/main/cpp/Foo.h').trim(), 'src/main/cpp docs');
  });

  it('refuses a --dir outside the project', () => {
    const r = jen(['here', '--name=foo', '--dir=../../elsewhere'], { cwd: project() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /outside the project root/);
  });

  it('leaves a generator\'s own dir param alone', () => {
    const dir = project();
    const r = jen(['owndir', '--name=a', '--dir=custom'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'custom/a.txt').trim(), '.');
  });

  it('touches nothing outside the project', () => {
    const dir = fixture({
      '.jen/out.mjs': `export const actions = () => [
        { add: '../escaped.txt', template: 'x' },
        { add: '/../escaped.txt', template: 'x' },
        { add: 'ok.txt', template: 'ok' },
      ];`,
    });
    const r = jen(['out'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    // both name the same file, so the plan says it once
    assert.equal((r.stdout.match(/warning: .*escaped\.txt is outside the project, skipped/g) ?? []).length, 1);
    assert.ok(!existsSync(join(dir, '../escaped.txt')));
    assert.equal(read(dir, 'ok.txt'), 'ok');
  });
});

describe('find targets', () => {
  it('insert into the nearest file with the marker, with path relative to it', () => {
    const dir = project({ 'src/CMakeLists.txt': SOURCES, 'src/net/.keep': '' });
    const r = jen(['here', '--name=socket'], { cwd: join(dir, 'src/net') });
    assert.equal(r.code, 0, r.stderr);
    assert.ok(existsSync(join(dir, 'src/net/Socket.cpp')));
    assert.equal(read(dir, 'src/CMakeLists.txt'), 'add_library(app\n  net/Socket.cpp\n  # jen:sources\n)\n');
  });

  it('prefers a nearer file, and skips one without the marker', () => {
    const dir = project({ 'src/CMakeLists.txt': SOURCES, 'src/net/CMakeLists.txt': SOURCES, 'src/net/tls/CMakeLists.txt': 'nothing\n' });
    jen(['here', '--name=tls'], { cwd: join(dir, 'src/net/tls') });
    assert.equal(read(dir, 'src/net/CMakeLists.txt'), 'add_library(app\n  tls/Tls.cpp\n  # jen:sources\n)\n');
    assert.equal(read(dir, 'src/CMakeLists.txt'), SOURCES);
  });

  it('falls back to the shallowest one anywhere in the project', () => {
    const dir = project({ 'lib/CMakeLists.txt': SOURCES, 'docs/.keep': '' });
    jen(['here', '--name=foo'], { cwd: join(dir, 'docs') });
    assert.equal(read(dir, 'lib/CMakeLists.txt'), 'add_library(app\n  ../docs/Foo.cpp\n  # jen:sources\n)\n');
  });

  it('skips with a note when there is none', () => {
    const dir = project();
    const r = jen(['here', '--name=foo'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /no CMakeLists\.txt containing "# jen:sources" found, skipped/);
    assert.ok(existsSync(join(dir, 'Foo.h')));
  });

  it('takes a RegExp name and an explicit containing, e.g. for modify', () => {
    const dir = fixture({
      'src/app.cpp': '// jen:includes\nint main() {}\n',
      'src/other.cpp': 'int x;\n',
      '.jen/inc.mjs': `export const actions = () => [
        { modify: { find: /\\.cpp$/, containing: '// jen:includes' }, pattern: /^/, replace: '#include <tracy>\\n' },
      ];`,
    });
    const r = jen(['inc'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'src/app.cpp'), '#include <tracy>\n// jen:includes\nint main() {}\n');
    assert.equal(read(dir, 'src/other.cpp'), 'int x;\n');
  });

  it('never shows a RegExp name in the note, and takes a note of its own', () => {
    const dir = fixture({
      '.jen/plain.mjs': `export const actions = () => [{ insert: { find: /\\.css$/, containing: 'jen:imports' }, before: 'jen:imports', line: 'x' }];`,
      '.jen/own.mjs': `export const actions = () => [{ insert: { find: /\\.css$/, missing: 'run jen web:base first' }, before: 'x', line: 'x' }];`,
    });
    const plain = jen(['plain'], { cwd: dir });
    assert.equal(plain.code, 0, plain.stderr);
    assert.match(plain.stdout, /\n {2}warning: no file containing "jen:imports" found, skipped\n/);
    // its own note is a hint, not a problem
    assert.match(jen(['own'], { cwd: dir }).stdout, /\n {2}info: run jen web:base first\n/);
  });
});

describe('path params', () => {
  const INTO_GEN = `export const params = { into: { path: true, default: '' } };
export const actions = ({ into }) => [{ insert: into, before: '// jen:functions', line: 'float f();' }];`;

  it('are relative to the current directory, ready to use as an action path', () => {
    const dir = fixture({ 'package.json': '{}', '.jen/into.mjs': INTO_GEN, 'shaders/main.glsl': '// jen:functions\n' });
    const r = jen(['into', '--into=main.glsl'], { cwd: join(dir, 'shaders') });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'shaders/main.glsl'), 'float f();\n// jen:functions\n');
  });

  it('fail outside the project', () => {
    const dir = fixture({ 'package.json': '{}', '.jen/into.mjs': INTO_GEN });
    const r = jen(['into', '--into=../../x.glsl'], { cwd: dir });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /--into=\.\.\/\.\.\/x\.glsl is outside the project root/);
  });
});

// ─── For programs: --json runs and errors, --find, recipes ──────────────────

describe('for programs', () => {
  const DEMO = `export default {
    card: {
      description: 'a card block for content',
      params: { tone: { default: 'plain', choices: ['plain', 'loud'] }, round: { default: false } },
      usage: ['<article class="card">…</article>'],
      examples: ['--tone=loud'],
      actions: () => [{ add: 'card.css', template: '.card {}' }, { note: 'cards need a palette' }],
    },
    sidebar: { description: 'a sidebar layout next to the content', params: { name: {} }, actions: () => [] },
    plain: { description: 'emits json itself', params: { json: { default: false } }, actions: ({ json }) => [{ note: json ? 'own json' : 'no json' }] },
  };
  export const recipes = [{ name: 'dashboard', description: 'a dashboard page with cards', steps: ['demo:card', 'demo:sidebar --name=x'], usage: ['<main>…</main>'], docs: 'https://example.com/#dashboard' }];`;
  const project = () =>
    fixture({
      'package.json': JSON.stringify({ dependencies: { '@codejen/pack-demo': '*' } }),
      'node_modules/@codejen/pack-demo/package.json': JSON.stringify({ name: '@codejen/pack-demo', type: 'module', exports: './index.mjs' }),
      'node_modules/@codejen/pack-demo/index.mjs': DEMO,
    });
  const parse = (text: string) => JSON.parse(text) as Record<string, unknown>;
  const error = (r: { stderr: string }) => (parse(r.stderr) as { error: Record<string, unknown> }).error;

  it('prints the plan as JSON with --json, and nothing else on stdout', () => {
    const dir = project();
    const dry = jen(['demo:card', '--json', '--dry-run'], { cwd: dir });
    assert.equal(dry.code, 0, dry.stderr);
    assert.deepEqual(parse(dry.stdout), {
      generator: 'demo:card',
      source: 'pack @codejen/pack-demo',
      dryRun: true,
      steps: [{ kind: 'created', file: 'card.css' }, { kind: 'info', note: 'cards need a palette' }],
      written: 0,
      deleted: 0,
    });
    assert.ok(!existsSync(join(dir, 'card.css')));
    const run = parse(jen(['demo:card', '--json'], { cwd: dir }).stdout);
    assert.equal(run.written, 1);
    assert.ok(existsSync(join(dir, 'card.css')));
    const rerun = parse(jen(['demo:card', '--json'], { cwd: dir }).stdout) as { steps: unknown[]; written: number };
    assert.equal(rerun.written, 0);
    assert.deepEqual(rerun.steps[0], { kind: 'info', file: 'card.css', note: 'exists, skipped' });
  });

  it('shows the line of an insert', () => {
    const dir = fixture({
      'list.txt': 'a\n# marker\n',
      '.jen/put.mjs': `export const actions = () => [{ insert: 'list.txt', before: '# marker', line: 'b' }];`,
    });
    const r = parse(jen(['put', '--json'], { cwd: dir }).stdout) as { steps: unknown[] };
    assert.deepEqual(r.steps, [{ kind: 'changed', file: 'list.txt', line: 2, note: '+ b' }]);
  });

  it('prints errors as JSON on stderr, with a code and what a program needs to repair the call', () => {
    const dir = project();
    const missing = jen(['demo:sidebar', '--json'], { cwd: dir });
    assert.equal(missing.code, 1);
    assert.equal(missing.stdout, '');
    const m = error(missing);
    assert.equal(m.code, 'missing_param');
    assert.deepEqual(m.missing, ['--name']);
    assert.deepEqual((m.params as Record<string, unknown>).name, { required: true });

    const flag = error(jen(['demo:card', '--tome=loud', '--json'], { cwd: dir }));
    assert.equal(flag.code, 'unknown_flag');
    assert.deepEqual(flag.flags, [{ flag: '--tome', didYouMean: '--tone' }]);
    assert.deepEqual(flag.known, ['--tone', '--round']);

    assert.deepEqual(error(jen(['demo:card', '--tone=quiet', '--json'], { cwd: dir })), {
      code: 'bad_value',
      message: 'demo:card --tone: expected one of "plain", "loud", got "quiet"',
      param: 'tone',
      value: 'quiet',
      choices: ['plain', 'loud'],
    });
    assert.equal(error(jen(['demo:card', '--round=maybe', '--json'], { cwd: dir })).expected, 'boolean');

    const notFound = error(jen(['demo:crad', '--json'], { cwd: dir }));
    assert.equal(notFound.code, 'not_found');
    assert.deepEqual(notFound.didYouMean, ['demo:card']);
    assert.equal(error(jen(['lua', '--list', '--json'], { cwd: dir })).code, 'unknown_pack');
  });

  it('keeps errors as text without --json', () => {
    const r = jen(['demo:card', '--tone=quiet'], { cwd: project() });
    assert.match(r.stderr, /^demo:card --tone: expected one of/);
  });

  it("leaves --json to a generator that has a json param of its own", () => {
    const r = jen(['demo:plain', '--json'], { cwd: project() });
    assert.match(r.stdout, /info: own json/);
  });

  it('prints one generator as JSON with --help --json', () => {
    const g = parse(jen(['demo:card', '--help', '--json'], { cwd: project() }).stdout);
    assert.equal(g.name, 'demo:card');
    assert.deepEqual(g.usage, ['<article class="card">…</article>']);
  });

  it('finds generators and recipes by words, best first', () => {
    const dir = project();
    const r = jen(['--find', 'sidebar layout'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /^ {2}demo:sidebar +a sidebar layout next to the content\n/);
    assert.match(r.stdout, /Not installed, so not searched: cpp, glsl, js, web, yeoman – jen <pack> --find "sidebar layout"/);
    const cards = jen(['demo', '--find', 'Cards'], { cwd: dir }).stdout;
    assert.match(
      cards,
      /^ {2}demo:card +a card block for content\n {2}recipe: dashboard +a dashboard page with cards \(@codejen\/pack-demo\)\n {4}jen demo:card\n {4}jen demo:sidebar --name=x\n {4}<main>…<\/main>\n {4}docs: https:\/\/example\.com\/#dashboard\n$/,
      'with its markup, as in --json',
    );
    assert.match(jen(['--find', 'spaceship'], { cwd: dir }).stdout, /^Nothing matches "spaceship"/);
    assert.match(jen(['--find', ''], { cwd: dir }).stderr, /--find needs words/);
  });

  it('finds with --json: generators as in --list --json, recipes with their steps and usage', () => {
    const found = parse(jen(['demo', '--find', 'dashboard', '--json'], { cwd: project() }).stdout) as { query: string; results: Array<Record<string, unknown>> };
    assert.equal(found.query, 'dashboard');
    assert.deepEqual(found.results[0], {
      kind: 'recipe',
      score: (found.results[0] as { score: number }).score,
      name: 'dashboard',
      pack: '@codejen/pack-demo',
      description: 'a dashboard page with cards',
      steps: ['jen demo:card', 'jen demo:sidebar --name=x'],
      usage: ['<main>…</main>'],
      docs: 'https://example.com/#dashboard',
    });
    assert.equal(found.results.length, 1);
    const cards = parse(jen(['demo', '--find', 'card block', '--json'], { cwd: project() }).stdout) as { results: Array<Record<string, unknown>> };
    assert.deepEqual(cards.results[0], { kind: 'generator', score: cards.results[0].score, name: 'demo:card', source: 'pack @codejen/pack-demo', description: 'a card block for content' });
  });

  it("lists a pack's recipes, in --list --json without their markup", () => {
    const dir = project();
    assert.match(
      jen(['demo', '--list'], { cwd: dir }).stdout,
      /^recipes – start here, each one a whole thing in a few commands:\n {2}dashboard +a dashboard page with cards – how it fits together: jen --find dashboard\n {4}jen demo:card\n {4}jen demo:sidebar --name=x\n\npack @codejen\/pack-demo\n/,
    );
    const { packs } = JSON.parse(jen(['demo', '--list', '--json'], { cwd: dir }).stdout) as { packs: Array<{ recipes: unknown[] }> };
    assert.deepEqual(packs[0].recipes, [{ name: 'dashboard', description: 'a dashboard page with cards', steps: ['jen demo:card', 'jen demo:sidebar --name=x'], docs: 'https://example.com/#dashboard' }]);
  });

  it("puts a group's generators on one line in --list, and every one of them in --list --json", () => {
    const dir = project();
    const index = join(dir, 'node_modules/@codejen/pack-demo/index.mjs');
    writeFileSync(index, `${read(dir, 'node_modules/@codejen/pack-demo/index.mjs')}\nexport const groups = [{ name: 'layout', description: 'layout parts', generators: ['card', 'sidebar'] }];`);
    const out = jen(['demo', '--list'], { cwd: dir }).stdout;
    assert.match(out, /\n {2}layout +layout parts: demo:card, demo:sidebar\n {2}demo:plain +emits json itself\n/);
    assert.doesNotMatch(out, /a card block for content/);
    const { generators, packs } = JSON.parse(jen(['demo', '--list', '--json'], { cwd: dir }).stdout) as { generators: Array<{ name: string }>; packs: Array<Record<string, unknown>> };
    assert.deepEqual(generators.map((g) => g.name).sort(), ['demo:card', 'demo:plain', 'demo:sidebar']);
    assert.ok(!('groups' in packs[0]));
  });
});
