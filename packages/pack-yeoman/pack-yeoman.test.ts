/**
 * Runs real yeoman-generator classes through jen's CLI with this pack, the
 * way a project would: the generator in the fixture's node_modules, with
 * yeoman-generator and mem-fs (devDependencies here) linked next to it.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const JEN = join(dirname(require.resolve('@codejen/jen/package.json')), 'src/jen.ts');
const PACK = pathToFileURL(join(import.meta.dirname, 'src/index.ts')).href;

/** A dependency's own directory, wherever npm workspaces happened to hoist it to. */
function packageDir(name: string): string {
  const resolved = require.resolve(name);
  const marker = join('node_modules', name);
  return resolved.slice(0, resolved.lastIndexOf(marker) + marker.length);
}

const tempDirs: string[] = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

/** A project with this pack and the given files; yeoman-generator and mem-fs are linked in for the generators. */
function project(files: Record<string, string>, deps: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'jen-yeoman-'));
  tempDirs.push(dir);
  const all = {
    // the source runs as it is: Node strips types outside node_modules, and the pack's real path is
    'node_modules/@codejen/pack-yeoman/package.json': JSON.stringify({ name: '@codejen/pack-yeoman', type: 'module', exports: './index.mjs' }),
    'node_modules/@codejen/pack-yeoman/index.mjs': `export { default } from '${PACK}';\n`,
    'package.json': JSON.stringify({ devDependencies: Object.fromEntries(['@codejen/pack-yeoman', ...deps].map((d) => [d, '*'])) }),
    ...files,
  };
  for (const [path, content] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  for (const pkg of ['yeoman-generator', 'mem-fs']) symlinkSync(packageDir(pkg), join(dir, 'node_modules', pkg), 'dir');
  return dir;
}

