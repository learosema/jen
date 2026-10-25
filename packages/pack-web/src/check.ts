/** `web:check`: what a person or model can't easily see in a project's pages and stylesheets. Writes nothing. */
import { posix } from 'node:path';
import type { Action, AnyGenerator, Context } from '@codejen/jen';
import { BLOCK_NAMES } from './blocks.ts';
import { NAMES as COMPOSITIONS } from './compositions.ts';
import { findEntry, usesTailwind } from './entry.ts';
import { PLACEHOLDERS, placeholdersIn } from './page.ts';
import { claimsFor, rolesFor } from './palette.ts';
import { SCHEMES, WIDTHS, findChrome, renderPages, where } from './render.ts';
import { tokensFrom } from './utilities.ts';

const HTML = /\.html?$/;
const CSS = /\.css$/;
const SCRIPT = /\.(m?[jt]sx?|vue|svelte)$/;

/** Classes jen's own templates set for scripts, not for styling. */
const HOOKS = new Set(['no-js', 'js']);

/** The generator that writes one of pack-web's classes, e.g. `card__media` → `web:card`. */
function generatorFor(cls: string): string | null {
  const block = cls.split(/__|--/)[0];
  if (COMPOSITIONS.includes(block)) return `web:${block}`;
  if (['card', 'avatars', 'button', 'dialog', 'popover', 'theme-toggle', ...BLOCK_NAMES].includes(block)) return `web:${block}`;
  if (block === 'table-scroll') return 'web:table';
  if (['reading-progress', 'reveal'].includes(block)) return 'web:scroll';
  if (['visually-hidden', 'pad-fluid', 'unbreakable'].includes(block)) return `web:${block}`;
  const color = /^(?:color|bg)-([a-z]+)/.exec(cls);
  if (color) return `web:color-classes --name=${color[1]}`;
  if (/^step--?\d$/.test(cls)) return 'web:step-classes';
  if (/^(flow-space|gutter)-/.test(cls)) return 'web:space-classes';
  return null;
}

