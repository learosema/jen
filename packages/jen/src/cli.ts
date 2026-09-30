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
 *   5. yeoman generators dependencies named "generator-*" or
 *                        "@scope/generator-*" (see yeoman.ts), same places
 *   6. built-in generators
 *
 * A prefixed name whose pack isn't installed ("lua:function") falls back to
 * fetching @codejen/pack-lua the same way (first-party scope only).
 *
 * --from/-F fetches a single pack or Yeoman generator via npm into a
 * throwaway directory, runs it once, and removes it again – it replaces the
 * whole search path above for that one run.
 *
 * Paths in actions are relative to the project root (the directory
 * containing .jen/), or to the current directory if there is no .jen/.
 * --where/-w overrides the project root for a single run.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, styleText } from 'node:util';
import { apply, dim, fail, helpers, plan, printPlan } from './core.ts';
import type { Action, Answers, Generator, Pack, Params } from './core.ts';
import { PROJECT_JEN, ROOT, USER_DIR, setRoot } from './location.ts';
import type { YeomanGeneratorClass } from './yeoman.ts';
import { runYeoman } from './yeoman.ts';

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
    { add: \`src/\${pascal(name)}.txt\`, template: \`Hello \${name}!\\n\` },
  ],
};
`,
      },
    ],
  },
};

// ─── Collecting generators ──────────────────────────────────────────────────

/** A jen generator, loaded and ready to plan. */
interface ActionsGenerator extends Generator {
  kind: 'actions';
}

/** A real Yeoman generator, run through the shim in yeoman.ts – see there for what that covers. */
interface RunnableYeoman {
  kind: 'yeoman';
  description?: string;
  run(given: Record<string, unknown>, positionals: string[]): Promise<Action[]>;
}

type LoadedGenerator = ActionsGenerator | RunnableYeoman;

interface Entry {
  name: string;
  source: string;
  prefix?: string;
  load: () => Promise<LoadedGenerator>;
}

const GEN_FILE = /\.(m?js|m?ts)$/;

function asGenerator(mod: unknown, where: string): ActionsGenerator {
  const m = mod as { default?: unknown };
  const gen = (m.default ?? m) as Generator;
  if (typeof gen?.actions !== 'function') fail(`${where}: does not export an actions() function`);
  return { kind: 'actions', ...gen };
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

/** Dependency names in a package.json matching a naming convention (jen packs, Yeoman generators). */
function discoverDeps(dir: string | null, re: RegExp): string[] {
  const pkg = readPackageJson(dir);
  const names = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ];
  return names.filter((n) => re.test(n));
}

async function packSource(name: string, bases = defaultBases()): Promise<Entry[]> {
  // Look locally in the project first, then the user directory, then from
  // jen's own location – for a global install, that finds global packs.
  for (const base of bases) {
    let file: string;
    try {
      file = createRequire(base).resolve(name);
    } catch {
      continue;
    }
    const mod = (await import(pathToFileURL(file).href)) as { default?: Pack };
    const pack = mod.default ?? (mod as Pack);
    return Object.entries(pack).map(([gen, g]) => ({
      name: gen,
      source: `pack ${name}`,
      prefix: packPrefix(name),
      load: async () => asGenerator(g, `${name}:${gen}`),
    }));
  }
  console.warn(styleText('yellow', `Pack ${name} not found (install it locally or globally).`));
  return [];
}

/** Matches Yeoman generator package names, Yeoman's own convention: "generator-code" or "@scope/generator-code" → "code". */
const YEOMAN_RE = /^(?:generator-|@[^/]+\/generator-)(.+)$/;

const yeomanShortName = (name: string): string => YEOMAN_RE.exec(name)?.[1] ?? name;

/**
 * Loads a Yeoman generator package's default export as a single generator –
 * jen doesn't enumerate a package's sub-generators, just its own default one
 * (what `yo <name>` itself runs). See yeoman.ts for what running it covers.
 */
async function yeomanSource(name: string, bases = defaultBases()): Promise<Entry[]> {
  for (const base of bases) {
    let file: string;
    try {
      file = createRequire(base).resolve(name);
    } catch {
      continue;
    }
    const mod = (await import(pathToFileURL(file).href)) as { default?: unknown };
    const GeneratorClass = (mod.default ?? mod) as YeomanGeneratorClass;
    if (typeof GeneratorClass !== 'function') {
      console.warn(styleText('yellow', `${name}: default export is not a Yeoman generator class, skipped.`));
      return [];
    }
    const shortName = yeomanShortName(name);
    return [
      {
        name: shortName,
        source: `yeoman ${name}`,
        load: async () => ({
          kind: 'yeoman',
          description: 'Yeoman generator',
          run: (given, positionals) =>
            runYeoman(GeneratorClass, file, { given, positionals, root: ROOT, namespace: `${shortName}:app` }),
        }),
      },
    ];
  }
  console.warn(styleText('yellow', `Yeoman generator ${name} not found (install it locally or globally).`));
  return [];
}

/** Splits "name@version" into its parts, keeping a scope's own "@" intact: "@scope/name@1.0.0" → ["@scope/name", "1.0.0"]. */
function splitPkgSpec(spec: string): [name: string, version: string] {
  const at = spec.startsWith('@') ? spec.indexOf('@', 1) : spec.indexOf('@');
  return at < 0 ? [spec, 'latest'] : [spec.slice(0, at), spec.slice(at + 1)];
}

