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
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { helpers } from './src/jen.ts';

const JEN = join(import.meta.dirname, 'src/jen.ts');

/** A dependency's own directory, wherever npm workspaces happened to hoist it to. */
function packageDir(name: string): string {
  const resolved = createRequire(import.meta.url).resolve(name);
  const marker = join('node_modules', name);
  return resolved.slice(0, resolved.lastIndexOf(marker) + marker.length);
}
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
    assert.doesNotMatch(r.stdout, /Fetching/);
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

// ─── Yeoman generators ──────────────────────────────────────────────────────
//
// These run a real `yeoman-generator` Generator subclass – not jen's own
// fixture shape – through the shim in src/yeoman.ts, to prove real Yeoman
// generators actually work, not just something shaped like one. jen adds no
// runtime dependency for this; yeoman-generator/mem-fs are devDependencies
// used only for typechecking and these tests, symlinked into each fixture so
// the spawned `jen` process resolves them exactly as it would a real
// project's own node_modules.

describe('yeoman generators', () => {
  function withRealYeoman(dir: string): void {
    const nodeModules = join(dir, 'node_modules');
    mkdirSync(nodeModules, { recursive: true });
    for (const pkg of ['yeoman-generator', 'mem-fs']) {
      symlinkSync(packageDir(pkg), join(nodeModules, pkg), 'dir');
    }
  }

  const WIDGET = {
    'node_modules/generator-widget/package.json': JSON.stringify({
      name: 'generator-widget',
      type: 'module',
      main: './index.mjs',
    }),
    'node_modules/generator-widget/index.mjs': `
import Generator from 'yeoman-generator';
export default class extends Generator {
  constructor(args, opts) {
    super(args, opts);
    this.option('name', { type: String });
  }
  async prompting() {
    const { greeting } = await this.prompt({ name: 'greeting', message: 'Greeting?', default: 'Hello' });
    this.greeting = greeting;
  }
  writing() {
    this.fs.write(this.destinationPath('out.txt'), \`\${this.greeting}, \${this.options.name}!\\n\`);
    this.fs.copyTpl(this.templatePath('tpl.txt'), this.destinationPath('rendered.txt'), { name: this.options.name });
  }
  install() {
    this.fs.write(this.destinationPath('should-not-exist.txt'), 'nope');
  }
};
`,
    'node_modules/generator-widget/templates/tpl.txt': 'Hi <%= name %>!\n',
    'package.json': JSON.stringify({ devDependencies: { 'generator-widget': '^1.0.0' } }),
  };

  it('lists a Yeoman generator by its short package name', () => {
    const dir = fixture(WIDGET);
    withRealYeoman(dir);
    const r = jen(['--list'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /widget\s+yeoman generator-widget/);
  });

  it('runs a real yeoman-generator class end to end, using EJS via the real copyTpl', () => {
    const dir = fixture(WIDGET);
    withRealYeoman(dir);
    const r = jen(['widget', '--name=World'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'out.txt'), 'Hello, World!\n');
    assert.equal(read(dir, 'rendered.txt'), 'Hi World!\n');
  });

  it('writes where you stand, like yo', () => {
    const dir = fixture({ ...WIDGET, 'sub/.keep': '' });
    withRealYeoman(dir);
    const r = jen(['widget', '--name=World'], { cwd: join(dir, 'sub') });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'sub/out.txt'), 'Hello, World!\n');
  });

  it('never runs the install/end priorities', () => {
    const dir = fixture(WIDGET);
    withRealYeoman(dir);
    const r = jen(['widget', '--name=World'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(existsSync(join(dir, 'should-not-exist.txt')), false);
  });

  it('answers a prompt from a CLI flag instead of its default', () => {
    const dir = fixture(WIDGET);
    withRealYeoman(dir);
    const r = jen(['widget', '--name=World', '--greeting=Hi'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'out.txt'), 'Hi, World!\n');
  });

  it('skips existing files unless --force, same as a native generator', () => {
    const dir = fixture(WIDGET);
    withRealYeoman(dir);
    jen(['widget', '--name=World'], { cwd: dir });
    const r = jen(['widget', '--name=Someone'], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /exists, skipped/);
    assert.equal(read(dir, 'out.txt'), 'Hello, World!\n');
  });

  it('fails clearly instead of prompting when a question has no default and no CLI answer', () => {
    const dir = fixture({
      'node_modules/generator-strict/package.json': JSON.stringify({
        name: 'generator-strict',
        type: 'module',
        main: './index.mjs',
      }),
      'node_modules/generator-strict/index.mjs': `
import Generator from 'yeoman-generator';
export default class extends Generator {
  async prompting() {
    await this.prompt({ name: 'flavor', message: 'Flavor?' });
  }
  writing() {
    this.fs.write(this.destinationPath('never.txt'), 'nope');
  }
};
`,
      'package.json': JSON.stringify({ devDependencies: { 'generator-strict': '^1.0.0' } }),
    });
    withRealYeoman(dir);
    const r = jen(['strict'], { cwd: dir });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /Missing: --flavor/);
    assert.equal(existsSync(join(dir, 'never.txt')), false);
  });

  it('recognizes the scoped @scope/generator- prefix too', () => {
    const dir = fixture({
      'node_modules/@acme/generator-thing/package.json': JSON.stringify({
        name: '@acme/generator-thing',
        type: 'module',
        main: './index.mjs',
      }),
      'node_modules/@acme/generator-thing/index.mjs': `
import Generator from 'yeoman-generator';
export default class extends Generator {
  writing() {
    this.fs.write(this.destinationPath('thing.txt'), 'thing\\n');
  }
};
`,
      'package.json': JSON.stringify({ devDependencies: { '@acme/generator-thing': '^1.0.0' } }),
    });
    withRealYeoman(dir);
    const list = jen(['--list'], { cwd: dir });
    assert.match(list.stdout, /thing\s+yeoman @acme\/generator-thing/);
  });
});

// ─── --from ─────────────────────────────────────────────────────────────────
//
// --from does a real `npm install` into a throwaway directory, so a genuine
// end-to-end run needs the network – verified by hand against the real
// generator-code, not part of this offline suite. What's covered here is the
// part that never touches the network at all: --from validates the package
// name against the same jen-pack-*/generator-* convention as normal
// discovery before spawning npm, so a name that can't possibly be either
// fails immediately.

describe('--from', () => {
  it('rejects a package that is not a jen pack or a Yeoman generator, without touching the network', () => {
    const r = jen(['--from', 'lodash', 'x'], { cwd: fixture() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /"lodash" doesn't look like a jen pack.*or a Yeoman generator/);
  });

  it('strips the version from a scoped package spec before checking its name', () => {
    const r = jen(['--from', '@acme/not-a-pack@1.2.3', 'x'], { cwd: fixture() });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /"@acme\/not-a-pack" doesn't look like/);
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
