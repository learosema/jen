/**
 * jen – the code jen(erator)
 *
 *   jen                          list available generators
 *   jen class                    first generator named "class" in the search path
 *   jen cpp:class --name=Foo     explicitly from pack "jen-cpp", answer via CLI
 *   jen --list                   all generators and where they come from
 *
 * Search path (first match wins):
 *   1. .jen/             in the project (searched upwards from cwd)
 *   2. user directory    $XDG_CONFIG_HOME/jen, ~/.config/jen or %APPDATA%\jen
 *   3. $JEN_PATH         additional directories (separator as in PATH)
 *   4. packs             dependencies in package.json named "jen-pack-*" or
 *                        "@scope/pack-*", project package.json then the
 *                        user directory's, then packs installed globally
 *                        next to jen itself (npm install -g)
 *   5. built-in generators
 *
 * A prefixed name whose pack isn't installed ("lua:function") falls back to
 * fetching @codejen/pack-lua the same way (first-party scope only).
 *
 * --from fetches a single pack via npm into a throwaway directory, runs it
 * once, and removes it again – it replaces the whole search path above for
 * that one run. Any other package is fetched the same way, but only made
 * available to packs (PackEnv), e.g. a Yeoman generator for pack-yeoman.
 *
 * Generators decide what to create, jen decides where: paths in actions are
 * relative to the current directory (--dir overrides), `/…` to the project
 * root – the parent of the nearest .jen/, else the nearest directory with a
 * package.json or .git, else the current directory.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, styleText } from 'node:util';
import { buildContext, placeActions, resolvePathParams } from './context.ts';
import { apply, dim, fail, helpers, plan, printPlan } from './core.ts';
import type { AnyGenerator, Answers, Pack, PackEnv, PackFactory, Params, Placed } from './core.ts';
import { PROJECT, PROJECT_JEN, ROOT, USER_DIR } from './location.ts';

// ─── Built-in generators ────────────────────────────────────────────────────

const BUILTINS: Pack = {
  generator: {
    description: 'create a new generator (project or user-wide)',
    params: {
      name: {},
      location: { default: 'project' },
    },
    actions: ({ name, location }, { kebab }) => [
      {
        add: join(location === 'user' ? USER_DIR : join(ROOT, '.jen'), `${kebab(name)}.mjs`),
        template: `// @ts-check
/** @type {import('@codejen/jen').Generator} */
export default {
  description: ${JSON.stringify(String(name))},
  params: {
    name: {},
  },
  actions: ({ name }, { pascal }) => [
    // paths are relative to where you run jen (or --dir); '/…' is the project root
    { add: \`\${pascal(name)}.txt\`, template: \`Hello \${name}!\\n\` },
  ],
};
`,
      },
    ],
  },
};

// ─── Collecting generators ──────────────────────────────────────────────────

interface Entry {
  name: string;
  source: string;
  prefix?: string;
  load: () => Promise<AnyGenerator>;
}

const GEN_FILE = /\.(m?js|m?ts)$/;

function asGenerator(mod: unknown, where: string): AnyGenerator {
  const m = mod as { default?: unknown };
  const gen = (m.default ?? m) as AnyGenerator;
  if (typeof gen?.actions !== 'function') fail(`${where}: does not export an actions() function`);
  return gen;
}

function dirSource(source: string, dir: string | null): Entry[] {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => GEN_FILE.test(f) && !f.endsWith('.d.ts'))
    .map((f) => {
      const file = join(dir, f);
      return {
        name: f.replace(GEN_FILE, ''),
        source,
        load: async () => asGenerator(await import(pathToFileURL(file).href), file),
      };
    });
}

/** npm scope the not-found fallback may fetch from – jen's own. */
const FIRST_PARTY_SCOPE = '@codejen';

/** Matches pack package names, capturing the prefix: "@codejen/pack-cpp" or "jen-pack-cpp" → "cpp". */
const PACK_RE = /^(?:jen-pack-|@[^/]+\/pack-)(.+)$/;