/**
 * Installs a single pack or Yeoman generator via npm into a throwaway
 * directory (never the project's own node_modules), and returns its
 * entries plus a cleanup function that removes that directory again.
 * jen never fetches anything implicitly – only this, and only for the one
 * generator name given on the command line.
 */
async function fetchFrom(spec: string): Promise<{ entries: Entry[]; cleanup: () => void }> {
  const [name, version] = splitPkgSpec(spec);
  if (!PACK_RE.test(name) && !YEOMAN_RE.test(name)) {
    fail(`"${name}" doesn't look like a jen pack (jen-pack-*, @scope/pack-*) or a Yeoman generator (generator-*, @scope/generator-*).`);
  }

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
  const cleanup = () => {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    remove();
  };

  console.log(dim(`Fetching ${name}@${version} …`));
  const result = spawnSync(
    'npm',
    ['install', `${name}@${version}`, '--prefix', dir, '--no-save', '--no-audit', '--no-fund', '--ignore-scripts'],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (result.error || result.status !== 0) {
    cleanup();
    fail(`npm install ${name}@${version} failed${result.error ? `: ${result.error.message}` : ''}.`);
  }

  const bases = [join(dir, 'package.json')];
  const entries = PACK_RE.test(name) ? await packSource(name, bases) : await yeomanSource(name, bases);
  return { entries, cleanup };
}

async function collect(): Promise<Entry[]> {
  const extra = (process.env.JEN_PATH ?? '').split(delimiter).filter(Boolean);
  const discover = (re: RegExp) => [...new Set([...discoverDeps(ROOT, re), ...discoverDeps(USER_DIR, re), ...discoverGlobal(re)])];
  const packs = discover(PACK_RE);
  const yeomanGenerators = discover(YEOMAN_RE);
  const entries: Entry[] = [
    ...dirSource('project', PROJECT_JEN),
    ...dirSource('user', USER_DIR),
    ...extra.flatMap((dir) => dirSource(`JEN_PATH ${dir}`, dir)),
  ];
  for (const p of packs) entries.push(...(await packSource(p)));
  for (const g of yeomanGenerators) entries.push(...(await yeomanSource(g)));
  for (const [name, g] of Object.entries(BUILTINS)) {
    entries.push({ name, source: 'built-in', load: async () => ({ kind: 'actions', ...g }) });
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
  return fail(lines.join('\n'));
}

/**
 * Not-found fallback: "lua:function" with no known "lua" pack fetches
 * @codejen/pack-lua, exactly like `--from` would. Deliberately limited to
 * jen's own npm scope, so a mistyped name can't install someone else's
 * package – anything else only gets the hint from notFound(). JEN_NO_FETCH
 * turns it off entirely (offline use, tests).
 */
async function fetchFallback(entries: Entry[], query: string): Promise<{ entry: Entry; cleanup: () => void } | undefined> {
  const prefix = unknownPackPrefix(entries, query);
  if (!prefix || process.env.JEN_NO_FETCH) return undefined;
  let fetched;
  try {
    fetched = await fetchFrom(`${FIRST_PARTY_SCOPE}/pack-${prefix}`);
  } catch {
    return undefined; // no such package (or npm failed) – fall through to the regular not-found error
  }
  const entry = find(fetched.entries, query);
  if (!entry) {
    fetched.cleanup();
    return undefined;
  }
  return { entry, cleanup: fetched.cleanup };
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
  --where,   -w   generate into this directory instead of the project root
  --from          fetch a pack or Yeoman generator via npm, run it once, then remove it
  --help,    -h   show this help

  CLI answers always use "=": --name=Foo (flags like --moveOnly work without).
  Without a generator name, jen lists the available ones.
`;

const FLAGS = {
  list: { type: 'boolean', short: 'l' },
  'dry-run': { type: 'boolean', short: 'n' },
  force: { type: 'boolean', short: 'f' },
  where: { type: 'string', short: 'w' },
  from: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

export async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: false, options: FLAGS });
  if (values.help) return void console.log(HELP);
  if (values.where) setRoot(resolve(process.cwd(), String(values.where)));

  let fetched = values.from ? await fetchFrom(String(values.from)) : undefined;
  try {
    const entries = fetched ? fetched.entries : await collect();
    if (values.list) return void (await list(entries));

    const query = positionals[0];
    if (!query) {
      await list(entries);
      process.exitCode = 1;
      return;
    }
    let entry = find(entries, query);
    if (!entry) {
      const fallback = fetched ? undefined : await fetchFallback(entries, query);
      if (!fallback) notFound(entries, query);
      entry = fallback.entry;
      fetched = { entries: [], cleanup: fallback.cleanup };
    }
    const gen = await entry.load();
    console.log(dim(`${qualified(entry)} (${entry.source})${gen.description ? ` – ${gen.description}` : ''}`));

    const given = Object.fromEntries(Object.entries(values).filter(([k]) => !(k in FLAGS)));
    const actions =
      gen.kind === 'yeoman' ? await gen.run(given, positionals.slice(1)) : gen.actions(resolveParams(gen.params ?? {}, given), helpers);

    const { steps, changes } = await plan(actions, Boolean(values.force));
    console.log();
    printPlan(steps);
    if (changes.size === 0) return void console.log('\nNothing to do.');
    if (values['dry-run']) return;

    const { written, deleted } = await apply(changes);
    const summary = [written && `${written} written`, deleted && `${deleted} deleted`].filter(Boolean).join(', ');
    console.log(styleText('green', `✓ ${summary || 'nothing changed'}`));
  } finally {
    fetched?.cleanup();
  }
}
