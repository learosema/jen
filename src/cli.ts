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
 *                        user directory's
 *   5. built-in generators
 *
 * Paths in actions are relative to the project root (the directory
 * containing .jen/), or to the current directory if there is no .jen/.
 * --where/-w overrides the project root for a single run.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, styleText } from 'node:util';
import { apply, dim, fail, helpers, plan, printPlan } from './core.ts';
import type { Answers, Generator, Pack, Params } from './core.ts';
import { PROJECT_JEN, ROOT, USER_DIR, setRoot } from './location.ts';

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
/** @type {import('@lea.rosema/jen').Generator} */
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

interface Entry {
  name: string;
  source: string;
  prefix?: string;
  load: () => Promise<Generator>;
}

const GEN_FILE = /\.(m?js|m?ts)$/;

function asGenerator(mod: unknown, where: string): Generator {
  const m = mod as { default?: unknown };
  const gen = (m.default ?? m) as Generator;
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

/** Dependency names in a package.json that look like jen packs. */
function discoverPacks(dir: string | null): string[] {
  const pkg = readPackageJson(dir);
  const names = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ];
  return names.filter((n) => PACK_RE.test(n));
}

async function packSource(name: string): Promise<Entry[]> {
  // Look locally in the project first, then from jen's own location –
  // for a global install, that finds globally installed packs.
  const bases = [join(ROOT, 'package.json'), import.meta.filename];
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

async function collect(): Promise<Entry[]> {
  const extra = (process.env.JEN_PATH ?? '').split(delimiter).filter(Boolean);
  const packs = [...new Set([...discoverPacks(ROOT), ...discoverPacks(USER_DIR)])];
  const entries: Entry[] = [
    ...dirSource('project', PROJECT_JEN),
    ...dirSource('user', USER_DIR),
    ...extra.flatMap((dir) => dirSource(`JEN_PATH ${dir}`, dir)),
  ];
  for (const p of packs) entries.push(...(await packSource(p)));
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
  --help,    -h   show this help

  CLI answers always use "=": --name=Foo (flags like --moveOnly work without).
  Without a generator name, jen lists the available ones.
`;

const FLAGS = {
  list: { type: 'boolean', short: 'l' },
  'dry-run': { type: 'boolean', short: 'n' },
  force: { type: 'boolean', short: 'f' },
  where: { type: 'string', short: 'w' },
  help: { type: 'boolean', short: 'h' },
} as const;

export async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: false, options: FLAGS });
  if (values.help) return void console.log(HELP);
  if (values.where) setRoot(resolve(process.cwd(), String(values.where)));

  const entries = await collect();
  if (values.list) return list(entries);

  const query = positionals[0];
  if (!query) {
    await list(entries);
    process.exitCode = 1;
    return;
  }
  const entry = find(entries, query) ?? fail(`Generator "${query}" not found – jen --list shows all.`);
  const gen = await entry.load();
  console.log(dim(`${qualified(entry)} (${entry.source})${gen.description ? ` – ${gen.description}` : ''}`));

  const given = Object.fromEntries(Object.entries(values).filter(([k]) => !(k in FLAGS)));
  const answers = resolveParams(gen.params ?? {}, given);

  const { steps, changes } = await plan(gen.actions(answers, helpers), Boolean(values.force));
  console.log();
  printPlan(steps);
  if (changes.size === 0) return void console.log('\nNothing to do.');
  if (values['dry-run']) return;

  const { written, deleted } = await apply(changes);
  const summary = [written && `${written} written`, deleted && `${deleted} deleted`].filter(Boolean).join(', ');
  console.log(styleText('green', `✓ ${summary || 'nothing changed'}`));
}
