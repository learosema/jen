/**
 * Public types (for generators and packs), string-case helpers, and the
 * plan/apply engine: computing changes in memory, then writing them out.
 */
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { styleText } from 'node:util';
import { applyEditorConfig, containsBlock, editorConfigFor, indentTargetFor, reindentBlock, reindentReplace } from './editorconfig.ts';
import { ROOT } from './location.ts';

// ─── Public types ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Answers = Record<string, any>;

/**
 * A parameter's default also decides its type: boolean default → boolean, otherwise string.
 * `path: true` marks a path the user types relative to where they stand; the generator
 * gets it ready to use as an action path (`/…`, from the project root), or `''` if not given.
 * `description` is a short phrase shown by `jen <generator> --help` and `jen --list --json`.
 * `choices` lists every value a string param takes: jen refuses any other (the default always passes).
 */
export type Params = Record<string, { default?: string | boolean; path?: boolean; description?: string; choices?: readonly string[] }>;

/**
 * An existing file for jen to find, instead of a path: the nearest file named `find`
 * (or matching it) that contains `containing`, in the destination or a folder above
 * it, else the shallowest such file anywhere in the project. For `insert`,
 * `containing` defaults to the marker.
 */
export interface Find {
  find: string | RegExp;
  containing?: string;
  /** What the plan says if there is no such file, e.g. how to make one – instead of `no <find> containing "…" found`. */
  missing?: string;
}

/**
 * Paths in actions are relative to where the files go – the current directory,
 * or `--dir` – so a generator never decides where its files land. A path
 * starting with `/` is relative to the project root instead. Nothing outside the
 * project root is touched.
 */
export type Action =
  /** Create a file. Skipped if it exists (unless force / --force). */
  | { add: string; template: string; force?: boolean }
  /** Create a binary file, written byte for byte – otherwise like the above. */
  | { add: string; bytes: Uint8Array; force?: boolean }
  /**
   * Insert `line` before the marker line: the first line containing
   * `before`, the first line matching it if it's a RegExp, or – a number –
   * that line itself (1-based, e.g. from `--line=65`). A single line
   * reuses the marker's own indentation exactly – one level deeper before a
   * closing line (`</nav>`, `}`), where it goes inside; a `\n`-joined block is
   * re-rendered in the file's indent style, keeping the block's relative
   * nesting. No duplicates. With `path` instead of `line`, the line is the
   * path of that file, relative to the folder of the file inserted into –
   * how a build file lists its sources.
   *
   * With `after` instead of `before`, the line goes after the last line
   * containing (or matching) it, e.g. `after: /^import /` – at its indentation,
   * one level deeper after an opening line (`[`, `{`, `(` at the end).
   */
  | ({ insert: string | Find } & InsertAt & ({ line: string } | { path: string }))
  /**
   * Search and replace via RegExp. Also handy for removing lines. A
   * multi-line `replace` is reindented to match the first match's line.
   */
  | { modify: string | Find; pattern: RegExp; replace: string }
  /**
   * Add `text` at the end of the file, on a line of its own – start it with
   * `\n` for a blank line before it. Re-rendered in the file's indent style
   * like an inserted block. Skipped if the file already contains it.
   */
  | { append: string; text: string }
  /** Delete a file. Directories are refused. */
  | { delete: string }
  /**
   * Tell the user something and change nothing, e.g. why a file was left out:
   * `{ note: '.reel is already here, nothing to add', file: 'css/layout.css' }`.
   * The plan shows it as `info:`, with `file` placed like any action path.
   * `written: true` makes it a note about what an `add` of `file` writes: left out when that add is skipped.
   * `warning: true` shows it as `warning:` – something the user should fix (`--strict` then exits 1).
   */
  | { note: string; file?: string; written?: boolean; warning?: boolean };

/** Where an insert goes: `before` or `after` a marker – the other one stays undefined, so `a.before` can still be read. */
export type InsertAt = { before: string | RegExp | number; after?: undefined } | { after: string | RegExp; before?: undefined };

