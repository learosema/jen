/**
 * jen – the code jen(erator)
 *
 *   jen                          the help
 *   jen class                    first generator named "class" in the search path
 *   jen cpp:class --name=Foo     explicitly from pack "jen-cpp", answer via CLI
 *   jen --list                   all generators and where they come from
 *   jen --list --json            the same for programs, with every param
 *   jen web --list               one pack's generators (fetched if it isn't installed)
 *   jen cpp:class --help         one generator and its params
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
import { JenError, apply, dim, fail, helpers, plan, planItems, printPlan } from './core.ts';
import { rank } from './find.ts';
import type { Answers, AnyGenerator, Pack, PackEnv, PackFactory, Params, Placed, Recipe } from './core.ts';
import { PROJECT, PROJECT_JEN, ROOT, USER_DIR } from './location.ts';

// ─── Built-in generators ────────────────────────────────────────────────────

const BUILTINS: Pack = {
  generator: {
    description: 'create a new generator (project or user-wide)',
    params: {
      name: { description: 'the generator, any case: MyWidget and my-widget both make my-widget.mjs, run as jen my-widget' },
      location: { default: 'project', choices: ['project', 'user'], description: 'project (.jen/) or user (your user directory)' },
    },
    examples: ['--name=hello', '--name=component --location=user'],
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
  pack?: PackMeta;
  load: () => Promise<AnyGenerator>;
}

/** What `--help` and `--list --json` tell about a pack, from its own package.json. */
interface PackMeta {
  name: string;
  version?: string;
  description?: string;
  homepage?: string;
  /** The pack module's `recipes` export. */
  recipes?: Recipe[];
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

/** jen's own packs, for `--find`'s hint at the ones it didn't search because they aren't installed. */
const FIRST_PARTY_PACKS = ['cpp', 'glsl', 'js', 'web', 'yeoman'];

/** Matches pack package names, capturing the prefix: "@codejen/pack-cpp" or "jen-pack-cpp" → "cpp". */
const PACK_RE = /^(?:jen-pack-|@[^/]+\/pack-)(.+)$/;

const packPrefix = (name: string): string => PACK_RE.exec(name)?.[1] ?? name;

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  homepage?: string;
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

/** The package.json of pack `name`, found upwards from the file it resolves to (exports may hide `name/package.json`). */
function packMeta(name: string, file: string): PackMeta {
  for (let dir = dirname(file); dirname(dir) !== dir; dir = dirname(dir)) {
    const pkg = readPackageJson(dir);
    if (pkg.name !== name) continue;
    const { version, description, homepage } = pkg;
    return { name, ...(version && { version }), ...(description && { description }), ...(homepage && { homepage }) };
  }
  return { name };
}

async function packSource(name: string, bases = defaultBases(), extra: Extra = noExtra()): Promise<Entry[]> {
  // Look locally in the project first, then the user directory, then from
  // jen's own location – for a global install, that finds global packs.
  const file = resolveFrom(bases, name);
  if (!file) {
    console.warn(styleText('yellow', `Pack ${name} not found (install it locally or globally).`));
    return [];
  }
  const mod = (await import(pathToFileURL(file).href)) as { default?: Pack | PackFactory; recipes?: Recipe[] };
  const { recipes, ...named } = mod;
  const exported = mod.default ?? (named as Pack);
  const pack = typeof exported === 'function' ? await exported(packEnv(extra)) : exported;
  const meta = { ...packMeta(name, file), ...(Array.isArray(recipes) && recipes.length > 0 && { recipes }) };
  return Object.entries(pack).map(([gen, g]) => ({
    name: gen,
    source: `pack ${name}`,
    prefix: packPrefix(name),
    pack: meta,
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
 * project's own node_modules), removed again when the run ends: for `--from`,
 * the @codejen fallback and a pack's env.fetch(). Returns the directory's
 * package.json, to resolve from.
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

  // progress goes to stderr, so stdout stays clean for --list --json
  console.error(dim(`Fetching ${name}@${version} …`));
  // npm's own output only matters when it fails – and not even then for the @codejen fallback, which catches this
  const result = spawnSync(
    'npm',
    ['install', `${name}@${version}`, '--prefix', dir, '--no-save', '--no-audit', '--no-fund', '--ignore-scripts', '--loglevel=error'],
    { stdio: ['inherit', 'ignore', 'pipe'], encoding: 'utf8', shell: process.platform === 'win32' },
  );
  if (result.error || result.status !== 0) {
    const why = result.error?.message ?? result.stderr.trim();
    fail(`npm install ${name}@${version} failed${why ? `:\n${why}` : '.'}`);
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

/** Whether an entry belongs to a pack prefix ("cpp") or a source ("user", "project"). */
const under = (e: Entry, prefix: string): boolean => e.prefix === prefix || e.source === prefix || e.source.startsWith(`${prefix} `);

/** "class" → first match; "cpp:class" → pack prefix; "user:class" → source. */
function find(entries: Entry[], query: string): Entry | undefined {
  const colon = query.indexOf(':');
  const prefix = colon < 0 ? null : query.slice(0, colon);
  const name = colon < 0 ? query : query.slice(colon + 1);
  return entries.find((e) => e.name === name && (prefix === null || under(e, prefix)));
}

/** `prefix` if it's a plausible pack name that matches nothing we know, e.g. "lua". */
const unknownPrefix = (entries: Entry[], prefix: string): string | null =>
  !entries.some((e) => under(e, prefix)) && /^[a-z0-9][a-z0-9-]*$/.test(prefix) ? prefix : null;

/** The prefix of "lua:function" if it's a plausible pack name that matches nothing we know, e.g. "lua". */
function unknownPackPrefix(entries: Entry[], query: string): string | null {
  const colon = query.indexOf(':');
  return colon < 0 ? null : unknownPrefix(entries, query.slice(0, colon));
}

/** Up to three names close to `query` (a typo, a plural …), closest first. */
function near(query: string, names: string[]): string[] {
  return [...new Set(names)]
    .map((n) => ({ n, d: distance(query.toLowerCase(), n.toLowerCase()) }))
    .filter(({ d }) => d <= 2)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(({ n }) => n);
}

/** The error for a generator that wasn't found: close names, the pack's own list, or the --from command for an uninstalled pack. */
function notFound(entries: Entry[], query: string): never {
  const prefix = unknownPackPrefix(entries, query);
  const colon = query.indexOf(':');
  // "web:stats": web is known, so the names to offer are web's own
  const pack = colon < 0 || prefix ? null : query.slice(0, colon);
  const candidates = pack ? entries.filter((e) => under(e, pack)) : entries;
  const close = near(query.slice(colon + 1), candidates.map((e) => e.name)).map((n) => (pack ? `${pack}:${n}` : n));
  const meant = close.length ? `did you mean ${close.join(', ')}? ` : '';
  const lines = [`Generator "${query}" not found – ${meant}${pack ? `jen ${pack} --list shows them all.` : 'jen --list shows all.'}`];
  if (prefix) lines.push(`If "${prefix}" is a pack you haven't installed, try: jen --from ${FIRST_PARTY_SCOPE}/pack-${prefix} ${query}`);
  // jen 2 ran Yeoman generators by their short name itself
  if (!query.includes(':') && discoverAll(/^(?:@[^/]+\/)?generator-/).some((n) => n.endsWith(`generator-${query}`))) {
    lines.push(`Yeoman generators run through ${FIRST_PARTY_SCOPE}/pack-yeoman now: jen yeoman:${query}`);
  }
  throw new JenError(lines.join('\n'), 'not_found', { query, didYouMean: close });
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
  return prefix ? find(await fetchFirstParty(prefix, extra), query) : undefined;
}

/** The entries of @codejen/pack-`prefix`, fetched for this run – none if fetching is off or there's no such pack. */
async function fetchFirstParty(prefix: string, extra: Extra): Promise<Entry[]> {
  if (process.env.JEN_NO_FETCH) return [];
  try {
    return await fetchFrom(`${FIRST_PARTY_SCOPE}/pack-${prefix}`, extra);
  } catch {
    return []; // no such package (or npm failed) – the caller reports it
  }
}

/**
 * `jen web --list`: the generators of one pack (or source) – fetched like the
 * not-found fallback if it isn't installed. Null if `query` is no pack.
 */
async function packEntries(entries: Entry[], query: string, extra: Extra): Promise<Entry[] | null> {
  const known = entries.filter((e) => under(e, query));
  if (known.length > 0) return known;
  const fetched = unknownPrefix(entries, query) ? await fetchFirstParty(query, extra) : [];
  return fetched.length > 0 ? fetched : null;
}

/** Each entry with whether an earlier one of the same name shadows it. */
function withShadowing(entries: Entry[]): Array<{ entry: Entry; shadowed: boolean }> {
  const seen = new Set<string>();
  return entries.map((entry) => {
    const shadowed = seen.has(entry.name);
    seen.add(entry.name);
    return { entry, shadowed };
  });
}

async function list(entries: Entry[]): Promise<void> {
  for (const { entry: e, shadowed } of withShadowing(entries)) {
    const description = await e.load().then(
      (g) => g.description ?? '',
      (err: Error) => styleText('red', err.message),
    );
    const line = `  ${qualified(e).padEnd(22)} ${e.source.padEnd(26)} ${description}`;
    console.log(shadowed ? dim(`${line} (shadowed)`) : line);
  }
  const recipes = recipesOf(entries);
  if (recipes.length > 0) console.log('\nrecipes:');
  for (const { pack, recipe } of recipes) {
    console.log(`  ${recipe.name.padEnd(22)} ${`pack ${pack.name}`.padEnd(26)} ${recipe.description}`);
    for (const call of recipeCalls(pack, recipe)) console.log(dim(`    ${call.jen}`));
  }
}

interface ParamInfo {
  type: 'string' | 'boolean';
  required: boolean;
  default?: string | boolean;
  choices?: readonly string[];
  path?: true;
  description?: string;
}

/** What a param declaration means: its type follows from the default, and no default means required. */
function paramInfo(spec: Params[string]): ParamInfo {
  return {
    type: typeof spec.default === 'boolean' ? 'boolean' : 'string',
    required: spec.default === undefined,
    ...(spec.default !== undefined && { default: spec.default }),
    ...(spec.choices && { choices: spec.choices }),
    ...(spec.path && { path: true as const }),
    ...(spec.description && { description: spec.description }),
  };
}

const shellValue = (value: string): string => (/^[^\s"'`$\\|]+$/.test(value) ? value : JSON.stringify(value));

/**
 * A param the way it's typed on the command line: `--name (required)`, `--dir=src`, `--namespace=""`, `--moveOnly` –
 * with choices, all of them, the default first: `--std=23|20`, `--kind=value|perlin (required)`.
 */
function paramUsage(name: string, p: ParamInfo): string {
  const values = [...(p.default === undefined ? [] : [String(p.default)]), ...(p.choices ?? []).filter((c) => c !== p.default)];
  if (p.choices) return `--${name}=${values.map(shellValue).join('|')}${p.required ? ' (required)' : ''}`;
  if (p.required) return `--${name} (required)`;
  if (p.default === false) return `--${name}`;
  return `--${name}=${shellValue(String(p.default))}`;
}

const NPX = 'npx --yes @codejen/jen';

/** A generator's examples as whole calls: with jen installed, and through npx – which needs --from for a pack the @codejen fallback doesn't fetch. */
function exampleCalls(e: Entry, gen: AnyGenerator): Array<{ jen: string; npx: string }> {
  const name = qualified(e);
  const from = e.pack && e.pack.name !== `${FIRST_PARTY_SCOPE}/pack-${e.prefix}` ? ` --from ${e.pack.name}` : '';
  return (gen.examples ?? []).map((args) => ({ jen: `jen ${name} ${args}`.trimEnd(), npx: `${NPX}${from} ${name} ${args}`.trimEnd() }));
}

/** One generator, its params and examples, plain like the CLI itself – the single text format for `--help`. */
function formatGenerator(e: Entry, gen: AnyGenerator): string {
  const name = qualified(e);
  const lines = [gen.description ? `${name} – ${gen.description}` : name];
  for (const [param, spec] of Object.entries(gen.params ?? {})) {
    const p = paramInfo(spec);
    const description = [p.description, p.path && '(a path from where you run jen)'].filter(Boolean).join(' ');
    lines.push(`  ${paramUsage(param, p)}${description ? `  ${description}` : ''}`);
  }
  // everyone's flag (built-ins write where they must), unless the generator has a param of that name itself
  if (e.source !== 'built-in' && !('dir' in (gen.params ?? {}))) lines.push('  --dir=<folder>  where the files go (default: where you run jen)');
  if (gen.usage?.length) lines.push('', 'usage:', ...gen.usage.map((u) => `  ${u}`));
  const examples = exampleCalls(e, gen);
  if (examples.length > 0) {
    lines.push('', 'examples:', ...examples.map((x) => `  ${x.jen}`), `  ${examples[0].npx}  (without installing jen)`);
  }
  if (e.pack?.homepage) lines.push('', `docs: ${e.pack.homepage}`);
  return lines.join('\n');
}

/** A pack in `--list --json`: its recipes' steps as whole calls, their markup only in `--find` (it would repeat on every generator). */
const packJson = ({ recipes, ...pack }: PackMeta) => ({
  ...pack,
  ...(recipes && { recipes: recipes.map((r) => ({ name: r.name, description: r.description, steps: recipeCalls(pack, r), ...(r.docs && { docs: r.docs }) })) }),
});

/** One generator in `--list --json` (and `--help --json`). */
const catalogEntry = (e: Entry, g: AnyGenerator, shadowed = false) => ({
  name: qualified(e),
  source: e.source,
  ...(e.pack && { pack: packJson(e.pack) }),
  shadowed,
  description: g.description ?? '',
  params: Object.fromEntries(Object.entries(g.params ?? {}).map(([n, spec]) => [n, paramInfo(spec)])),
  examples: exampleCalls(e, g),
  usage: g.usage ?? [],
});

/** `jen --list --json`: the catalog for programs – JSON only on stdout. */
async function listJson(entries: Entry[]): Promise<void> {
  const catalog = [];
  for (const { entry: e, shadowed } of withShadowing(entries)) {
    catalog.push(
      await e.load().then(
        (g) => catalogEntry(e, g, shadowed),
        (err: Error) => ({ name: qualified(e), source: e.source, ...(e.pack && { pack: packJson(e.pack) }), shadowed, error: err.message }),
      ),
    );
  }
  console.log(JSON.stringify(catalog, null, 2));
}

/** A recipe's steps as whole calls, like a generator's examples: with jen installed, and through npx. */
const recipeCalls = (pack: PackMeta, r: Recipe) => {
  const from = pack.name.startsWith(`${FIRST_PARTY_SCOPE}/pack-`) ? '' : ` --from ${pack.name}`;
  return r.steps.map((step) => ({ jen: `jen ${step}`, npx: `${NPX}${from} ${step}` }));
};

/** The recipes of the packs among `entries`, once each. */
function recipesOf(entries: Entry[]): Array<{ pack: PackMeta; recipe: Recipe }> {
  const packs = new Map(entries.flatMap((e) => (e.pack?.recipes ? [[e.pack.name, e.pack] as const] : [])));
  return [...packs.values()].flatMap((pack) => pack.recipes!.map((recipe) => ({ pack, recipe })));
}

/**
 * `jen --find "sidebar layout"`: generators and recipes ranked by the words they share with the query
 * (find.ts), the best 10. `scoped` when it searched one pack (`jen web --find …`); otherwise it names
 * jen's own packs it couldn't search because they aren't installed.
 */
async function search(entries: Entry[], query: string, asJson: boolean, scoped: boolean): Promise<void> {
  const generators = [];
  for (const { entry: e, shadowed } of withShadowing(entries)) {
    if (shadowed) continue;
    const g = await e.load().catch(() => null);
    if (!g) continue;
    const more = [...(g.usage ?? []), ...Object.entries(g.params ?? {}).flatMap(([n, p]) => [n, p.description ?? ''])];
    generators.push({ kind: 'generator' as const, entry: e, gen: g, name: qualified(e), description: g.description ?? '', more });
  }
  const recipes = recipesOf(entries).map(({ pack, recipe }) => ({
    kind: 'recipe' as const,
    pack,
    recipe,
    name: recipe.name,
    description: recipe.description,
    more: [...recipe.steps, ...(recipe.usage ?? [])],
  }));
  const hits = rank(query, [...generators, ...recipes]).slice(0, 10);
  const missing = scoped ? [] : FIRST_PARTY_PACKS.filter((p) => !entries.some((e) => e.pack?.name === `${FIRST_PARTY_SCOPE}/pack-${p}`));
  if (asJson) {
    const results = hits.map(({ item: h, score }) =>
      h.kind === 'generator'
        ? { kind: h.kind, score, ...catalogEntry(h.entry, h.gen) }
        : { kind: h.kind, score, name: h.name, pack: h.pack.name, description: h.description, steps: recipeCalls(h.pack, h.recipe), usage: h.recipe.usage ?? [], ...(h.recipe.docs && { docs: h.recipe.docs }) },
    );
    return void console.log(JSON.stringify({ query, results, ...(missing.length > 0 && { notSearched: missing.map((p) => `${FIRST_PARTY_SCOPE}/pack-${p}`) }) }, null, 2));
  }
  if (hits.length === 0) console.log(`Nothing matches "${query}" – jen --list shows all.`);
  for (const { item: h } of hits) {
    if (h.kind === 'generator') {
      console.log(`  ${h.name.padEnd(22)} ${h.description}`);
      continue;
    }
    console.log(`  ${`recipe: ${h.name}`.padEnd(22)} ${h.description} (${h.pack.name})`);
    for (const call of recipeCalls(h.pack, h.recipe)) console.log(dim(`    ${call.jen}`));
    if (h.recipe.docs) console.log(dim(`    docs: ${h.recipe.docs}`));
  }
  if (missing.length > 0) {
    console.log(dim(`\nNot installed, so not searched: ${missing.join(', ')} – jen <pack> --find "${query}" fetches and searches one.`));
  }
}

// ─── Params ─────────────────────────────────────────────────────────────────

const TRUE = /^(1|true|y|yes|on)$/i;
const FALSE = /^(0|false|n|no|off)$/i;

/** Resolves a generator's params from CLI answers and defaults (main() checks the required ones first). No prompting. */
function resolveParams(generator: string, params: Params, given: Record<string, unknown>): Answers {
  const answers: Answers = {};
  for (const [name, spec] of Object.entries(params)) {
    if (name in given) {
      const v = given[name];
      if (typeof spec.default !== 'boolean') {
        answers[name] = String(v);
        if (spec.choices && answers[name] !== spec.default && !spec.choices.includes(answers[name])) {
          throw new JenError(`${generator} --${name}: expected one of ${spec.choices.map((c) => `"${c}"`).join(', ')}, got "${answers[name]}"`, 'bad_value', {
            param: name,
            value: answers[name],
            choices: spec.choices,
          });
        }
      } else if (v === true || TRUE.test(String(v))) answers[name] = true;
      else if (FALSE.test(String(v))) answers[name] = false;
      else throw new JenError(`${generator} --${name}: expected true or false (or yes/no), got "${v}"`, 'bad_value', { param: name, value: v, expected: 'boolean' });
    } else if (spec.default !== undefined) {
      answers[name] = spec.default;
    }
  }
  return answers;
}

/** Edit distance, for "did you mean" on a mistyped flag. */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

function closest(flag: string, names: string[]): string | undefined {
  return (
    names.find((n) => n.toLowerCase() === flag.toLowerCase()) ??
    names.map((n) => ({ n, d: distance(flag, n) })).filter(({ d }) => d <= 2).sort((a, b) => a.d - b.d)[0]?.n
  );
}

/** Fails on flags the generator has no param for: a typo would otherwise quietly produce different code. */
function rejectUnknown(generator: string, own: Params, given: Record<string, unknown>): void {
  // --dir is everyone's; --json only means something with --list, so it's ignored here like there
  const unknown = Object.keys(given).filter((k) => !(k in own) && k !== 'dir' && k !== 'json');
  if (unknown.length === 0) return;
  const names = Object.keys(own);
  const found = unknown.map((k) => ({ flag: `--${k}`, didYouMean: closest(k, names) }));
  const flags = found.map(({ flag, didYouMean }) => (didYouMean ? `${flag} (did you mean --${didYouMean}?)` : flag));
  const known = names.length > 0 ? ` Known: ${names.map((n) => `--${n}`).join(', ')}.` : '';
  throw new JenError(`${generator} has no ${flags.join(', ')}.${known} (jen ${generator} --help)`, 'unknown_flag', {
    flags: found.map(({ flag, didYouMean }) => ({ flag, ...(didYouMean && { didYouMean: `--${didYouMean}` }) })),
    known: names.map((n) => `--${n}`),
  });
}

// ─── CLI ────────────────────────────────────────────────────────────────────

const HELP = `jen – the code jen(erator)

  jen [generator] [--answer=value …] [options]

  generator       name ("class"), with pack ("cpp:class") or source ("user:class")
  --list,    -l   list all generators and where they come from – or one pack's: jen web --list
  --find          search generators and recipes by words: jen --find "sidebar layout",
                  or one pack's: jen web --find "dark mode"
  --json          with --list or --find: JSON for programs; with a generator: the plan
                  (or the error) as JSON, with --help: the generator's params
  --dry-run, -n   only show the plan
  --force,   -f   overwrite existing files
  --strict        exit with 1 if the plan has a warning (for CI)
  --dir           where the files go instead of the current directory
  --from          fetch a pack via npm, run it once, then remove it – or a package
                  a pack runs, e.g. a Yeoman generator: --from generator-code yeoman:code
  --help,    -h   show this help, or a generator's params: jen cpp:class --help
                  (a generator run without its required params shows them, too)
  --version, -v   show jen's version

  CLI answers always use "=": --name=Foo (flags like --moveOnly work without).
  A pack that isn't installed is fetched for that run: jen web:palette uses @codejen/pack-web.
`;

/** jen's own package.json sits next to both src/ (development) and dist/ (published). */
const jenVersion = (): string => readPackageJson(join(dirname(import.meta.filename), '..')).version ?? 'unknown';

const FLAGS = {
  list: { type: 'boolean', short: 'l' },
  'dry-run': { type: 'boolean', short: 'n' },
  force: { type: 'boolean', short: 'f' },
  from: { type: 'string' },
  find: { type: 'string' },
  strict: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

export async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: false, options: FLAGS });
  const query = positionals[0];
  // only without a generator, which may have a "version" or "v" param of its own
  if (!query && (values.version === true || values.v === true)) return void console.log(jenVersion());
  const finding = typeof values.find === 'string';
  if (!query && !values.list && !finding) {
    console.log(HELP);
    if (!values.help) process.exitCode = 1;
    return;
  }

  // --json: results and errors as JSON – unless a generator has a json param of its own (checked once it's loaded)
  let json = values.json === true;
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
    // --json only means something here, so it isn't reserved: a generator may still have a "json" param
    const listing = (shown: Entry[]) => (values.json ? listJson(shown) : list(shown));
    if (finding && !String(values.find).trim()) fail('--find needs words to search for: jen --find "sidebar layout"');
    // "jen web --list", "jen web --find …", or "jen web" when no generator is called "web": that pack's generators
    if (query && !query.includes(':') && (values.list || finding || !find(entries, query))) {
      const shown = await packEntries(entries, query, extra);
      if (shown) return void (await (finding ? search(shown, String(values.find), json, true) : listing(shown)));
      if ((values.list || finding) && process.env.JEN_NO_FETCH && unknownPrefix(entries, query)) {
        throw new JenError(
          `"${query}" isn't installed here, and fetching is off (JEN_NO_FETCH) – install ${FIRST_PARTY_SCOPE}/pack-${query}, or run jen inside your project`,
          'unknown_pack',
          { pack: query },
        );
      }
      if (values.list || finding) throw new JenError(`"${query}" is no pack or source jen knows – jen --list shows all.`, 'unknown_pack', { pack: query });
    }
    if (finding) return void (await search(entries, String(values.find), json, false));
    if (values.list || !query) return void (await listing(entries));

    const entry = find(entries, query) ?? (await fetchFallback(entries, query, extra)) ?? notFound(entries, query);
    const gen = await entry.load();
    if ('json' in (gen.params ?? {})) json = false;
    if (values.help) return void console.log(json ? JSON.stringify(catalogEntry(entry, gen), null, 2) : formatGenerator(entry, gen));
    // --where was removed: fail rather than quietly write into the cwd, unless it's the generator's own param
    if ('w' in values || ('where' in values && !('where' in (gen.params ?? {})))) {
      fail('--where/-w was removed – cd into the directory and run jen there.');
    }
    const given = Object.fromEntries(Object.entries(values).filter(([k]) => !(k in FLAGS))) as Record<string, string | boolean>;
    if (!gen.passthrough) rejectUnknown(qualified(entry), gen.params ?? {}, given);
    const missing = Object.entries(gen.params ?? {}).filter(([n, spec]) => spec.default === undefined && !(n in given));
    if (missing.length > 0) {
      if (!json) console.error(`${formatGenerator(entry, gen)}\n`);
      throw new JenError(`Missing: ${missing.map(([n]) => `--${n}`).join(', ')}`, 'missing_param', {
        generator: qualified(entry),
        missing: missing.map(([n]) => `--${n}`),
        params: Object.fromEntries(Object.entries(gen.params ?? {}).map(([n, spec]) => [n, paramInfo(spec)])),
        examples: exampleCalls(entry, gen),
      });
    }
    const notes: string[] = [];
    const cwd = process.cwd();
    if (PROJECT && PROJECT.root !== cwd) notes.push(`root: ${relative(cwd, PROJECT.root)} (${PROJECT.marker})`);
    // --dir is the same flag everywhere, unless the generator has a param of that name itself
    const ownDir = 'dir' in (gen.params ?? {});
    const params = { dir: { default: '' }, ...gen.params };
    const answers = resolveParams(qualified(entry), params, given);
    if (!json) console.log(dim(`${qualified(entry)} (${entry.source})${gen.description ? ` – ${gen.description}` : ''}`));
    const ctx = buildContext(ownDir ? '' : String(answers.dir), ROOT, cwd);
    const flags = ownDir ? given : Object.fromEntries(Object.entries(given).filter(([k]) => k !== 'dir'));
    ctx.args = { flags, positionals: positionals.slice(1) };
    resolvePathParams(gen.params ?? {}, answers, ctx);
    const raw = await gen.actions(answers, helpers, ctx);
    // built-ins are jen's own: they write to absolute paths, e.g. the user directory
    const actions = entry.source === 'built-in' ? (raw as Placed[]) : placeActions(raw, ctx);
    if (!json) for (const n of notes) console.log(dim(`  ${n}`));

    const { steps, changes } = await plan(actions, Boolean(values.force), entry.source === 'built-in' ? [USER_DIR] : []);
    // the run itself goes ahead; --strict only changes how it ends
    if (values.strict && steps.some((s) => s.mark === 'warning')) process.exitCode = 1;
    if (json) {
      const dryRun = Boolean(values['dry-run']);
      const done = dryRun || changes.size === 0 ? { written: 0, deleted: 0 } : await apply(changes);
      const result = {
        generator: qualified(entry),
        source: entry.source,
        ...(PROJECT && PROJECT.root !== cwd && { root: relative(cwd, PROJECT.root) }),
        dryRun,
        steps: planItems(steps).map(({ mark: _, ...item }) => item),
        ...done,
      };
      return void console.log(JSON.stringify(result, null, 2));
    }
    console.log();
    printPlan(steps);
    if (changes.size === 0) return void console.log('\nNothing to do.');
    if (values['dry-run']) return;

    const { written, deleted } = await apply(changes);
    const summary = [written && `${written} written`, deleted && `${deleted} deleted`].filter(Boolean).join(', ');
    console.log(styleText('green', `✓ ${summary || 'nothing changed'}`));
  } catch (e) {
    if (!json) throw e;
    const error = e instanceof JenError ? { code: e.code, message: e.message, ...e.details } : { code: 'error', message: e instanceof Error ? e.message : String(e) };
    console.error(JSON.stringify({ error }, null, 2));
    process.exitCode = 1;
  } finally {
    for (const cleanup of extra.cleanups) cleanup();
  }
}
