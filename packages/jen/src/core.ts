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
 * Computes all changes in memory without touching the disk.
 * `changes` holds the final state of every affected file (null = delete),
 * so several actions on the same file (e.g. add, then insert) build on each other.
 */
export async function plan(actions: Action[], force: boolean) {
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
