/**
 * The stylesheet entry point: a .css file carrying the `jen:imports` marker
 * (web:base writes `styles.css`). Generators wire their files into it as
 * `@import "…";` lines, relative to the entry's folder.
 */
import { posix } from 'node:path';
import type { Action, Context } from '@codejen/jen';

export const IMPORTS_MARKER = 'jen:imports';

export const LAYERS = ['reset', 'tokens', 'base', 'compositions', 'utilities', 'blocks', 'exceptions'];

/** CUBE CSS order with Tailwind v4's layers fitted in: its theme first, its components before its (and our) utilities. */
export const TAILWIND_LAYERS = ['theme', 'reset', 'tokens', 'base', 'compositions', 'components', 'utilities', 'blocks', 'exceptions'];

export const ENTRY = 'styles.css';

export const TAILWIND_IMPORT = '@import "tailwindcss";';

export const layerLine = (tailwind: boolean): string => `@layer ${(tailwind ? TAILWIND_LAYERS : LAYERS).join(', ')};`;

export const entryCss = (files: string[], tailwind = false) => `/*
 * Stylesheet entry point, cascade layers in CUBE CSS order (later layers win).
 * jen generators add their @import lines above the marker at the end.
 */
${layerLine(tailwind)}

${[...(tailwind ? [TAILWIND_IMPORT] : []), ...files.map(importLine)].join('\n')}
/* ${IMPORTS_MARKER} */
`;

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

/** `./`-relative even in the same folder: Tailwind (and bundlers) read a bare name as a package. */
export const importLine = (path: string): string => `@import "${path.startsWith('.') ? path : `./${path}`}";`;
