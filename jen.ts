#!/usr/bin/env node
/**
 * jen – the code jen(erator)
 *
 * Zero-dependency scaffolding CLI. Runs directly as TypeScript
 * (Node >= 24, type stripping), tsconfig: "erasableSyntaxOnly": true.
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
 *   4. packs             from .jen/config.json, then from the user config.json
 *   5. built-in generators
 *
 * Paths in actions are relative to the project root (the directory
 * containing .jen/), or to the current directory if there is no .jen/.
 * --where/-w overrides the project root for a single run.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, styleText } from 'node:util';

// ─── Public types (for generators and packs) ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Answers = Record<string, any>;

/** A parameter's default also decides its type: boolean default → boolean, otherwise string. */
export type Params = Record<string, { default?: string | boolean }>;

export type Action =
  /** Create a file. Skipped if it exists (unless force / --force). */
  | { add: string; template: string; force?: boolean }
  /**
   * Insert `line` before the marker line. A single line reuses the marker's
   * own indentation exactly; a `\n`-joined block is re-rendered in the
   * file's indent style, keeping the block's relative nesting. No duplicates.
   */
  | { insert: string; before: string; line: string }
  /**
   * Search and replace via RegExp. Also handy for removing lines. A
   * multi-line `replace` is reindented to match the first match's line.
   */
  | { modify: string; pattern: RegExp; replace: string }
  /** Delete a file. Only inside the project root; directories are refused. */
  | { delete: string };

export interface Helpers {
  pascal(s: string): string;
  camel(s: string): string;
  snake(s: string): string;
  kebab(s: string): string;
  constant(s: string): string;
}

export interface Generator {
  description?: string;
  params?: Params;
  actions(answers: Answers, helpers: Helpers): Action[];
}

/** Default export of a jen pack: generator name → generator. */
export type Pack = Record<string, Generator>;

// ─── Helpers ────────────────────────────────────────────────────────────────

const words = (s: string): string[] =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_\-./]+/).filter(Boolean);
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

export const helpers: Helpers = {
  pascal: (s) => words(s).map(cap).join(''),
  camel: (s) => {
    const p = helpers.pascal(s);
    return p.charAt(0).toLowerCase() + p.slice(1);
  },
  snake: (s) => words(s).map((w) => w.toLowerCase()).join('_'),
  kebab: (s) => words(s).map((w) => w.toLowerCase()).join('-'),
  constant: (s) => words(s).map((w) => w.toUpperCase()).join('_'),
};

function fail(message: string): never {
  throw new Error(message);
}

const dim = (s: string): string => styleText('dim', s);

// ─── Locations ──────────────────────────────────────────────────────────────

function findUp(name: string, dir = process.cwd()): string | null {
  for (;;) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const PROJECT_JEN = findUp('.jen');
let ROOT = PROJECT_JEN ? dirname(PROJECT_JEN) : process.cwd();
const USER_DIR = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, 'jen')
  : process.platform === 'win32'
    ? join(process.env.APPDATA ?? homedir(), 'jen')
    : join(homedir(), '.config', 'jen');

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

interface Config {
  packs?: string[];
}

function readConfig(dir: string | null): Config {
  const file = dir ? join(dir, 'config.json') : null;
  if (!file || !existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Config;
  } catch (e) {
    fail(`${file}: ${(e as Error).message}`);
  }
}

