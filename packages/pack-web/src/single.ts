/** One thing per file: a composition, utility or color in a stylesheet of its own, wired into the entry point – or with `--into`, added to a stylesheet of yours. */
import { posix } from 'node:path';
import type { Action, Context, Params } from '@codejen/jen';
import { ENTRY, entryCss, findEntry, importActions, wireEntry } from './entry.ts';

export interface Item {
  /** Where it goes, relative to the destination: `compositions/flow.css`. */
  path: string;
  /** The file's content, in its cascade layer. */
  css: string;
  /** Just the rules, for `--into`. */
  rules: string;
  /** What it defines, to find it elsewhere in the project: a class (`.flow`) or custom property (`--color-pink-1`). */
  defines: string;
}

export const INTO_PARAMS: Params = {
  into: { path: true, default: '', description: 'a stylesheet to add it to as plain rules, instead of a file of its own – made if missing, never rewritten' },
};

const CSS = /\.css$/;

/** Whether `css` defines `what`: a line starting with that selector or declaration, not just a longer name (`.flow` isn't `.flow-space-s`). */
export function defines(css: string, what: string): boolean {
  return css.split('\n').some((line) => {
    const rest = line.trimStart();
    return rest.startsWith(what) && !/^[\w-]/.test(rest.slice(what.length));
  });
}

/**
 * The project's stylesheet that already defines the item; null if none does. Its own file doesn't
 * count – jen skips that, or `--force` replaces it – but a `--into` stylesheet does.
 */
export function definedIn(ctx: Context, item: Item, into: string | null = null): string | null {
  const own = into ? null : posix.join(ctx.destDir, item.path);
  return ctx.grep(CSS, item.defines).find((f) => f !== own && defines(ctx.read(f) ?? '', item.defines)) ?? null;
}

/** The `--into` path param (`/css/layout.css`) relative to the destination, like every other action path; null without one. */
const intoPath = (ctx: Context, into: unknown): string | null => (into ? posix.relative(ctx.destDir, String(into).slice(1)) : null);

/**
 * Appends the items' rules to the stylesheet at `path`, and imports it into the entry point – unless it is the
 * entry. If it doesn't exist, it's made, along with an entry if there's none – or, `standalone`, on its own.
 */
function intoActions(ctx: Context, items: Item[], path: string, standalone = false): Action[] {
  const text = ctx.read(posix.join(ctx.destDir, path));
  const empty = (text ?? '').trim() === '';
  const appends = items.map((item, i): Action => ({ append: path, text: `${empty && i === 0 ? '' : '\n'}${item.rules.trimEnd()}` }));
  const entry = findEntry(ctx);
  // --into named the place itself: no hint to put it elsewhere
  const imports = entry === posix.join(ctx.destDir, path) ? [] : importActions(ctx, [path], false);
  if (text !== null) return [...appends, ...imports];
  if (entry || standalone || path === ENTRY) return [{ add: path, template: '' }, ...appends, ...(entry ? imports : [])];
  return [{ add: path, template: '' }, ...appends, { add: ENTRY, template: entryCss([path]) }];
}

/** What the plan says about an item the project already has, instead of adding it again. */
const alreadyHere = (item: Item, where: string): Action => ({ note: `${item.defines} is already here, nothing to add`, file: `/${where}` });

/** The items the project doesn't have yet (in `into`, or anywhere), and a note for each one it has. */
function sortOut(ctx: Context, items: Item[], into: string | null = null): { fresh: Item[]; notes: Action[] } {
  const fresh: Item[] = [];
  const notes: Action[] = [];
  for (const item of items) {
    const where = definedIn(ctx, item, into);
    if (where) notes.push(alreadyHere(item, where));
    else fresh.push(item);
  }
  return { fresh, notes };
}

/** A single generator's actions: its file (or `--into`) and @import – or a note if the project already has it. */
export function singleActions(ctx: Context, item: Item, into: unknown = ''): Action[] {
  const path = intoPath(ctx, into);
  const where = definedIn(ctx, item, path);
  if (where) return [alreadyHere(item, where)];
  if (path) return intoActions(ctx, [item], path);
  return [{ add: item.path, template: item.css }, ...importActions(ctx, [item.path])];
}

/** The items the project doesn't have yet, as files to add, and a note for each one left out – for the generators that write several at once. */
export function newFiles(ctx: Context, items: Item[]): { files: { add: string; template: string }[]; notes: Action[] } {
  const { fresh, notes } = sortOut(ctx, items);
  return { files: fresh.map((item) => ({ add: item.path, template: item.css })), notes };
}

/**
 * Several items at once: those the project doesn't have yet, each in its own file or all `--into` one, imported into
 * the entry point (made if there's none – or, `standalone`, not at all) – and a note for each one left out.
 */
export function bulkActions(ctx: Context, items: Item[], into: unknown = '', tailwind = false, standalone = false): Action[] {
  const path = intoPath(ctx, into);
  if (!path) {
    const { files, notes } = newFiles(ctx, items);
    return [...wireEntry(ctx, files, tailwind), ...notes];
  }
  const { fresh, notes } = sortOut(ctx, items, path);
  return [...(fresh.length ? intoActions(ctx, fresh, path, standalone) : []), ...notes];
}

/** `css` without its one outer `@layer name { … }`, a level less indented – for `--into`, where there are no layers. */
export function unlayer(css: string): string {
  const lines = css.trimEnd().split('\n');
  const start = lines.findIndex((l) => /^@layer [\w-]+ \{$/.test(l));
  // the layer's own closing brace: the first line after it back at column 0
  const end = lines.findIndex((l, i) => i > start && l === '}');
  if (start < 0 || end < 0) return css.trimEnd();
  const inner = lines.slice(start + 1, end).map((l) => l.replace(/^ {2}/, ''));
  return [...lines.slice(0, start), ...inner, ...lines.slice(end + 1)].join('\n').trim();
}
