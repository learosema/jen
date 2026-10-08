/**
 * Markup for `--into=<page.html>`: blocks go in before `--line`, else before
 * `</body>`, so any page works without a marker; jen skips blocks the page already has.
 */
import { posix } from 'node:path';
import type { Action, Answers, Context } from '@codejen/jen';
import { fail } from './common.ts';
import { template } from './templates.ts';

const BODY_END = /<\/body>/;

/** "confirm-delete" → "Confirm delete": a visible label from a kebab-case id. */
export const sentence = (id: string): string => {
  const text = id.replaceAll('-', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Inserts `blocks` into the page at `into` (a path param: root-relative, `/…`), before line `at` or `</body>`. */
export const intoPage = (into: string, blocks: string[], at: number | null = null): Action[] =>
  blocks.map((line) => ({ insert: into, before: at ?? BODY_END, line }));

/**
 * `--line`: where the markup goes in the `--into` page, or null for before `</body>`.
 * Checked against the page up front, so a bad line changes nothing at all.
 */
export function lineParam(generator: string, { into, line }: Answers, ctx: Context): number | null {
  if (line === '') return null;
  if (!into) fail(`${generator} --line: needs --into=<page.html>, the page the line is in`);
  const n = Number(line);
  if (!Number.isInteger(n) || n < 1) fail(`${generator} --line: "${line}" is not a line number (1 or more)`);
  const text = ctx.read(String(into).replace(/^\//, ''));
  const lines = text === null ? null : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  if (lines !== null && n > lines + 1) fail(`${generator} --line: ${into.replace(/^\//, '')} has ${lines} lines, there is no line ${n}`);
  return n;
}

export const LINE_PARAMS = {
  into: { path: true, default: '' },
  line: { default: '' },
};

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