/** An action with its file resolved – a path from the project root – or skipped with a note. */
export type Placed =
  /** `verbatim`: no EditorConfig – for jen's own `generator --like`, whose template literals must stay exact. */
  | { add: string; template: string; force?: boolean; verbatim?: true }
  | { add: string; bytes: Uint8Array; force?: boolean }
  | ({ insert: string; line: string } & InsertAt)
  | { modify: string; pattern: RegExp; replace: string }
  | { append: string; text: string }
  | { delete: string }
  | { note: string; file?: string; written?: true; warning?: true }
  /** `skip` is the file it was about, or `''` if there is none to name; `hint` if the note is a `Find`'s own `missing`, so nothing went wrong. */
  | { skip: string; note: string; hint?: true };

export interface Helpers {
  pascal(s: string): string;
  camel(s: string): string;
  snake(s: string): string;
  kebab(s: string): string;
  constant(s: string): string;
}

/** Read-only view of the project below its root. Paths are relative to the root (a leading `/` is ignored) and use `/`. */
export interface Probe {
  exists(path: string): boolean;
  isDir(path: string): boolean;
  /** File contents, or null if it can't be read. */
  read(path: string): string | null;
  /** Entry names of a directory, sorted; empty if there is none. */
  readdir(path: string): string[];
  /** The nearest file called `name` (containing `text`, if given) in `from` or a parent directory up to the root. */
  findUp(name: string, text?: string, from?: string): string | null;
  /** Files below the root (a few levels deep, skipping node_modules, build output …) named `name` and containing `text`; shallowest first. */
  grep(name: string | RegExp, text?: string): string[];
}

/**
 * What `actions` may know about the project, besides the answers – rarely
 * needed: action paths, `Find` targets and `path` params cover the usual cases.
 */
export interface Context extends Probe {
  /** Absolute project root. */
  root: string;
  /** The current directory, relative to the root (`.` at the root). */
  cwd: string;
  /** Where the files go, relative to the root: `--dir`, else the current directory. Action paths are relative to it. */
  destDir: string;
  /** Every `--flag` given besides jen's own (and `--dir`, unless it's a param), plus the positionals after the generator name – declared params or not. */
  args?: Args;
}

export interface Args {
  flags: Record<string, string | boolean>;
  positionals: string[];
}

/** `actions` may be async – a pack's own generators usually aren't, so `Generator` defaults to sync. */
export interface Generator<Result extends Action[] | Promise<Action[]> = Action[]> {
  description?: string;
  params?: Params;
  /** Example calls, each what follows the generator's name: `--name=Player --moveOnly`. */
  examples?: string[];
  /**
   * How to use what it makes, for people and AIs reading `--help` or `--list --json`: markup,
   * custom properties (as CSS, so they don't read like flags), attributes – one line each, free text, e.g.
   * `['<div class="sidebar"><aside>…</aside><main>…</main></div>', '.sidebar { --sidebar-target: 20rem; }  the sidebar\'s width']`.
   */
  usage?: string[];
  /** Accept flags that aren't params and hand them on through `ctx.args`, e.g. to a Yeoman generator's prompts. */
  passthrough?: boolean;
  actions(answers: Answers, helpers: Helpers, ctx: Context): Result;
}

/**
 * A pack's named export `recipes`: generators that make something together, in order – for people and AIs
 * reading `--list --json` or `--find`. `steps` are whole calls without `jen` (`web:card --dir=css`); `usage` is
 * how the results fit together, like a generator's `usage`.
 */
export interface Recipe {
  name: string;
  description: string;
  steps: string[];
  usage?: string[];
  /** A page that explains it step by step. */
  docs?: string;
}

/** Generators of one kind (a pack's `groups` export), on one line in `--list`: their names after the description. */
export interface Group {
  name: string;
  description: string;
  /** The generators' names in the pack, without its prefix. */
  generators: string[];
}

/** A generator whose actions may or may not be async. */
export type AnyGenerator = Generator<Action[] | Promise<Action[]>>;

/** Default export of a jen pack: generator name → generator – or a `PackFactory`. */
export type Pack = Record<string, Generator>;

