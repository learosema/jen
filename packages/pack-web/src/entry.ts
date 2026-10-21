/**
 * The stylesheet entry point: a .css file carrying the `jen:imports` marker
 * (web:base writes `styles.css`). Generators wire their files into it as
 * `@import "…";` lines, relative to the entry's folder.
 */
import { posix } from 'node:path';
import type { Action, Context } from '@codejen/jen';
import { fill, template } from './templates.ts';

export const IMPORTS_MARKER = 'jen:imports';

/** CUBE CSS order, but utilities after blocks: a utility class on a block (`class="card bg-primary-subtle"`) wins. */
export const LAYERS = ['reset', 'tokens', 'base', 'compositions', 'blocks', 'utilities', 'exceptions'];

/** The same with Tailwind v4's layers fitted in: its theme first, its components before the blocks, its utilities with ours. */
export const TAILWIND_LAYERS = ['theme', 'reset', 'tokens', 'base', 'compositions', 'components', 'blocks', 'utilities', 'exceptions'];

export const ENTRY = 'styles.css';

export const TAILWIND_IMPORT = '@import "tailwindcss";';

export const entryCss = (files: string[], tailwind = false): string => {
  const imports = [...(tailwind ? [TAILWIND_IMPORT] : []), ...files.map(importLine)];
  return fill(template('styles.css'), { layers: (tailwind ? TAILWIND_LAYERS : LAYERS).join(', '), imports: imports.length ? imports.join('\n') : null });
};

/** Adds `files` and wires them into the project's entry point – or into a new `styles.css` if there is none. */
export function wireEntry(ctx: Context, files: { add: string; template: string }[], tailwind = false): Action[] {
  const paths = files.map((f) => f.add);
  return findEntry(ctx) ? [...files, ...importActions(ctx, paths)] : [{ add: ENTRY, template: entryCss(paths, tailwind) }, ...files];
}

/** Whether a stylesheet in the project imports Tailwind. */
export const usesTailwind = (ctx: Context): boolean =>
  ctx.grep(CSS, '@import "tailwindcss"').length > 0 || ctx.grep(CSS, "@import 'tailwindcss'").length > 0;

const CSS = /\.css$/;

/**
 * The entry jen's own `Find` lookup would pick: the nearest .css file with the
 * marker in the destination or a folder above it, else the shallowest one
 * anywhere. Null if there is none.
 */
export function findEntry(ctx: Context): string | null {
  const hasMarker = (file: string) => ctx.read(file)?.includes(IMPORTS_MARKER) ?? false;
  for (let dir = ctx.destDir; ; dir = posix.dirname(dir)) {
    const hit = ctx
      .readdir(dir)
      .filter((f) => CSS.test(f))
      .map((f) => (dir === '.' ? f : `${dir}/${f}`))
      .find(hasMarker);
    if (hit) return hit;
    if (dir === '.' || dir === '/' || dir === '') break;
  }
  return ctx.grep(CSS, IMPORTS_MARKER)[0] ?? null;
}

const IMPORT = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g;

/** `./a.css` and `a.css` are the same import. */
const bare = (path: string): string => path.replace(/^\.\//, '');

/** Whether `dir` is `base` or a folder below it (both relative to the root). */
const isBelow = (dir: string, base: string): boolean => base === '.' || dir === base || dir.startsWith(`${base}/`);

/**
 * `info:` notes for files that don't land next to the entry, when `--dir` wasn't given (`destDir` is where
 * you stand) – `jen web:card` at the root with `css/styles.css` would write `./card.css` – and for an
 * entry that already imports a file of the same name from somewhere else, e.g. from before such a rerun.
 */
function importNotes(ctx: Context, entry: string, files: string[], imports: string[]): Action[] {
  const notes: Action[] = [];
  const dir = posix.dirname(entry);
  const away = files.filter((f) => !isBelow(posix.dirname(posix.join(ctx.destDir, f)), dir));
  if (away.length && ctx.destDir === ctx.cwd) {
    const there = posix.relative(ctx.cwd, dir) || '.';
    const what = away.length === 1 ? away[0] : 'the new files';
    notes.push({ note: `${posix.basename(entry)} is in ${there}/ – pass --dir=${there} to put ${what} next to it` });
  }
  const existing = [...(ctx.read(entry) ?? '').matchAll(IMPORT)].map((m) => m[1]);
  for (const path of imports) {
    const other = existing.find((p) => bare(p) !== bare(path) && posix.basename(p) === posix.basename(path));
    if (other) notes.push({ note: `also imports "${other}" – drop that line if it's an old copy of ${posix.basename(path)}`, file: `/${entry}` });
  }
  return notes;
}

/**
 * `@import` lines for `files` (relative to the destination) in the entry, with notes on where they landed
 * (unless `hint` is off – for a file whose place the user named, like `--into`). With no entry, a `Find`
 * insert that jen shows as skipped, so the plan says why.
 */
export function importActions(ctx: Context, files: string[], hint = true): Action[] {
  const entry = findEntry(ctx);
  if (!entry) {
    return files.map((f) => ({
      insert: { find: CSS, containing: IMPORTS_MARKER, missing: `${f} isn't imported anywhere yet: @import it yourself, or run jen web:base for a styles.css that does` },
      before: IMPORTS_MARKER,
      line: importLine(f),
    }));
  }
  const from = posix.dirname(entry);
  const paths = files.map((f) => posix.relative(from, posix.join(ctx.destDir, f)));
  const inserts = paths.map((p): Action => ({ insert: `/${entry}`, before: IMPORTS_MARKER, line: importLine(p) }));
  return hint ? [...inserts, ...importNotes(ctx, entry, files, paths)] : inserts;
}

/** `./`-relative even in the same folder: Tailwind (and bundlers) read a bare name as a package. */
export const importLine = (path: string): string => `@import "${path.startsWith('.') ? path : `./${path}`}";`;
