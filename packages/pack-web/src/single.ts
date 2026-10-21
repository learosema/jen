/** One thing per file: a composition, utility or color in a stylesheet of its own, wired into the entry point – or with `--into`, added to a stylesheet of yours. */
import { posix } from 'node:path';
import type { Action, Context, Params } from '@codejen/jen';
import { fail } from './common.ts';
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
  into: { path: true, default: '', description: 'a stylesheet to add it to, as plain rules, instead of a file of its own – made if it doesn\'t exist' },
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

/** Appends the items' rules to the stylesheet at `path` – made, and imported into the entry point, if it doesn't exist. */
function intoActions(ctx: Context, items: Item[], path: string): Action[] {
  const text = ctx.read(posix.join(ctx.destDir, path));
  const empty = (text ?? '').trim() === '';
  const appends = items.map((item, i): Action => ({ append: path, text: `${empty && i === 0 ? '' : '\n'}${item.rules.trimEnd()}` }));
  if (text !== null) return [...appends, ...importActions(ctx, [path])];
  const imports = findEntry(ctx) ? importActions(ctx, [path]) : [{ add: ENTRY, template: entryCss([path]) }];
  return [{ add: path, template: '' }, ...appends, ...imports];
}

/** A single generator's actions: its file (or `--into`) and @import – or a failure if the project already has it elsewhere. */
export function singleActions(ctx: Context, generator: string, item: Item, into: unknown = ''): Action[] {
  const path = intoPath(ctx, into);
  const where = definedIn(ctx, item, path);
  if (where) fail(`${generator}: ${item.defines} is already in ${where} – nothing to add`);
  if (path) return intoActions(ctx, [item], path);
  return [{ add: item.path, template: item.css }, ...importActions(ctx, [item.path])];
}

/** The items the project doesn't have yet, as files to add – for the generators that write several at once. */
export const newFiles = (ctx: Context, items: Item[]): { add: string; template: string }[] =>
  items.filter((item) => !definedIn(ctx, item)).map((item) => ({ add: item.path, template: item.css }));

/** Several items at once: those the project doesn't have yet, each in its own file or all `--into` one, imported into the entry point (made if there's none). */
export function bulkActions(ctx: Context, items: Item[], into: unknown = '', tailwind = false): Action[] {
  const path = intoPath(ctx, into);
  if (!path) return wireEntry(ctx, newFiles(ctx, items), tailwind);
  const missing = items.filter((item) => !definedIn(ctx, item, path));
  return missing.length ? intoActions(ctx, missing, path) : [];
}