const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Class names in the selectors of a stylesheet (not in at-rule preludes or declarations). */
function definedClasses(css: string): string[] {
  const pieces = withoutComments(css).split('{');
  pieces.pop();
  return pieces.flatMap((piece) => {
    const prelude = piece.slice(Math.max(piece.lastIndexOf('}'), piece.lastIndexOf(';')) + 1).trim();
    return prelude.startsWith('@') ? [] : [...prelude.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  });
}

/** Each innermost rule's selector and declarations, for the color pairs it sets. */
function rules(css: string): Array<{ selector: string; decls: string[] }> {
  return withoutComments(css)
    .split('}')
    .flatMap((piece) => {
      const open = piece.lastIndexOf('{');
      if (open < 0) return [];
      const head = piece.slice(0, open);
      const selector = head.slice(Math.max(head.lastIndexOf('}'), head.lastIndexOf(';')) + 1).trim();
      return [{ selector, decls: piece.slice(open + 1).split(';').map((d) => d.trim()) }];
    });
}

/** The role token a declaration sets `property` to, e.g. `color: var(--color-text)` → `text`. */
const roleIn = (decls: string[], property: RegExp): string | null => {
  for (const d of decls) {
    const [prop, ...value] = d.split(':');
    if (!property.test(prop.trim())) continue;
    const m = /^var\(--color-([a-z0-9-]+)\)$/.exec(value.join(':').trim());
    if (m) return m[1];
  }
  return null;
};

const quoted = (text: string, pattern: RegExp): string[] => [...text.matchAll(pattern)].map((m) => m[1]);

/** Edit distance, for "did you mean". */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/**
 * A stylesheet path from a page, script or stylesheet, as a file from the project root – null if it's remote, or a
 * package (a bare name in a script import: `open-props/style.css`; in HTML and CSS, that's a relative path).
 */
function resolveCss(ctx: Context, from: string, ref: string, script = false): string | null {
  const path = ref.split(/[?#]/)[0];
  if (/^([a-z]+:)?\/\//i.test(path) || !CSS.test(path)) return null;
  if (path.startsWith('/')) {
    const file = path.slice(1);
    return ctx.exists(`public/${file}`) && !ctx.exists(file) ? `public/${file}` : file;
  }
  if (script && !path.startsWith('.')) return null;
  return posix.normalize(posix.join(posix.dirname(from), path));
}

const IMPORT = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g;
const LINK = /<link\b[^>]*>/gi;
const CLASS_ATTR = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const STYLE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

/** The static checks; `rendered` are --render's findings, `how` says how the pages were rendered. */
export function checkActions(ctx: Context, rendered: Action[] = [], how = ''): Action[] {
  const pages = ctx.grep(HTML);
  const sheets = ctx.grep(CSS);
  const scripts = ctx.grep(SCRIPT);
  const warnings: Action[] = [];
  const warn = (file: string, note: string) => warnings.push({ note, file: `/${file}`, warning: true });
  const notes: Action[] = [];

  // ─── Stylesheets nothing loads, and links to none ─────────────────────────
  const roots: string[] = [];
  for (const page of pages) {
    const html = ctx.read(page) ?? '';
    for (const tag of html.match(LINK) ?? []) {
      if (!/\brel\s*=\s*["']?stylesheet/i.test(tag)) continue;
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      const file = href && resolveCss(ctx, page, href);
      if (!file) continue;
      if (ctx.exists(file)) roots.push(file);
      else warn(page, `links ${href}, which doesn't exist`);
    }
  }
  for (const script of scripts) {
    const js = ctx.read(script) ?? '';
    const refs = [...quoted(js, /\bimport\s*\(?\s*["']([^"'\n]+\.css)["']/g), ...quoted(js, /\bfrom\s*["']([^"'\n]+\.css)["']/g)];
    for (const ref of refs) {
      const file = resolveCss(ctx, script, ref, true);
      if (file && ctx.exists(file)) roots.push(file);
    }
  }
  const entry = findEntry(ctx);
  if (roots.length === 0 && entry) roots.push(entry);
  const reached = new Set<string>();
  for (const queue = [...roots]; queue.length > 0; ) {
    const file = queue.pop()!;
    if (reached.has(file)) continue;
    reached.add(file);
    for (const ref of quoted(ctx.read(file) ?? '', IMPORT)) {
      const imported = resolveCss(ctx, file, ref);
      if (imported && ctx.exists(imported)) queue.push(imported);
    }
  }
  if (roots.length > 0) {
    const via = entry && reached.has(entry) ? `@import it in ${entry}` : 'link or @import it';
    for (const sheet of sheets) if (!reached.has(sheet)) warn(sheet, `isn't linked or imported anywhere – ${via}, or remove it`);
  }

  // ─── Classes no stylesheet defines ────────────────────────────────────────
  const inline = pages.flatMap((p) => quoted(ctx.read(p) ?? '', STYLE));
  const defined = new Set([...sheets.flatMap((s) => definedClasses(ctx.read(s) ?? '')), ...inline.flatMap(definedClasses)]);
  const classLists = pages.flatMap((page) =>
    [...(ctx.read(page) ?? '').matchAll(CLASS_ATTR)].map((m) => ({ page, classes: (m[1] ?? m[2]).split(/\s+/).filter((c) => /^-?[_a-zA-Z][\w-]*$/.test(c)) })),
  );
  if (usesTailwind(ctx)) {
    notes.push({ note: 'Tailwind makes its classes on demand, so classes aren\'t checked' });
  } else {
    const reported = new Set<string>();
    for (const { page, classes } of classLists) {
      for (const cls of classes) {
        if (defined.has(cls) || HOOKS.has(cls) || reported.has(`${page} ${cls}`)) continue;
        reported.add(`${page} ${cls}`);
        const writer = generatorFor(cls);
        const near = [...defined].map((d) => ({ d, n: distance(cls, d) })).filter(({ n }) => n <= 2).sort((a, b) => a.n - b.n)[0]?.d;
        const hint = near ? ` – did you mean .${near}?` : writer ? ` – jen ${writer} writes it` : '';
        warn(page, `uses .${cls}, which no stylesheet defines${hint}`);
      }
    }
  }

  // ─── Placeholder content a layout left ────────────────────────────────────
  for (const page of pages) {
    const html = ctx.read(page) ?? '';
    for (const layout of Object.keys(PLACEHOLDERS)) {
      const left = placeholdersIn(html, layout);
      if (left.length > 0) warn(page, `still has placeholder content from web:page's ${layout} layout: ${left.join(', ')} – replace it with your own`);
    }
  }

  // ─── Color pairs the palette didn't measure ───────────────────────────────
  const { colors, roles } = tokensFrom(...sheets.map((s) => ctx.read(s)));
  if (roles.length > 0) {
    const groups = colors.map((name) => ({ name }));
    const known = new Set(rolesFor(groups, 'aaa').map((r) => r.name));
    const claims = claimsFor(groups, 'aaa');
    const checked = (fg: string, bg: string) => claims.some((c) => c.fg === fg && c.bg === bg);
    const groupOf = (role: string) => colors.filter((c) => role === c || role.startsWith(`${c}-`) || role === `on-${c}`).sort((a, b) => b.length - a.length)[0] ?? 'neutral';
    const instead = (fg: string, bg: string) => {
      const fits = claims.filter((c) => c.bg === bg).map((c) => c.fg);
      const pick = fits.find((f) => groupOf(f) === groupOf(fg)) ?? fits[0];
      return pick ? ` – on --color-${bg}, use --color-${pick}` : '';
    };
    const pair = (file: string, where: string, fg: string | null, bg: string | null) => {
      if (!fg || !bg || !known.has(fg) || !known.has(bg) || checked(fg, bg)) return;
      warn(file, `${where}: --color-${fg} on --color-${bg} isn't a pair the palette checked${instead(fg, bg)}`);
    };
    for (const sheet of sheets) {
      for (const r of rules(ctx.read(sheet) ?? '')) pair(sheet, r.selector, roleIn(r.decls, /^color$/), roleIn(r.decls, /^background(-color)?$/));
    }
    for (const { page, classes } of classLists) {
      const fg = classes.find((c) => c.startsWith('color-'))?.slice(6) ?? null;
      const bg = classes.find((c) => c.startsWith('bg-'))?.slice(3) ?? null;
      pair(page, `class="${classes.join(' ')}"`, fg, bg);
    }
  }

  warnings.push(...rendered);
  const count = warnings.length;
  const summary = `checked ${pages.length} page${pages.length === 1 ? '' : 's'}${how} and ${sheets.length} stylesheet${sheets.length === 1 ? '' : 's'}`;
  return [...warnings, ...notes, { note: count ? `${summary} – ${count} warning${count === 1 ? '' : 's'} (--strict exits with 1 then)` : `${summary} – nothing to fix` }];
}

/** Texts below AA per page, before the rest is only counted. */
const MAX_CONTRAST = 8;

/** `--render`: the static checks, plus what each page shows in Chromium. */
async function renderedActions(ctx: Context): Promise<Action[]> {
  const pages = ctx.grep(HTML);
  const chrome = findChrome();
  if (pages.length === 0) return checkActions(ctx);
  if (!chrome) {
    const note = 'no Chromium found to render the pages – set CHROME to one, or install chromium or google-chrome; the other checks ran';
    return checkActions(ctx, [{ note, warning: true }]);
  }
  let findings;
  try {
    findings = await renderPages(chrome, ctx.root, pages);
  } catch (e) {
    return checkActions(ctx, [{ note: `Chromium (${chrome}) didn't render the pages: ${(e as Error).message}`, warning: true }]);
  }
  const rendered: Action[] = [];
  for (const page of pages) {
    const mine = findings.filter((f) => f.page === page);
    const contrast = mine.filter((f) => f.message.includes('(WCAG AA)'));
    for (const f of [...mine.filter((f) => !contrast.includes(f)), ...contrast.slice(0, MAX_CONTRAST)]) {
      rendered.push({ note: `${f.message}${where(f.runs)}`, file: `/${page}`, warning: true });
    }
    if (contrast.length > MAX_CONTRAST) rendered.push({ note: `and ${contrast.length - MAX_CONTRAST} more texts below WCAG AA contrast`, file: `/${page}`, warning: true });
  }
  return checkActions(ctx, rendered, ` (rendered in ${SCHEMES.join(' and ')}, ${WIDTHS.join(' and ')} wide)`);
}

const checkGenerator: AnyGenerator = {
  description: 'check the pages and stylesheets: classes no stylesheet defines, stylesheets nothing loads, color pairs the palette didn\'t check – writes nothing',
  params: {
    render: {
      default: false,
      description: 'also open each page in headless Chromium ($CHROME or an installed one, never downloaded), light and dark, 390 and 1280 wide: text contrast (WCAG AA), sideways scrolling, console errors, boxes that touch',
    },
  },
  examples: ['', '--render', '--render --strict'],
  actions: (answers, _helpers, ctx) => (answers.render ? renderedActions(ctx) : checkActions(ctx)),
};

export default checkGenerator;