const packPrefix = (name: string): string => PACK_RE.exec(name)?.[1] ?? name;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readPackageJson(dir: string | null): PackageJson {
  const file = dir ? join(dir, 'package.json') : null;
  if (!file || !existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as PackageJson;
  } catch (e) {
    fail(`${file}: ${(e as Error).message}`);
  }
}

/**
 * Packages matching a naming convention that are installed next to jen
 * itself – for a global install (`npm install -g`), that's the global
 * node_modules, so global packs are found without being listed anywhere.
 * node_modules directories inside the project are skipped: its package.json
 * is authoritative there, and hoisted transitive packages don't count.
 */
function discoverGlobal(re: RegExp): string[] {
  const names: string[] = [];
  for (let dir = dirname(import.meta.filename); dirname(dir) !== dir; dir = dirname(dir)) {
    if (!dir.endsWith(`${sep}node_modules`) || dir.startsWith(ROOT + sep)) continue;
    let children: string[];
    try {
      children = readdirSync(dir);
    } catch {
      continue;
    }
    for (const child of children) {
      if (child.startsWith('@')) {
        const scoped = readdirSync(join(dir, child)).map((n) => `${child}/${n}`);
        names.push(...scoped);
      } else {
        names.push(child);
      }
    }
  }
  return names.filter((n) => re.test(n));
}

/** Where to resolve a package from: the project, the user directory, then jen's own install location (global). */
const defaultBases = (): string[] => [join(ROOT, 'package.json'), join(USER_DIR, 'package.json'), import.meta.filename];

/** Dependency names in a package.json matching a naming convention (e.g. jen packs). */
function discoverDeps(dir: string | null, re: RegExp): string[] {
  const pkg = readPackageJson(dir);
  const names = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ];
  return names.filter((n) => re.test(n));
}

/** Dependency names matching `re` in the project, the user directory and globally, without duplicates. */
const discoverAll = (re: RegExp): string[] => [...new Set([...discoverDeps(ROOT, re), ...discoverDeps(USER_DIR, re), ...discoverGlobal(re)])];

/** Packages fetched for this run that aren't packs – via `--from` or a pack's env.fetch() – only visible to packs, and what removes them again. */
interface Extra {
  packages: string[];
  bases: string[];
  cleanups: Array<() => void>;
}

const noExtra = (): Extra => ({ packages: [], bases: [], cleanups: [] });

/** The file `name` resolves to from the first base that has it; null if none does. */
function resolveFrom(bases: string[], name: string): string | null {
  for (const base of bases) {
    try {
      return createRequire(base).resolve(name);
    } catch {
      continue;
    }
  }
  return null;
}

function packEnv(extra: Extra): PackEnv {
  const resolve = (name: string) => resolveFrom([...extra.bases, ...defaultBases()], name);
  return {
    packages: (re) => [...new Set([...extra.packages.filter((n) => re.test(n)), ...discoverAll(re)])],
    resolve,
    async fetch(name) {
      if (process.env.JEN_NO_FETCH) return null;
      if (!NPM_NAME.test(name)) fail(`"${name}" isn't an npm package name.`);
      extra.packages.push(name);
      extra.bases.push(install(name, extra));
      return resolve(name);
    },
  };
}

async function packSource(name: string, bases = defaultBases(), extra: Extra = noExtra()): Promise<Entry[]> {
  // Look locally in the project first, then the user directory, then from
  // jen's own location – for a global install, that finds global packs.
  const file = resolveFrom(bases, name);
  if (!file) {
    console.warn(styleText('yellow', `Pack ${name} not found (install it locally or globally).`));
    return [];
  }
  const mod = (await import(pathToFileURL(file).href)) as { default?: Pack | PackFactory };
  const exported = mod.default ?? (mod as Pack);
  const pack = typeof exported === 'function' ? await exported(packEnv(extra)) : exported;
  return Object.entries(pack).map(([gen, g]) => ({
    name: gen,
    source: `pack ${name}`,
    prefix: packPrefix(name),
    load: async () => asGenerator(g, `${name}:${gen}`),
  }));
}