/** What a pack factory can find out about installed packages, from the same places jen looks for packs. */
export interface PackEnv {
  /** Names of dependencies matching `re`: the project's, the user directory's, global ones, and a `--from` package. */
  packages(re: RegExp): string[];
  /** The file `name` (or `name/sub/path`) resolves to from those places, first match; null if it's not installed. */
  resolve(name: string): string | null;
  /**
   * Installs `name` into a throwaway directory for this run, like `--from`, and resolves it; null if fetching is
   * off (JEN_NO_FETCH). Only for names the pack itself knows – never one taken from the command line.
   */
  fetch(name: string): Promise<string | null>;
}

/** A pack's default export, when its generators depend on what's installed, e.g. one per package of a kind. */
export type PackFactory = (env: PackEnv) => Record<string, AnyGenerator> | Promise<Record<string, AnyGenerator>>;

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

export function fail(message: string): never {
  throw new Error(message);
}

/** An error with a code and details for programs (`--json`): `missing_param`, `unknown_flag`, `bad_value`, `not_found`, `unknown_pack`. */
export class JenError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export const dim = (s: string): string => styleText('dim', s);

// ─── Plan & execution ───────────────────────────────────────────────────────

/** `+ ~ ! -` change a file; `info` means nothing is wrong, `warning` that something asked for was skipped. */
export interface Step {
  mark: '+' | '~' | '!' | '-' | 'info' | 'warning';
  file: string;
  /** Where an insert went (1-based), shown as `file:line`. */
  line?: number;
  note?: string;
}

/** Whether line `l` holds a text marker (contains it) or matches a RegExp one. */
function hasMarker(l: string, marker: string | RegExp): boolean {
  if (typeof marker === 'string') return l.includes(marker);
  marker.lastIndex = 0; // a /g or /y RegExp would otherwise carry state between lines
  return marker.test(l);
}