/** "@lea.rosema/jen-cpp" → "cpp" */
const packPrefix = (name: string): string => name.replace(/^@[^/]+\//, '').replace(/^jen-/, '');

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
  const packs = [
    ...new Set([...(readConfig(PROJECT_JEN).packs ?? []), ...(readConfig(USER_DIR).packs ?? [])]),
  ];
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

// ─── EditorConfig ───────────────────────────────────────────────────────────
// A small, pragmatic reader: covers indent_style, indent_size, tab_width,
// end_of_line, trim_trailing_whitespace and insert_final_newline, with glob
// support for *, **, ?, [...] and {a,b}. No nested braces, no numeric ranges,
// no charset/max_line_length – those don't affect generated text either way.

interface EditorConfigSection {
  pattern: string;
  props: Record<string, string>;
}

function parseEditorConfig(text: string): { root: boolean; sections: EditorConfigSection[] } {
  let root = false;
  const sections: EditorConfigSection[] = [];
  let current: EditorConfigSection | null = null;
  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const section = line.match(/^\[(.+)\]$/);
    if (section) {
      current = { pattern: section[1], props: {} };
      sections.push(current);
      continue;
    }
    const kv = line.match(/^([^=]+)=(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase();
    const value = kv[2].trim();
    if (current) current.props[key] = value.toLowerCase();
    else if (key === 'root') root = value.toLowerCase() === 'true';
  }
  return { root, sections };
}

const RE_SPECIAL = /[.+^$()|\\\]]/g;

/** Translates a (subset of) editorconfig glob into a RegExp, relative to the .editorconfig's own directory. */
function globToRegExp(glob: string): RegExp {
  const pattern = glob.includes('/') ? glob.replace(/^\//, '') : `**/${glob}`;
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      re += '.*';
      i++;
      if (pattern[i + 1] === '/') i++;
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '[') {
      const end = pattern.indexOf(']', i + 1);
      if (end < 0) {
        re += '\\[';
      } else {
        const cls = pattern.slice(i + 1, end);
        re += `[${cls.startsWith('!') ? `^${cls.slice(1)}` : cls}]`;
        i = end;
      }
    } else if (c === '{') {
      const end = pattern.indexOf('}', i + 1);
      if (end < 0) {
        re += '\\{';
      } else {
        const alts = pattern
          .slice(i + 1, end)
          .split(',')
          .map((s) => s.replace(RE_SPECIAL, '\\$&'));
        re += `(?:${alts.join('|')})`;
        i = end;
      }
    } else {
      re += c.replace(RE_SPECIAL, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

/** Walks upward from the file, merging matching .editorconfig sections (closer file & later section win). */
function editorConfigFor(file: string): Record<string, string> {
  const chain: Record<string, string>[][] = [];
  let dir = dirname(file);
  for (;;) {
    const cfgPath = join(dir, '.editorconfig');
    if (existsSync(cfgPath)) {
      const { root, sections } = parseEditorConfig(readFileSync(cfgPath, 'utf8'));
      const rel = relative(dir, file);
      const matched = sections.filter((s) => globToRegExp(s.pattern).test(rel)).map((s) => s.props);
      if (matched.length > 0) chain.push(matched);
      if (root) break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const props: Record<string, string> = {};
  for (const fileMatches of chain.reverse()) for (const p of fileMatches) Object.assign(props, p);
  return props;
}

/** Normalizes indentation, line endings, trailing whitespace and final newline per editorconfig props. */
function applyEditorConfig(content: string, props: Record<string, string>): string {
  if (Object.keys(props).length === 0) return content;
  const eol = props.end_of_line === 'crlf' ? '\r\n' : props.end_of_line === 'cr' ? '\r' : '\n';
  const hadFinalNewline = /\r\n$|\r$|\n$/.test(content);
  const lines = content.split(/\r\n|\r|\n/);
  if (hadFinalNewline) lines.pop();

  const indentSize = Number(props.indent_size === 'tab' ? props.tab_width : props.indent_size) || undefined;

  const formatted = lines.map((line) => {
    let out = line;
    if (indentSize && (props.indent_style === 'space' || props.indent_style === 'tab')) {
      const indent = out.match(/^[ \t]*/)?.[0] ?? '';
      let columns = 0;
      for (const ch of indent) columns += ch === '\t' ? indentSize : 1;
      const newIndent =
        props.indent_style === 'tab'
          ? '\t'.repeat(Math.floor(columns / indentSize)) + ' '.repeat(columns % indentSize)
          : ' '.repeat(columns);
      out = newIndent + out.slice(indent.length);
    }
    return props.trim_trailing_whitespace === 'true' ? out.replace(/[ \t]+$/, '') : out;
  });

  let result = formatted.join(eol);
  if (props.insert_final_newline === 'true' || (hadFinalNewline && props.insert_final_newline !== 'false')) {
    result += eol;
  }
  return result;
}

/** Guesses a file's own indent style/size from its content, for when no .editorconfig rule applies. */
function sniffIndent(text: string): { style: 'tab' | 'space'; size: number } {
  const leads = text
    .split('\n')
    .map((l) => l.match(/^[ \t]+/)?.[0] ?? '')
    .filter(Boolean);
  const tabs = leads.filter((l) => l[0] === '\t').length;
  const spaced = leads.filter((l) => l[0] === ' ').map((l) => l.length);
  if (tabs > 0 && tabs >= spaced.length) return { style: 'tab', size: 1 };
  if (spaced.length === 0) return { style: 'space', size: 2 };
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  return { style: 'space', size: spaced.reduce(gcd) };
}

/** What newly introduced lines in `text` should be indented with: .editorconfig wins, else the file's own style. */
function indentTargetFor(file: string, text: string): { style: 'tab' | 'space'; size: number } {
  const props = editorConfigFor(file);
  const style = props.indent_style === 'tab' || props.indent_style === 'space' ? props.indent_style : undefined;
  const size = Number(props.indent_size === 'tab' ? props.tab_width : props.indent_size) || undefined;
  const sniffed = sniffIndent(text);
  return { style: style ?? sniffed.style, size: size ?? sniffed.size };
}

/**
 * Re-renders a block of lines in the target indent style, preserving their
 * relative nesting (the block's own smallest indent becomes one level).
 * `baseIndent` is prefixed to every line, e.g. the marker's own indentation.
 * A single line is just trimmed and prefixed – exactly today's behaviour.
 */
function reindentBlock(block: string[], baseIndent: string, target: { style: 'tab' | 'space'; size: number }): string[] {
  if (block.length <= 1) return [baseIndent + (block[0] ?? '').trim()];
  const leads = block.filter((l) => l.trim() !== '').map((l) => l.match(/^[ \t]*/)?.[0].length ?? 0);
  const unit = Math.min(...leads.filter((n) => n > 0), Infinity);
  const step = target.style === 'tab' ? '\t' : ' '.repeat(target.size);
  return block.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    const lead = line.match(/^[ \t]*/)?.[0].length ?? 0;
    const level = unit > 0 && Number.isFinite(unit) ? Math.round(lead / unit) : 0;
    return baseIndent + step.repeat(level) + trimmed;
  });
}

/** Whether `block` (compared line-by-line, trimmed) already occurs anywhere in `lines`. */
function containsBlock(lines: string[], block: string[]): boolean {
  const b = block.map((l) => l.trim());
  for (let k = 0; k + b.length <= lines.length; k++) {
    if (b.every((l, j) => lines[k + j].trim() === l)) return true;
  }
  return false;
}

/**
 * Reindents a multi-line `replace` template to match the indentation at its
 * first match in `text`. The first line continues inline right after the
 * match, so it's left exactly as written; only the following lines – which
 * start fresh – are re-rendered in the file's indent style.
 */
function reindentReplace(text: string, pattern: RegExp, replace: string, target: { style: 'tab' | 'space'; size: number }): string {
  const search = new RegExp(pattern.source, pattern.flags.replace('g', ''));
  const m = search.exec(text);
  if (!m) return replace;
  const lineStart = text.lastIndexOf('\n', m.index - 1) + 1;
  const baseIndent = text.slice(lineStart, m.index).match(/^[ \t]*/)?.[0] ?? '';
  const lines = replace.split('\n');
  const rendered = reindentBlock(lines, baseIndent, target);
  return [lines[0], ...rendered.slice(1)].join('\n');
}

// ─── Plan & execution ───────────────────────────────────────────────────────

interface Step {
  mark: '+' | '~' | '!' | '-' | '=' | '?';
  file: string;
  note?: string;
}

const isFile = (f: string): boolean => existsSync(f) && statSync(f).isFile();
const isInside = (root: string, f: string): boolean => {
  const rel = relative(root, f);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

/**
 * Computes all changes in memory without touching the disk.
 * `changes` holds the final state of every affected file (null = delete),
 * so several actions on the same file (e.g. add, then insert) build on each other.
 */
async function plan(actions: Action[], force: boolean) {
  const steps: Step[] = [];
  const changes = new Map<string, string | null>();
  const added = new Set<string>();
  const read = async (f: string): Promise<string | null> =>
    changes.has(f) ? (changes.get(f) ?? null) : isFile(f) ? await readFile(f, 'utf8') : null;

  for (const a of actions) {
    if ('add' in a) {
      const file = resolve(ROOT, a.add);
      const exists = (await read(file)) !== null;
      if (exists && !(a.force || force)) {
        steps.push({ mark: '=', file, note: 'exists, skipped' });
        continue;
      }
      changes.set(file, a.template);
      added.add(file);
      steps.push(exists ? { mark: '!', file, note: 'will be overwritten' } : { mark: '+', file });
      continue;
    }

    if ('delete' in a) {
      const file = resolve(ROOT, a.delete);
      if (!isInside(ROOT, file)) {
        steps.push({ mark: '?', file, note: 'outside the project, skipped' });
      } else if (existsSync(file) && !changes.has(file) && !isFile(file)) {
        steps.push({ mark: '?', file, note: 'is a directory, skipped' });
      } else if ((await read(file)) === null) {
        steps.push({ mark: '=', file, note: 'does not exist' });
      } else {
        changes.set(file, null);
        steps.push({ mark: '-', file });
      }
      continue;
    }

    const file = resolve(ROOT, 'insert' in a ? a.insert : a.modify);
    const text = await read(file);
    if (text === null) {
      steps.push({ mark: '?', file, note: 'file missing, skipped' });
      continue;
    }

    if ('insert' in a) {
      const lines = text.split('\n');
      const block = a.line.split('\n');
      if (containsBlock(lines, block)) {
        steps.push({ mark: '=', file, note: `already present: ${block[0].trim()}${block.length > 1 ? ' …' : ''}` });
        continue;
      }
      const i = lines.findIndex((l) => l.includes(a.before));
      if (i < 0) {
        steps.push({ mark: '?', file, note: `marker "${a.before}" not found` });
        continue;
      }
      const baseIndent = lines[i].match(/^\s*/)?.[0] ?? '';
      const rendered = reindentBlock(block, baseIndent, indentTargetFor(file, text));
      lines.splice(i, 0, ...rendered);
      changes.set(file, lines.join('\n'));
      steps.push({
        mark: '~',
        file,
        note: `+ ${block[0].trim()}${block.length > 1 ? ` (+${block.length - 1} more)` : ''}`,
      });
    } else {
      const replace = a.replace.includes('\n')
        ? reindentReplace(text, a.pattern, a.replace, indentTargetFor(file, text))
        : a.replace;
      const next = text.replace(a.pattern, replace);
      if (next === text) {
        steps.push({ mark: '=', file, note: `no match for ${a.pattern}` });
        continue;
      }
      changes.set(file, next);
      steps.push({ mark: '~', file, note: `${a.pattern} replaced` });
    }
  }

  // Only files jen creates (add) are reformatted; insert/modify already reuse
  // the surrounding file's own style, so they're left exactly as computed.
  for (const file of added) {
    const content = changes.get(file);
    if (typeof content === 'string') changes.set(file, applyEditorConfig(content, editorConfigFor(file)));
  }

  return { steps, changes };
}

/** Writes or deletes everything the plan computed. */
async function apply(changes: Map<string, string | null>): Promise<{ written: number; deleted: number }> {
  let written = 0;
  let deleted = 0;
  for (const [file, content] of changes) {
    if (content === null) {
      if (isFile(file)) {
        await rm(file);
        deleted++;
      }
      continue;
    }
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
    written++;
  }
  return { written, deleted };
}

const MARK_STYLE = {
  '+': 'green',
  '~': 'cyan',
  '!': 'yellow',
  '-': 'red',
  '=': 'dim',
  '?': 'magenta',
} as const;

function printPlan(steps: Step[]): void {
  for (const s of steps) {
    const note = s.note ? dim(`  ${s.note}`) : '';
    console.log(`  ${styleText(MARK_STYLE[s.mark], s.mark)} ${relative(process.cwd(), s.file)}${note}`);
  }
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

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: false, options: FLAGS });
  if (values.help) return void console.log(HELP);
  if (values.where) ROOT = resolve(process.cwd(), String(values.where));

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

// Only run as a program, not when jen.ts is imported (e.g. for its types).
const isMain = (() => {
  try {
    return realpathSync(process.argv[1] ?? '') === import.meta.filename;
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((e: unknown) => {
    console.error(styleText('red', e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  });
}