/** Splits "name@version" into its parts, keeping a scope's own "@" intact: "@scope/name@1.0.0" → ["@scope/name", "1.0.0"]. */
function splitPkgSpec(spec: string): [name: string, version: string] {
  const at = spec.startsWith('@') ? spec.indexOf('@', 1) : spec.indexOf('@');
  return at < 0 ? [spec, 'latest'] : [spec.slice(0, at), spec.slice(at + 1)];
}

const notAPack = (name: string): string =>
  `"${name}" isn't a jen pack – name the pack's generator that runs it, as in: jen --from generator-code yeoman:code`;

/** A plain npm package name, so nothing else (a flag, a URL, a git spec) ever reaches npm install. */
const NPM_NAME = /^(?:@[a-z0-9][\w.~-]*\/)?[a-z0-9][\w.~-]*$/;

/**
 * Installs a single package via npm into a throwaway directory (never the
 * project's own node_modules), removed again when the run ends. jen never
 * fetches anything implicitly – only for `--from`, the @codejen fallback
 * and a pack's env.fetch(). Returns the directory's package.json, to
 * resolve from.
 */
function install(spec: string, extra: Extra): string {
  const [name, version] = splitPkgSpec(spec);
  const dir = mkdtempSync(join(tmpdir(), 'jen-from-'));
  const remove = () => rmSync(dir, { recursive: true, force: true });

  // Ctrl+C anywhere before cleanup() runs (including during the blocking
  // install below) would otherwise kill the process before main()'s own
  // try/finally gets a chance to, leaving this directory behind.
  const onSignal = (signal: NodeJS.Signals) => {
    remove();
    process.exit(128 + (signal === 'SIGINT' ? 2 : 15));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  extra.cleanups.push(() => {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    remove();
  });

  console.log(dim(`Fetching ${name}@${version} …`));
  const result = spawnSync(
    'npm',
    ['install', `${name}@${version}`, '--prefix', dir, '--no-save', '--no-audit', '--no-fund', '--ignore-scripts'],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (result.error || result.status !== 0) {
    fail(`npm install ${name}@${version} failed${result.error ? `: ${result.error.message}` : ''}.`);
  }
  return join(dir, 'package.json');
}

/** Fetches a pack and returns its entries – or, for any other package, the regular entries with that package visible to packs. */
async function fetchFrom(spec: string, extra: Extra): Promise<Entry[]> {
  const [name] = splitPkgSpec(spec);
  if (!NPM_NAME.test(name)) fail(`"${name}" isn't an npm package name.`);
  const base = install(spec, extra);
  if (PACK_RE.test(name)) return packSource(name, [base], extra);
  extra.packages.push(name);
  extra.bases.push(base);
  return collect(extra);
}

async function collect(extra: Extra): Promise<Entry[]> {
  const paths = (process.env.JEN_PATH ?? '').split(delimiter).filter(Boolean);
  const entries: Entry[] = [
    ...dirSource('project', PROJECT_JEN),
    ...dirSource('user', USER_DIR),
    ...paths.flatMap((dir) => dirSource(`JEN_PATH ${dir}`, dir)),
  ];
  for (const p of discoverAll(PACK_RE)) entries.push(...(await packSource(p, defaultBases(), extra)));
  for (const [name, g] of Object.entries(BUILTINS)) {
    entries.push({ name, source: 'built-in', load: async () => g });
  }
  return entries;
}

const qualified = (e: Entry): string => (e.prefix ? `${e.prefix}:${e.name}` : e.name);

/** "class" → first match; "cpp:class" → pack prefix; "user:class" → source. */
function find(entries: Entry[], query: string): Entry | undefined {
  const colon = query.indexOf(':');
  const prefix = colon < 0 ? null : query.slice(0, colon);
  const name = colon < 0 ? query : query.slice(colon + 1);
  return entries.find(
    (e) =>
      e.name === name &&
      (prefix === null || e.prefix === prefix || e.source === prefix || e.source.startsWith(`${prefix} `)),
  );
}

/** The prefix of "lua:function" if it's a plausible pack name that matches nothing we know, e.g. "lua". */
function unknownPackPrefix(entries: Entry[], query: string): string | null {
  const colon = query.indexOf(':');
  if (colon < 0) return null;
  const prefix = query.slice(0, colon);
  const known = entries.some((e) => e.prefix === prefix || e.source === prefix || e.source.startsWith(`${prefix} `));
  return !known && /^[a-z0-9][a-z0-9-]*$/.test(prefix) ? prefix : null;
}

/** The error for a generator that wasn't found, with the --from command for an uninstalled pack. */
function notFound(entries: Entry[], query: string): never {
  const prefix = unknownPackPrefix(entries, query);
  const lines = [`Generator "${query}" not found – jen --list shows all.`];
  if (prefix) lines.push(`If "${prefix}" is a pack you haven't installed, try: jen --from ${FIRST_PARTY_SCOPE}/pack-${prefix} ${query}`);
  // jen 2 ran Yeoman generators by their short name itself
  if (!query.includes(':') && discoverAll(/^(?:@[^/]+\/)?generator-/).some((n) => n.endsWith(`generator-${query}`))) {
    lines.push(`Yeoman generators run through ${FIRST_PARTY_SCOPE}/pack-yeoman now: jen yeoman:${query}`);
  }
  return fail(lines.join('\n'));
}

/**
 * Not-found fallback: "lua:function" with no known "lua" pack fetches
 * @codejen/pack-lua, exactly like `--from` would. Deliberately limited to
 * jen's own npm scope, so a mistyped name can't install someone else's
 * package – anything else only gets the hint from notFound(). JEN_NO_FETCH
 * turns it off entirely (offline use, tests).
 */
async function fetchFallback(entries: Entry[], query: string, extra: Extra): Promise<Entry | undefined> {
  const prefix = unknownPackPrefix(entries, query);
  if (!prefix || process.env.JEN_NO_FETCH) return undefined;
  try {
    return find(await fetchFrom(`${FIRST_PARTY_SCOPE}/pack-${prefix}`, extra), query);
  } catch {
    return undefined; // no such package (or npm failed) – fall through to the regular not-found error
  }
}

async function list(entries: Entry[]): Promise<void> {
  const seen = new Set<string>();
  for (const e of entries) {
    const shadowed = seen.has(e.name);
    seen.add(e.name);
    const description = await e.load().then(
      (g) => g.description ?? '',
      (err: Error) => styleText('red', err.message),
    );
    const line = `  ${qualified(e).padEnd(22)} ${e.source.padEnd(26)} ${description}`;
    console.log(shadowed ? dim(`${line} (shadowed)`) : line);
  }
}

// ─── Params ─────────────────────────────────────────────────────────────────

const TRUE = /^(1|true|y|yes)$/i;

/** Resolves a generator's params from CLI answers and defaults. No prompting. */
function resolveParams(params: Params, given: Record<string, unknown>): Answers {
  const answers: Answers = {};
  const missing: string[] = [];
  for (const [name, spec] of Object.entries(params)) {
    if (name in given) {
      const v = given[name];
      answers[name] = typeof spec.default === 'boolean' ? v === true || TRUE.test(String(v)) : String(v);
    } else if (spec.default !== undefined) {
      answers[name] = spec.default;
    } else {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    const usage = Object.entries(params)
      .map(([name, spec]) => (spec.default === undefined ? `--${name}=…` : `--${name}=${spec.default}`))
      .join(' ');
    fail(`Missing: ${missing.map((n) => `--${n}`).join(', ')}. Usage: ${usage}`);
  }
  return answers;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

const HELP = `jen – the code jen(erator)

  jen [generator] [--answer=value …] [options]

  generator       name ("class"), with pack ("cpp:class") or source ("user:class")
  --list,    -l   list all generators and where they come from
  --dry-run, -n   only show the plan
  --force,   -f   overwrite existing files
  --dir           where the files go instead of the current directory
  --from          fetch a pack via npm, run it once, then remove it – or a package
                  a pack runs, e.g. a Yeoman generator: --from generator-code yeoman:code
  --help,    -h   show this help

  CLI answers always use "=": --name=Foo (flags like --moveOnly work without).
  Without a generator name, jen lists the available ones.
`;

const FLAGS = {
  list: { type: 'boolean', short: 'l' },
  'dry-run': { type: 'boolean', short: 'n' },
  force: { type: 'boolean', short: 'f' },
  from: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

export async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: false, options: FLAGS });
  if (values.help) return void console.log(HELP);

  const extra = noExtra();
  try {
    let entries: Entry[];
    if (values.from) {
      const [name] = splitPkgSpec(String(values.from));
      if (NPM_NAME.test(name) && !PACK_RE.test(name) && !values.list && !positionals[0]?.includes(':')) fail(notAPack(name));
      entries = await fetchFrom(String(values.from), extra);
    } else {
      entries = await collect(extra);
    }
    if (values.list) return void (await list(entries));

    const query = positionals[0];
    if (!query) {
      await list(entries);
      process.exitCode = 1;
      return;
    }
    let entry = find(entries, query);
    if (!entry) {
      // a fetched pack is the whole search path; a fetched package for a pack still needs that pack
      const fallback = values.from && extra.packages.length === 0 ? undefined : await fetchFallback(entries, query, extra);
      if (!fallback) notFound(entries, query);
      entry = fallback;
    }
    const gen = await entry.load();
    // --where was removed: fail rather than quietly write into the cwd, unless it's the generator's own param
    if ('w' in values || ('where' in values && !('where' in (gen.params ?? {})))) {
      fail('--where/-w was removed – cd into the directory and run jen there.');
    }
    console.log(dim(`${qualified(entry)} (${entry.source})${gen.description ? ` – ${gen.description}` : ''}`));

    const given = Object.fromEntries(Object.entries(values).filter(([k]) => !(k in FLAGS))) as Record<string, string | boolean>;
    const notes: string[] = [];
    const cwd = process.cwd();
    if (PROJECT && PROJECT.root !== cwd) notes.push(`root: ${relative(cwd, PROJECT.root)} (${PROJECT.marker})`);
    // --dir is the same flag everywhere, unless the generator has a param of that name itself
    const ownDir = 'dir' in (gen.params ?? {});
    const params = { dir: { default: '' }, ...gen.params };
    const answers = resolveParams(params, given);
    const ctx = buildContext(ownDir ? '' : String(answers.dir), ROOT, cwd);
    const flags = ownDir ? given : Object.fromEntries(Object.entries(given).filter(([k]) => k !== 'dir'));
    ctx.args = { flags, positionals: positionals.slice(1) };
    resolvePathParams(gen.params ?? {}, answers, ctx);
    const raw = await gen.actions(answers, helpers, ctx);
    // built-ins are jen's own: they write to absolute paths, e.g. the user directory
    const actions = entry.source === 'built-in' ? (raw as Placed[]) : placeActions(raw, ctx);
    for (const n of notes) console.log(dim(`  ${n}`));

    const { steps, changes } = await plan(actions, Boolean(values.force), entry.source === 'built-in' ? [USER_DIR] : []);
    console.log();
    printPlan(steps);
    if (changes.size === 0) return void console.log('\nNothing to do.');
    if (values['dry-run']) return;

    const { written, deleted } = await apply(changes);
    const summary = [written && `${written} written`, deleted && `${deleted} deleted`].filter(Boolean).join(', ');
    console.log(styleText('green', `✓ ${summary || 'nothing changed'}`));
  } finally {
    for (const cleanup of extra.cleanups) cleanup();
  }
}