/** "12 and 37", "3, 12 and 37" – a few line numbers (1-based) for a note. */
export function lineList(ns: number[]): string {
  const shown = ns.slice(0, 5).map(String);
  if (ns.length > 5) return `${shown.join(', ')} … (${ns.length} in all)`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}` : shown.join('');
}

const isFile = (f: string): boolean => existsSync(f) && statSync(f).isFile();
const isInside = (root: string, f: string): boolean => {
  const rel = relative(root, f);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

/**
 * Computes all changes in memory without touching the disk. Files outside the
 * project root (and `extraRoots`, e.g. the user directory for built-ins) are skipped.
 * `changes` holds the final state of every affected file (null = delete),
 * so several actions on the same file (e.g. add, then insert) build on each other.
 */
export async function plan(actions: Placed[], force: boolean, extraRoots: string[] = []) {
  const steps: Step[] = [];
  const changes = new Map<string, string | Uint8Array | null>();
  const added = new Set<string>();
  // notes about what an add writes (`written: true`), and the adds that were skipped
  const aboutWritten = new Set<Step>();
  const skippedAdds = new Set<string>();
  const read = async (f: string): Promise<string | null> => {
    const change = changes.get(f);
    if (change !== undefined) return typeof change === 'string' || change === null ? change : Buffer.from(change).toString('utf8');
    return isFile(f) ? await readFile(f, 'utf8') : null;
  };

  for (const a of actions) {
    if ('skip' in a) {
      steps.push({ mark: a.hint ? 'info' : 'warning', file: a.skip && resolve(ROOT, a.skip), note: a.note });
      continue;
    }
    if (!('add' in a || 'delete' in a || 'insert' in a || 'append' in a || 'modify' in a)) {
      const step: Step = { mark: a.warning ? 'warning' : 'info', file: a.file ? resolve(ROOT, a.file) : '', note: a.note };
      if (a.written && a.file) aboutWritten.add(step);
      steps.push(step);
      continue;
    }

    const file = resolve(ROOT, 'add' in a ? a.add : 'delete' in a ? a.delete : 'insert' in a ? a.insert : 'append' in a ? a.append : a.modify);
    if (![ROOT, ...extraRoots].some((root) => isInside(root, file))) {
      steps.push({ mark: 'warning', file, note: 'is outside the project, skipped' });
      continue;
    }

    if ('add' in a) {
      const exists = (await read(file)) !== null;
      if (exists && !(a.force || force)) {
        steps.push({ mark: 'info', file, note: 'exists, skipped' });
        skippedAdds.add(file);
        continue;
      }
      changes.set(file, 'bytes' in a ? a.bytes : a.template);
      if (!('verbatim' in a && a.verbatim)) added.add(file);
      steps.push(exists ? { mark: '!', file, note: 'will be overwritten' } : { mark: '+', file });
      continue;
    }

    if ('delete' in a) {
      if (existsSync(file) && !changes.has(file) && !isFile(file)) {
        steps.push({ mark: 'warning', file, note: 'is a directory, skipped' });
      } else if ((await read(file)) === null) {
        steps.push({ mark: 'info', file, note: 'does not exist' });
      } else {
        changes.set(file, null);
        steps.push({ mark: '-', file });
      }
      continue;
    }

    const text = await read(file);
    if (text === null) {
      steps.push({ mark: 'warning', file, note: 'is missing, skipped' });
      continue;
    }

    if ('append' in a) {
      const block = a.text.replace(/\s+$/, '').split('\n');
      // what the plan shows: the first line that isn't blank or a comment
      const label = block.find((l) => l.trim() && !/^\s*(\/[*/]|\*(\s|\/|$))/.test(l))?.trim() ?? block.find((l) => l.trim())?.trim() ?? '';
      if (block.every((l) => !l.trim()) || containsBlock(text.split('\n').filter((l) => l.trim()), block.filter((l) => l.trim()))) {
        steps.push({ mark: 'info', file, note: `already has ${label}` });
        continue;
      }
      const target = indentTargetFor(file, text);
      const rendered = reindentBlock(block, '', target).join('\n');
      changes.set(file, `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${rendered}\n`);
      steps.push({ mark: '~', file, note: `+ ${label} (appended)` });
    } else if ('insert' in a) {
      const lines = text.split('\n');
      const block = a.line.split('\n');
      // a block may start with a blank line, to stand apart: name it by its first line with text
      const label = block.find((l) => l.trim())?.trim() ?? '';
      if (containsBlock(lines, block)) {
        steps.push({ mark: 'info', file, note: `already has ${label}${block.length > 1 ? ' …' : ''}` });
        continue;
      }
      const after = a.after !== undefined;
      const marker = a.after !== undefined ? a.after : a.before;
      // A file ending in a newline splits into one more (empty) element: the last line counts, the empty one doesn't.
      const lineCount = text.endsWith('\n') ? lines.length - 1 : lines.length;
      const hits =
        typeof marker === 'number'
          ? Number.isInteger(marker) && marker >= 1 && marker <= lineCount + 1
            ? [marker - 1]
            : []
          : lines.slice(0, lineCount).flatMap((l, n) => (hasMarker(l, marker) ? [n] : []));
      if (hits.length === 0) {
        const note =
          typeof marker === 'number'
            ? `has no line ${marker} (${lineCount} lines), skipped`
            : `has no marker ${typeof marker === 'string' ? `"${marker}"` : String(marker)}, skipped`;
        steps.push({ mark: 'warning', file, note });
        continue;
      }
      // before: the first line with the marker; after: the last one
      const anchor = after ? hits[hits.length - 1] : hits[0];
      const i = after ? anchor + 1 : anchor;
      const target = indentTargetFor(file, text);
      const anchorLine = lines[anchor] ?? '';
      // Before a closing line (`</nav>`, `}`, `)`, `]`), or after an opening one (`[`, `{`, `(`), the insert goes inside: one level deeper.
      const inside = after ? /[[{(]\s*$/.test(anchorLine) : /^\s*(?:<\/|[)}\]])/.test(anchorLine);
      const baseIndent = (anchorLine.match(/^\s*/)?.[0] ?? '') + (inside ? (target.style === 'tab' ? '\t' : ' '.repeat(target.size)) : '');
      const rendered = reindentBlock(block, baseIndent, target);
      lines.splice(i, 0, ...rendered);
      changes.set(file, lines.join('\n'));
      steps.push({ mark: '~', file, line: i + 1, note: `+ ${label}${block.length > 1 ? ` (+${block.length - 1} more)` : ''}` });
      // text a person typed (`--line="</nav>"`) may well be on more than one line: say which one was used
      if (typeof marker === 'string' && !after && hits.length > 1) {
        steps.push({ mark: 'info', file, note: `"${marker}" is on lines ${lineList(hits.map((n) => n + 1))} – used line ${anchor + 1}` });
      }
    } else {
      const replace = a.replace.includes('\n')
        ? reindentReplace(text, a.pattern, a.replace, indentTargetFor(file, text))
        : a.replace;
      const next = text.replace(a.pattern, replace);
      if (next === text) {
        steps.push({ mark: 'info', file, note: 'nothing matched' });
        continue;
      }
      changes.set(file, next);
      steps.push({ mark: '~', file, note: replacedNote(text, a.pattern, replace) });
    }
  }

  for (const step of aboutWritten) if (skippedAdds.has(step.file)) steps.splice(steps.indexOf(step), 1);

  // each skipped file says so on its own line; what --force would do, once
  const skipped = skippedAdds.size;
  if (skipped > 0) {
    const what = skipped === 1 ? '1 file exists and was skipped – --force overwrites it' : `${skipped} files exist and were skipped – --force overwrites them`;
    steps.push({ mark: 'info', file: '', note: what });
  }

  // Only files jen creates (add) are reformatted; insert/modify already reuse
  // the surrounding file's own style, so they're left exactly as computed.
  for (const file of added) {
    const content = changes.get(file);
    if (typeof content === 'string') changes.set(file, applyEditorConfig(content, editorConfigFor(file)));
  }

  return { steps, changes };
}

/** What the plan says about a `modify`, from its first match – never the RegExp: `removed: <line>` or `replaced, now: <line>`. */
function replacedNote(text: string, pattern: RegExp, replace: string): string {
  const once = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''));
  const match = once.exec(text)?.[0] ?? '';
  const firstLine = (s: string) => s.split('\n').find((l) => l.trim())?.trim();
  const now = firstLine(match.replace(once, replace));
  if (now) return `replaced, now: ${now}`;
  const gone = firstLine(match);
  return gone ? `removed: ${gone}` : 'replaced';
}

/** Writes or deletes everything the plan computed. */
export async function apply(changes: Map<string, string | Uint8Array | null>): Promise<{ written: number; deleted: number }> {
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
  info: 'dim',
  warning: 'yellow',
} as const;

/** What `--json` calls each mark. */
const KIND = { '+': 'created', '~': 'changed', '!': 'overwritten', '-': 'deleted', info: 'info', warning: 'warning' } as const;

export interface PlanItem {
  kind: (typeof KIND)[keyof typeof KIND];
  /** Relative to the current directory; absent for a note about no file. */
  file?: string;
  line?: number;
  note?: string;
}

/** The plan as it's shown: files relative to the current directory, repeated info and warning lines once. */
export function planItems(steps: Step[]): Array<PlanItem & { mark: Step['mark'] }> {
  const said = new Set<string>();
  const items: Array<PlanItem & { mark: Step['mark'] }> = [];
  for (const s of steps) {
    const file = s.file ? relative(process.cwd(), s.file) || '.' : undefined;
    if (s.mark === 'info' || s.mark === 'warning') {
      // e.g. two inserts into the same missing file: once is enough
      const key = `${s.mark}:${[file, s.note].filter(Boolean).join(' ')}`;
      if (said.has(key)) continue;
      said.add(key);
    }
    items.push({ mark: s.mark, kind: KIND[s.mark], ...(file && { file }), ...(s.line && { line: s.line }), ...(s.note && { note: s.note }) });
  }
  return items;
}

export function printPlan(steps: Step[]): void {
  for (const s of planItems(steps)) {
    if (s.mark === 'info' || s.mark === 'warning') {
      const text = [s.file, s.note].filter(Boolean).join(' ');
      console.log(`  ${styleText(MARK_STYLE[s.mark], `${s.mark}:`)} ${s.mark === 'info' ? dim(text) : text}`);
      continue;
    }
    const note = s.note ? dim(`  ${s.note}`) : '';
    console.log(`  ${styleText(MARK_STYLE[s.mark], s.mark)} ${s.file}${s.line ? `:${s.line}` : ''}${note}`);
  }
}