function jen(args: string[], cwd: string) {
  const xdg = mkdtempSync(join(tmpdir(), 'jen-yeoman-user-'));
  tempDirs.push(xdg);
  const r = spawnSync(process.execPath, [JEN, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, XDG_CONFIG_HOME: xdg, JEN_PATH: '', JEN_NO_FETCH: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const read = (dir: string, path: string): string => readFileSync(join(dir, path), 'utf8');

/** A Yeoman generator package in node_modules. */
const generator = (name: string, source: string, extra: Record<string, string> = {}): Record<string, string> => ({
  [`node_modules/${name}/package.json`]: JSON.stringify({ name, type: 'module', main: './index.mjs' }),
  [`node_modules/${name}/index.mjs`]: `import Generator from 'yeoman-generator';\nexport default ${source};\n`,
  ...Object.fromEntries(Object.entries(extra).map(([path, content]) => [`node_modules/${name}/${path}`, content])),
});

const WIDGET = generator(
  'generator-widget',
  `class extends Generator {
  constructor(args, opts) {
    super(args, opts);
    this.option('name', { type: String });
  }
  async prompting() {
    const { greeting } = await this.prompt([
      { name: 'greeting', message: 'Greeting?', default: 'Hello' },
      { name: 'skipped', message: 'Never asked', when: () => false },
    ]);
    this.greeting = greeting;
  }
  writing() {
    this.fs.write(this.destinationPath('out.txt'), \`\${this.greeting}, \${this.options.name}!\\n\`);
    this.fs.copyTpl(this.templatePath('tpl.txt'), this.destinationPath('rendered.txt'), { name: this.options.name });
    this.fs.write(this.destinationPath('logo.bin'), Buffer.from([0, 255, 1]));
  }
  install() {
    this.fs.write(this.destinationPath('should-not-exist.txt'), 'nope');
  }
}`,
  { 'templates/tpl.txt': 'Hi <%= name %>!\n' },
);

describe('yeoman generators', () => {
  it('lists one generator per Yeoman package, under its short name', () => {
    const r = jen(['--list'], project(WIDGET, ['generator-widget']));
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /^pack @codejen\/pack-yeoman\n(?: {2}.*\n)*? {2}yeoman:widget +Yeoman generator-widget$/m);
  });

  it('runs a real yeoman-generator class end to end, EJS via the real copyTpl included', () => {
    const dir = project(WIDGET, ['generator-widget']);
    const r = jen(['yeoman:widget', '--name=World'], dir);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(dir, 'out.txt'), 'Hello, World!\n');
    assert.equal(read(dir, 'rendered.txt'), 'Hi World!\n');
  });

  it('keeps binary files as they are', () => {
    const dir = project(WIDGET, ['generator-widget']);
    jen(['yeoman:widget', '--name=World'], dir);
    assert.deepEqual([...readFileSync(join(dir, 'logo.bin'))], [0, 255, 1]);
  });

  it('writes where you stand, or to --dir', () => {
    const dir = project({ ...WIDGET, 'sub/.keep': '' }, ['generator-widget']);
    assert.equal(jen(['yeoman:widget', '--name=World'], join(dir, 'sub')).code, 0);
    assert.equal(read(dir, 'sub/out.txt'), 'Hello, World!\n');
    assert.equal(jen(['yeoman:widget', '--name=World', '--dir=other'], dir).code, 0);
    assert.equal(read(dir, 'other/out.txt'), 'Hello, World!\n');
  });

  it('never runs the install/end priorities', () => {
    const dir = project(WIDGET, ['generator-widget']);
    assert.equal(jen(['yeoman:widget', '--name=World'], dir).code, 0);
    assert.equal(existsSync(join(dir, 'should-not-exist.txt')), false);
  });

  it('answers a prompt from a CLI flag instead of its default', () => {
    const dir = project(WIDGET, ['generator-widget']);
    assert.equal(jen(['yeoman:widget', '--name=World', '--greeting=Hi'], dir).code, 0);
    assert.equal(read(dir, 'out.txt'), 'Hi, World!\n');
  });

  it('skips existing files unless --force, same as a native generator', () => {
    const dir = project(WIDGET, ['generator-widget']);
    jen(['yeoman:widget', '--name=World'], dir);
    const r = jen(['yeoman:widget', '--name=Someone'], dir);
    assert.match(r.stdout, /exists, skipped/);
    assert.equal(read(dir, 'out.txt'), 'Hello, World!\n');
    jen(['yeoman:widget', '--name=Someone', '--force'], dir);
    assert.equal(read(dir, 'out.txt'), 'Hello, Someone!\n');
  });

  it('fails clearly instead of prompting when a question has no default and no CLI answer', () => {
    const strict = generator(
      'generator-strict',
      `class extends Generator {
  async prompting() {
    await this.prompt({ name: 'flavor', message: 'Flavor?' });
  }
  writing() {
    this.fs.write(this.destinationPath('never.txt'), 'nope');
  }
}`,
    );
    const dir = project(strict, ['generator-strict']);
    const r = jen(['yeoman:strict'], dir);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /Missing: --flavor/);
    assert.equal(existsSync(join(dir, 'never.txt')), false);
  });

  it('answers a list with its first choice and a confirm with yes, like pressing enter', () => {
    const picky = generator(
      'generator-picky',
      `class extends Generator {
  async prompting() {
    this.answers = await this.prompt([
      { type: 'list', name: 'manager', choices: [{ type: 'separator' }, { name: 'npm', value: 'npm' }, 'yarn'] },
      { type: 'list', name: 'style', default: 1, choices: ['tabs', 'spaces'] },
      { type: 'confirm', name: 'git' },
    ]);
  }
  writing() {
    this.fs.write(this.destinationPath('answers.json'), JSON.stringify(this.answers));
  }
}`,
    );
    const dir = project(picky, ['generator-picky']);
    assert.equal(jen(['yeoman:picky'], dir).code, 0);
    assert.deepEqual(JSON.parse(read(dir, 'answers.json')), { manager: 'npm', style: 'spaces', git: true });
  });

  it('cuts off the network, and fails even when the generator swallows the error', () => {
    const online = generator(
      'generator-online',
      `class extends Generator {
  async writing() {
    const https = await import('node:https');
    await new Promise((resolve) => https.get('https://example.com/template.zip', resolve).on('error', resolve));
    await fetch('https://example.com/other.zip').catch(() => {});
    this.fs.write(this.destinationPath('never.txt'), 'nope');
  }
}`,
    );
    const dir = project(online, ['generator-online']);
    const r = jen(['yeoman:online'], dir);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /tried to reach example\.com:443, https:\/\/example\.com\/other\.zip – Yeoman generators run offline under jen/);
    assert.equal(existsSync(join(dir, 'never.txt')), false);
  });

  it('fails clearly on composeWith', () => {
    const composing = generator(
      'generator-composing',
      `class extends Generator {
  async initializing() {
    await this.composeWith('other:app');
  }
}`,
    );
    const r = jen(['yeoman:composing'], project(composing, ['generator-composing']));
    assert.equal(r.code, 1);
    assert.match(r.stderr, /composeWith/);
  });

  it('recognizes the scoped @scope/generator- prefix too', () => {
    const thing = generator(
      '@acme/generator-thing',
      `class extends Generator {
  writing() {
    this.fs.write(this.destinationPath('thing.txt'), 'thing\\n');
  }
}`,
    );
    const dir = project(thing, ['@acme/generator-thing']);
    assert.match(jen(['--list'], dir).stdout, /^pack @codejen\/pack-yeoman\n(?: {2}.*\n)*? {2}yeoman:thing /m);
    assert.equal(jen(['yeoman:thing'], dir).code, 0);
    assert.equal(read(dir, 'thing.txt'), 'thing\n');
  });

  it('lists the generators it may fetch, even when they are not installed', () => {
    const r = jen(['--list'], project({}, []));
    assert.match(r.stdout, /^pack @codejen\/pack-yeoman\n(?: {2}.*\n)*? {2}yeoman:code +Yeoman generator-code – fetched when run$/m);
    assert.doesNotMatch(r.stdout, /yeoman:office/);
    assert.match(r.stdout, /yeoman:jhipster\s+.*fetched when run/);
  });

  it('fetches only what is on its list, and only when fetching is on', () => {
    const dir = project({}, []);
    const known = jen(['yeoman:code'], dir);
    assert.equal(known.code, 1);
    assert.match(known.stderr, /generator-code isn't installed, and fetching is off \(JEN_NO_FETCH\)/);
    const typo = jen(['yeoman:jhispter'], dir);
    assert.equal(typo.code, 1);
    assert.match(typo.stderr, /"yeoman:jhispter" not found/);
  });

  it('says so when a listed generator is not installed', () => {
    const r = jen(['yeoman:gone'], project({}, ['generator-gone']));
    assert.equal(r.code, 1);
    assert.match(r.stderr, /generator-gone is listed but not installed/);
  });
});
