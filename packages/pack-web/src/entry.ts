/**
 * The stylesheet entry point: a .css file carrying the `jen:imports` marker
 * (web:base writes `styles.css`). Generators wire their files into it as
 * `@import url("…");` lines, relative to the entry's folder.
 */
import { posix } from 'node:path';
import type { Action, Context } from '@codejen/jen';

export const IMPORTS_MARKER = 'jen:imports';

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

/**
 * `@import` lines for `files` (relative to the destination) in the entry. With
 * no entry, a `Find` insert that jen shows as skipped, so the plan says why.
 */
export function importActions(ctx: Context, files: string[]): Action[] {
  const entry = findEntry(ctx);
  if (!entry) {
    return files.map((f) => ({ insert: { find: CSS, containing: IMPORTS_MARKER }, before: IMPORTS_MARKER, line: importLine(f) }));
  }
  const from = posix.dirname(entry);
  return files.map((f) => ({
    insert: `/${entry}`,
    before: IMPORTS_MARKER,
    line: importLine(posix.relative(from, posix.join(ctx.destDir, f))),
  }));
}

export const importLine = (path: string): string => `@import url("${path}");`;
