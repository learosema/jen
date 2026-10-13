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

  it('lists generators and exits 1 when none is given', () => {
    const r = jen([], { cwd: cppProject() });
    assert.equal(r.code, 1);
    assert.match(r.stdout, /class\s+project\s+C\+\+ class/);
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
    jen(['class', '--name=foo'], { cwd: dir });
    assert.equal(read(dir, 'src/Foo.h'), 'alt');
    jen(['class', '--name=foo', '--force'], { cwd: dir });
    assert.equal(read(dir, 'src/Foo.h'), 'class Foo {};\n');
  });

  it('reports missing markers without aborting', () => {
    const dir = cppProject({ 'src/CMakeLists.txt': 'add_executable(app main.cpp)\n' });
    const r = jen(['class', '--name=foo'], { cwd: dir });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /marker "# scaffold:sources" not found/);
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
    assert.match(r.stdout, /marker \/\^nope\/ not found/);
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
    assert.match(r.stdout, /\+ <button>Menu<\/button> at line 3/);
    assert.match(r.stdout, /line 9 is not in the file \(7 lines\)/);
    assert.match(r.stdout, /line 0 is not in the file/);
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
    jen(['bump'], { cwd: dir });
    assert.equal(read(dir, 'VERSION'), 'version=0.2.0\n');
  });

  it('reports when nothing matches', () => {
    const dir = fixture({
      'VERSION': 'nix\n',
      '.jen/bump.mjs': `export const actions = () => [{ modify: 'VERSION', pattern: /\\d+/, replace: '1' }];`,
    });
    const r = jen(['bump'], { cwd: dir });
    assert.match(r.stdout, /no match/);
    assert.match(r.stdout, /Nothing to do/);
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
    assert.match(r.stdout, /does not exist/);
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
    assert.equal((r.stdout.match(/outside the project/g) ?? []).length, 2);
    assert.match(r.stdout, /is a directory/);
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

  it('fails with exit code 1 when a required param is missing', () => {
    const r = jen(['class'], { cwd: cppProject() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /Missing: --name/);
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
        '  --into=""',
        '  --moveOnly  RAII wrapper: copy deleted, move defaulted (Rule of Five)',
        '  --withTest  add a doctest case',
        '',
      ].join('\n'),
    );
    assert.ok(!existsSync(join(dir, 'never.txt')));
  });

  it('shows a boolean that defaults to true with its value', () => {
    const dir = fixture({ '.jen/on.mjs': `export const params = { cmake: { default: true } }; export const actions = () => [];` });
    assert.equal(jen(['on', '--help'], { cwd: dir }).stdout, 'on\n  --cmake=true\n');
  });

  it('shows the pack prefix', () => {
    const dir = fixture({
      'package.json': JSON.stringify({ dependencies: { '@codejen/pack-demo': '*' } }),
      'node_modules/@codejen/pack-demo/package.json': JSON.stringify({ name: '@codejen/pack-demo', type: 'module', exports: './index.mjs' }),
      'node_modules/@codejen/pack-demo/index.mjs': `export default { hello: { description: 'say hi', actions: () => [] } };`,
    });
    assert.equal(jen(['demo:hello', '--help'], { cwd: dir }).stdout, 'demo:hello – say hi\n');
  });

  it('reports an unknown generator without fetching anything', () => {
    const r = jen(['lua:function', '--help'], { cwd: fixture() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /"lua:function" not found/);
  });

  it('still shows the general help without a generator', () => {
    assert.match(jen(['--help'], { cwd: fixture() }).stdout, /--list,\s+-l/);
  });
});

describe('jen --list --json', () => {
  it('lists every generator with typed params', () => {
    const dir = fixture({ '.jen/class.mjs': DESCRIBED_GEN });
    const r = jen(['--list', '--json'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    const catalog = JSON.parse(r.stdout);
    const cls = catalog.find((g: { name: string }) => g.name === 'class');
    assert.deepEqual(cls, {
      name: 'class',
      source: 'project',
      shadowed: false,
      description: 'create a C++ class (header + source)',
      params: {
        name: { type: 'string', required: true },
        namespace: { type: 'string', required: false, default: '' },
        dir: { type: 'string', required: false, default: 'src' },
        members: { type: 'string', required: false, default: 'int a, int b' },
        into: { type: 'string', required: false, default: '', path: true },
        moveOnly: {
          type: 'boolean',
          required: false,
          default: false,
          description: 'RAII wrapper: copy deleted, move defaulted (Rule of Five)',
        },
        withTest: { type: 'boolean', required: false, default: false, description: 'add a doctest case' },
      },
    });
    assert.ok(catalog.some((g: { name: string; source: string }) => g.name === 'generator' && g.source === 'built-in'));
  });

  it('marks shadowed generators', () => {
    const userDir = fixture({ 'jen/class.mjs': `export const actions = () => [];` });
    const r = jen(['--list', '--json'], { cwd: fixture({ '.jen/class.mjs': DESCRIBED_GEN }), userDir });
    const classes = JSON.parse(r.stdout).filter((g: { name: string }) => g.name === 'class');
    assert.deepEqual(
      classes.map((g: { source: string; shadowed: boolean }) => [g.source, g.shadowed]),
      [
        ['project', false],
        ['user', true],
      ],
    );
  });

  it('reports broken generators with an error instead of aborting', () => {
    const r = jen(['--list', '--json'], { cwd: fixture({ '.jen/broken.mjs': `export const foo = 1;` }) });
    assert.equal(r.code, 0);
    const broken = JSON.parse(r.stdout).find((g: { name: string }) => g.name === 'broken');
    assert.match(broken.error, /does not export an actions\(\) function/);
    assert.equal(broken.params, undefined);
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
    assert.match(r.stdout, /already present/);
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
    assert.match(list.stdout, /class\s+project\s+C\+\+ class/);
    assert.match(list.stdout, /class\s+user\s+from user \(shadowed\)/);

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
    assert.match(list.stdout, /cpp:class\s+pack @codejen\/pack-cpp\s+from the pack \(shadowed\)/);
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
    assert.match(list.stdout, /brainfuck:hello\s+pack jen-pack-brainfuck/);
  });

  it('warns about missing packs and continues', () => {
    const dir = cppProject({
      'package.json': JSON.stringify({ dependencies: { '@nobody/pack-missing': '^1.0.0' } }),
    });
    const r = jen(['--list'], { cwd: dir });
    assert.equal(r.code, 0);
    assert.match(r.stderr, /Pack @nobody\/pack-missing not found/);
    assert.match(r.stdout, /class\s+project/);
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
    assert.match(r.stdout, /things:one\s+pack jen-pack-things\s+thing at thing-one\/index\.js/);
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
    assert.match(jen(['--list'], { cwd: dir, userDir }).stdout, /mine\s+user/);
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
    assert.equal((r.stdout.match(/outside the project/g) ?? []).length, 2);
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
