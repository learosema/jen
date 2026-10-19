/** One thing per file: a composition, utility or color in a stylesheet of its own, wired into the entry point. */
import { posix } from 'node:path';
import type { Action, Context } from '@codejen/jen';
import { fail } from './common.ts';
import { importActions, wireEntry } from './entry.ts';

export interface Item {
  /** Where it goes, relative to the destination: `compositions/flow.css`. */
  path: string;
  css: string;
  /** What it defines, to find it elsewhere in the project: a class (`.flow`) or custom property (`--color-pink-1`). */
  defines: string;
}

const CSS = /\.css$/;

/** Whether `css` defines `what`: a line starting with that selector or declaration, not just a longer name (`.flow` isn't `.flow-space-s`). */
export function defines(css: string, what: string): boolean {
  return css.split('\n').some((line) => {
    const rest = line.trimStart();
    return rest.startsWith(what) && !/^[\w-]/.test(rest.slice(what.length));
  });
}

/** The project's stylesheet, other than the item's own file, that already defines it; null if none does. */
export function definedIn(ctx: Context, item: Item): string | null {
  const own = posix.join(ctx.destDir, item.path);
  return ctx.grep(CSS, item.defines).find((f) => f !== own && defines(ctx.read(f) ?? '', item.defines)) ?? null;
}

/** A single generator's actions: its file and @import – or a failure if the project already has it elsewhere. */
export function singleActions(ctx: Context, generator: string, item: Item): Action[] {
  const where = definedIn(ctx, item);
  if (where) fail(`${generator}: ${item.defines} is already in ${where} – nothing to add`);
  return [{ add: item.path, template: item.css }, ...importActions(ctx, [item.path])];
}

/** The items the project doesn't have yet, as files to add – for the generators that write several at once. */
export const newFiles = (ctx: Context, items: Item[]): { add: string; template: string }[] =>
  items.filter((item) => !definedIn(ctx, item)).map((item) => ({ add: item.path, template: item.css }));

/** Several items at once: those the project doesn't have yet, imported into the entry point (made if there's none). */
export const bulkActions = (ctx: Context, items: Item[], tailwind = false): Action[] => wireEntry(ctx, newFiles(ctx, items), tailwind);
