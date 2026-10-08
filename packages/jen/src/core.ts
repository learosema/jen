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
 */
export type Params = Record<string, { default?: string | boolean; path?: boolean }>;

/**
 * An existing file for jen to find, instead of a path: the nearest file named `find`
 * (or matching it) that contains `containing`, in the destination or a folder above
 * it, else the shallowest such file anywhere in the project. For `insert`,
 * `containing` defaults to the marker.
 */
export interface Find {
  find: string | RegExp;
  containing?: string;
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
   */
  | ({ insert: string | Find; before: string | RegExp | number } & ({ line: string } | { path: string }))
  /**
   * Search and replace via RegExp. Also handy for removing lines. A
   * multi-line `replace` is reindented to match the first match's line.
   */
  | { modify: string | Find; pattern: RegExp; replace: string }
  /** Delete a file. Directories are refused. */
  | { delete: string };

/** An action with its file resolved – a path from the project root – or skipped with a note. */
export type Placed =
  | { add: string; template: string; force?: boolean }
  | { insert: string; before: string | RegExp | number; line: string }
  | { modify: string; pattern: RegExp; replace: string }
  | { delete: string }
  | { skip: string; note: string };

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
}

export interface Generator {
  description?: string;
  params?: Params;
  actions(answers: Answers, helpers: Helpers, ctx: Context): Action[];
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

export function fail(message: string): never {
  throw new Error(message);
}

export const dim = (s: string): string => styleText('dim', s);

// ─── Plan & execution ───────────────────────────────────────────────────────

export interface Step {
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
 * Computes all changes in memory without touching the disk. Files outside the
 * project root (and `extraRoots`, e.g. the user directory for built-ins) are skipped.
 * `changes` holds the final state of every affected file (null = delete),
 * so several actions on the same file (e.g. add, then insert) build on each other.
 */
export async function plan(actions: Placed[], force: boolean, extraRoots: string[] = []) {
  const steps: Step[] = [];
  const changes = new Map<string, string | null>();
  const added = new Set<string>();
  const read = async (f: string): Promise<string | null> =>
    changes.has(f) ? (changes.get(f) ?? null) : isFile(f) ? await readFile(f, 'utf8') : null;

  for (const a of actions) {
    if ('skip' in a) {
      steps.push({ mark: '?', file: resolve(ROOT, a.skip), note: a.note });
      continue;
    }

    const file = resolve(ROOT, 'add' in a ? a.add : 'delete' in a ? a.delete : 'insert' in a ? a.insert : a.modify);
    if (![ROOT, ...extraRoots].some((root) => isInside(root, file))) {
      steps.push({ mark: '?', file, note: 'outside the project, skipped' });
      continue;
    }

    if ('add' in a) {
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
      if (existsSync(file) && !changes.has(file) && !isFile(file)) {
        steps.push({ mark: '?', file, note: 'is a directory, skipped' });
      } else if ((await read(file)) === null) {
        steps.push({ mark: '=', file, note: 'does not exist' });
      } else {
        changes.set(file, null);
        steps.push({ mark: '-', file });
      }
      continue;
    }

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
      const marker = a.before;
      // A file ending in a newline splits into one more (empty) element: the last line counts, the empty one doesn't.
      const lineCount = text.endsWith('\n') ? lines.length - 1 : lines.length;
      const i =
        typeof marker === 'number'
          ? Number.isInteger(marker) && marker >= 1 && marker <= lineCount + 1
            ? marker - 1
            : -1
          : lines.findIndex((l) => {
              if (typeof marker === 'string') return l.includes(marker);
              marker.lastIndex = 0; // a /g or /y RegExp would otherwise carry state between lines
              return marker.test(l);
            });
      if (i < 0) {
        const note =
          typeof marker === 'number'
            ? `line ${marker} is not in the file (${lineCount} lines)`
            : `marker ${typeof marker === 'string' ? `"${marker}"` : String(marker)} not found`;
        steps.push({ mark: '?', file, note });
        continue;
      }
      const target = indentTargetFor(file, text);
      // Before a closing line (`</nav>`, `}`, `)`, `]`), the insert goes inside: one level deeper.
      const closing = /^\s*(?:<\/|[)}\]])/.test(lines[i]);
      const baseIndent = (lines[i].match(/^\s*/)?.[0] ?? '') + (closing ? (target.style === 'tab' ? '\t' : ' '.repeat(target.size)) : '');
      const rendered = reindentBlock(block, baseIndent, target);
      lines.splice(i, 0, ...rendered);
      changes.set(file, lines.join('\n'));
      steps.push({
        mark: '~',
        file,
        note: `+ ${block[0].trim()}${block.length > 1 ? ` (+${block.length - 1} more)` : ''}${typeof marker === 'number' ? ` at line ${marker}` : ''}`,
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
export async function apply(changes: Map<string, string | null>): Promise<{ written: number; deleted: number }> {
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

export function printPlan(steps: Step[]): void {
  for (const s of steps) {
    const note = s.note ? dim(`  ${s.note}`) : '';
    console.log(`  ${styleText(MARK_STYLE[s.mark], s.mark)} ${relative(process.cwd(), s.file)}${note}`);
  }
}
