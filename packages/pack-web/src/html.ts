/**
 * Markup for `--into=<page.html>`: blocks go in before `--line`, else before
 * `</body>`, so any page works without a marker; jen skips blocks the page already has.
 */
import type { Action, Answers, Context } from '@codejen/jen';
import { fail } from './common.ts';

const BODY_END = /<\/body>/;
export const HEAD_END = /<\/head>/;

/** "confirm-delete" → "Confirm delete": a visible label from a kebab-case id. */
export const sentence = (id: string): string => {
  const text = id.replaceAll('-', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Inserts `blocks` into the page at `into` (a path param: root-relative, `/…`), before `at` (a line number, text on the line or a RegExp) or `</body>`. */
export const intoPage = (into: string, blocks: string[], at: number | string | RegExp | null = null): Action[] =>
  blocks.map((line) => ({ insert: into, before: at ?? BODY_END, line }));

/** A trigger button before `at` (or `</body>`), and the element it opens always before `</body>` – after the trigger, without `at`. */
export const triggerAndElement = (into: string, [trigger, element]: [string, string], at: number | string | null): Action[] => [
  ...intoPage(into, [trigger], at),
  ...intoPage(into, [element]),
];

/**
 * `--line`: where the markup goes in the `--into` page – a line number, or text on
 * that line (the first line containing it) – or null for before `</body>`.
 * Checked against the page up front, so a bad line changes nothing at all.
 */
export function lineParam(generator: string, { into, line }: Answers, ctx: Context): number | string | null {
  if (line === '') return null;
  if (!into) fail(`${generator} --line: needs --into=<page.html>, the page the line is in`);
  const page = String(into).replace(/^\//, '');
  const text = ctx.read(page);
  if (!/^\s*[-+]?\d+(\.\d*)?\s*$/.test(String(line))) {
    const find = String(line);
    if (text !== null && !text.split('\n').some((l) => l.includes(find))) fail(`${generator} --line: no line in ${page} contains "${find}"`);
    return find;
  }
  const n = Number(line);
  if (!Number.isInteger(n) || n < 1) fail(`${generator} --line: "${line}" is not a line number (1 or more)`);
  const count = text === null ? null : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  if (count !== null && n > count + 1) fail(`${generator} --line: ${page} has ${count} lines, there is no line ${n}`);
  return n;
}

export const LINE_PARAMS = {
  into: { path: true, default: '', description: 'a page to add the markup to, before </body> – only adds, never rewrites' },
  line: { default: '', description: 'with --into: put it before this line instead – a number, or text on that line like </nav>' },
};
