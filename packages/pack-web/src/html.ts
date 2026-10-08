/**
 * Markup for `--into=<page.html>`: blocks go in before `</body>`, so any page
 * works without a marker; jen skips blocks the page already has.
 */
import { posix } from 'node:path';
import type { Action } from '@codejen/jen';
import { template } from './templates.ts';

const BODY_END = /<\/body>/;

/** "confirm-delete" → "Confirm delete": a visible label from a kebab-case id. */
export const sentence = (id: string): string => {
  const text = id.replaceAll('-', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Inserts `blocks` into the page at `into` (a path param: root-relative, `/…`). */
export const intoPage = (into: string, blocks: string[]): Action[] => blocks.map((line) => ({ insert: into, before: BODY_END, line }));

/** A file next to the page, as an action path (`/…`), and how the page refers to it. */
export function besidePage(into: string, file: string): { path: string; src: string } {
  return { path: posix.join(posix.dirname(into), file), src: `./${file}` };
}

export const COMMANDS_FILE = 'commands.js';

/** A fallback for the `command`/`commandfor` button attributes, for browsers without them. */
export const COMMANDS_JS = template('commands.js');

/** commands.js next to the page, and its script tag in the page. */
export function commandsFallback(into: string): Action[] {
  const { path, src } = besidePage(into, COMMANDS_FILE);
  return [{ add: path, template: COMMANDS_JS }, ...intoPage(into, [`<script type="module" src="${src}"></script>`])];
}
