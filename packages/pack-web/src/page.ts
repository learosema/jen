/** `web:page`: an HTML page after the HTML boilerplate by Manuel Matuzović (https://matuzo.at/blog/html-boilerplate/). */
import { posix } from 'node:path';
import type { Context, Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { findEntry } from './entry.ts';
import { surfacesIn } from './recolor.ts';
import { sentence } from './html.ts';
import { fill, template } from './templates.ts';

/** Icon and manifest files a page links to when the project has them (at its root or in public/). */
export const ICONS: [string, (href: string) => string][] = [
  ['favicon.ico', (href) => `<link rel="icon" href="${href}" sizes="32x32">`],
  ['favicon.svg', (href) => `<link rel="icon" href="${href}" type="image/svg+xml">`],
  ['apple-touch-icon.png', (href) => `<link rel="apple-touch-icon" href="${href}">`],
  ['manifest.webmanifest', (href) => `<link rel="manifest" href="${href}">`],
];

/** "a", "a and b", "a, b and c". */
const list = (items: string[]): string => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0]);

const escape = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/** `path` (from the project root) as seen from the folder `from`. */
export const relativeTo = (from: string, path: string): string => {
  const rel = posix.relative(from, path);
  return rel.startsWith('.') ? rel : `./${rel}`;
};

/** The palette's page background in light and dark mode, if there is a palette. */
export function surfaces(ctx: Context): [string, string] | null {
  return surfacesIn(ctx.grep(/\.css$/, '--color-neutral-1:').map((f) => ctx.read(f) ?? '')[0] ?? '');
}

/** Which of `names` the project has, at its root or in public/. */
const iconFiles = (ctx: Context, names: string[]): string[] => names.flatMap((icon) => [icon, `public/${icon}`]).filter((p) => ctx.exists(p));

/** The same as the paths they're served at. */
export const iconsIn = (ctx: Context, names: string[]): string[] => iconFiles(ctx, names).map((p) => p.replace(/^public\//, ''));

export interface PageOptions {
  title: string;
  site: string;
  description: string;
  lang: string;
  url: string;
  image: string;
  imageAlt: string;
  /** Root-relative paths of what the page links, or null. */
  stylesheet: string | null;
  script: string | null;
  icons: string[];
  themeColors: [string, string] | null;
  /** One of LAYOUTS: what the <body> holds. */
  layout: string;
  /** Another page's HTML: its <body> instead of the layout's, with <main> down to the <h1>. */
  like?: string;
}

/** Page layouts (templates/layouts/): `none` is the bare <main> with its <h1>. */
export const LAYOUTS = ['none', 'dashboard'];

/**
 * A layout's placeholder content, by element, for web:page's note; web:check looks for the snippets, which
 * real content won't have (none for the nav links: a real site may have just these).
 */
export const PLACEHOLDERS: Record<string, Array<[what: string, snippet: string | null]>> = {
  dashboard: [
    ['the site name', '<a class="site-name" href="index.html">Acme</a>'],
    ['the nav links', null],
    ['the sidebar card', '<p>Last 30 days</p>'],
    ['the 4 stat cards', '<p class="stat__value">12,480</p>'],
    ['the activity list', '<li>Ada signed up – 2 min ago</li>'],
  ],
};

/** A layout's markup, its <body> included; `site` and `heading` are HTML. */
export const layoutMarkup = (layout: string, site: string, heading: string): string => fill(template(`layouts/${layout}.html`), { site, heading }).trimEnd();

/** A placeholder with its text, so it's easy to find: `the sidebar card ("Last 30 days")`. */
const quoted = (what: string, snippet: string | null): string => (snippet ? `${what} ("${snippet.replaceAll(/<[^>]*>/g, '')}")` : what);

/** What of `layout`'s placeholder content `html` still has, by the snippets. */
export const placeholdersIn = (html: string, layout: string): string[] =>
  (PLACEHOLDERS[layout] ?? []).flatMap(([what, snippet]) => (snippet && html.includes(snippet) ? [quoted(what, snippet)] : []));

/**
 * `html`'s <body>, dedented to start at column 0, with <main> holding just the `heading` and
 * aria-current="page" moved to the link for `file` – or null if there's no <body> or <main>.
 */
export function bodyLike(html: string, file: string, heading: string): { body: string; current: boolean } | null {
  const body = /^([ \t]*)<body\b[^>]*>[\s\S]*?<\/body>/m.exec(html);
  if (!body) return null;
  const lines = body[0].split('\n').map((line, i) => (i === 0 ? line.trimStart() : line.startsWith(body[1]) ? line.slice(body[1].length) : line));
  const start = lines.findIndex((l) => /<main\b[^>]*>/.test(l));
  const end = lines.findLastIndex((l) => l.includes('</main>'));
  if (start < 0 || end < start) return null;
  const indent = /^\s*/.exec(lines[start])![0];
  const open = /^\s*(.*?<main\b[^>]*>)/.exec(lines[start])![1];
  const main = [`${indent}${open}`, `${indent}  <h1>${heading}</h1>`, `${indent}</main>`];
  let text = [...lines.slice(0, start), ...main, ...lines.slice(end + 1)].join('\n').replaceAll(/\s+aria-current=(["'])page\1/g, '');
  const name = posix.basename(file).replaceAll('.', '\\.');
  const link = new RegExp(`(<a\\b[^>]*\\bhref=(["'])(?:\\./)?${name}\\2)`);
  const current = link.test(text);
  if (current) text = text.replace(link, '$1 aria-current="page"');
  return { body: text, current };
}

export function pageHtml(file: string, o: PageOptions): string {
  const dir = posix.dirname(file);
  const title = escape(o.site ? `${o.title} – ${o.site}` : o.title);
  let end = o.url.length;
  while (o.url[end - 1] === '/') end--;
  const base = o.url.slice(0, end);
  const pageUrl = base ? `${base}/${file === 'index.html' ? '' : file}` : null;
  const image = o.image && base ? (/^https?:/.test(o.image) ? o.image : `${base}/${o.image.replace(/^\/+/, '')}`) : null;
  const icons = o.icons.map((icon) => ICONS.find(([name]) => name === posix.basename(icon))![1](relativeTo(dir, icon)));
  // placeholder content, like the stats: there to be replaced
  const body = (o.like ?? layoutMarkup(o.layout, escape(o.site || 'Acme'), escape(o.title))).split('\n');
  return fill(template('page.html'), {
    lang: escape(o.lang),
    title,
    'body-attributes': /^<body(.*)>$/.exec(body[0])![1],
    content: body.slice(1, -1).map((line) => line.slice(2)).join('\n'),
    description: o.description ? escape(o.description) : null,
    locale: /^[a-z]{2,3}-[A-Z]{2}$/.test(o.lang) ? o.lang.replace('-', '_') : null,
    stylesheet: o.stylesheet && relativeTo(dir, o.stylesheet),
    url: pageUrl,
    image: image && escape(image),
    'image-alt': image && escape(o.imageAlt),
    'twitter-card': image && 'summary_large_image',
    icons: icons.length ? icons.join('\n') : null,
    'theme-light': o.themeColors?.[0] ?? null,
    'theme-dark': o.themeColors?.[1] ?? null,
    script: o.script && relativeTo(dir, o.script),
  });
}

/** All of a layout's placeholder content – the site name only without --site. */
const placeholders = (layout: string, site: boolean): string[] =>
  (PLACEHOLDERS[layout] ?? []).flatMap(([what, snippet]) => (what !== 'the site name' ? [quoted(what, snippet)] : site ? [] : ['the site name (or use --site)']));

const pageGenerator: Generator = {
  description: 'create an HTML page (after matuzo.at\'s boilerplate), linked to the stylesheet, palette and icons',
  params: {
    name: { description: 'file name: about makes about.html' },
    title: { default: '', description: 'page title (default: from --name, e.g. About)' },
    site: { default: '', description: 'site name, appended to the title: "title – site"' },
    description: { default: '', description: 'for search results and link previews (default: none – they take text from the page)' },
    lang: { default: 'en', description: 'page language; with a region (en-GB), it also sets og:locale' },
    url: { default: '', description: 'the site\'s address, for link previews' },
    image: { default: '', description: 'image that link previews show' },
    imageAlt: { default: '', description: 'alt text for --image' },
    script: { path: true, default: '', description: 'a module script to load at the end of the body' },
    like: { path: true, default: '', description: 'an existing page to take the <body> from – its header, nav and sidebar, with <main> down to the <h1>' },
    layout: {
      default: 'none',
      choices: LAYOUTS,
      description: 'what the body holds (dashboard: header, sidebar, stat cards, a button and an activity list to fill in)',
    },
  },
  usage: [
    '<main id="main"> holds just the <h1>; --layout=dashboard writes a whole dashboard (its markup: jen --find dashboard)',
    'a second page in the same style: --like=index.html takes that page\'s header, nav and sidebar',
    'a layout of your own, from compositions and blocks:',
    'body:    <body class="flow"> puts space between the header and what follows  – jen web:flow --help',
    'header:  <header class="wrapper repel"><a href="index.html">…</a><nav>…</nav></header>  – jen web:repel --help',
    'sidebar: <div class="wrapper sidebar"><aside>…</aside><main id="main" class="flow">…</main></div>  – jen web:sidebar --help',
    'grid:    <div class="grid" style="--grid-min-item-size: 10rem"><article class="card">…</article> …</div>  – jen web:grid --help, jen web:card --help',
    'wrapper: class="wrapper" centers each part with room at the sides  – jen web:wrapper --help',
    'jen web:cube writes all of these compositions',
  ],
  examples: [
    '--name=about',
    '--name=about --site="My Site" --lang=en-GB --url=https://example.com',
    '--name=index --title=Dashboard --site=Acme --layout=dashboard',
    '--name=settings --like=index.html',
  ],
  actions: (answers, { kebab }, ctx) => {
    const name = kebab(String(answers.name));
    const file = posix.join(ctx.destDir, `${name}.html`);
    const stylesheet = findEntry(ctx);
    const title = String(answers.title) || sentence(name);
    const likePath = String(answers.like).replace(/^\//, '');
    let like: ReturnType<typeof bodyLike> = null;
    let site = String(answers.site);
    if (likePath) {
      if (answers.layout !== 'none') fail('web:page: --like takes the body from that page, --layout from a layout – use one of them');
      const source = ctx.read(likePath) ?? fail(`web:page --like: there's no ${posix.relative(ctx.cwd, likePath)}`);
      like = bodyLike(source, file, escape(title)) ?? fail(`web:page --like: ${posix.relative(ctx.cwd, likePath)} has no <body> with a <main> to take`);
      // the site name from its title, "Page – Site", unless --site says otherwise
      site ||= /<title>[^<]*? – ([^<]+)<\/title>/.exec(source)?.[1].replaceAll('&amp;', '&') ?? '';
    }
    const html = pageHtml(file, {
      title,
      site,
      description: String(answers.description),
      lang: String(answers.lang),
      url: String(answers.url),
      image: String(answers.image),
      imageAlt: String(answers.imageAlt),
      stylesheet,
      script: answers.script ? String(answers.script).replace(/^\//, '') : null,
      icons: iconsIn(ctx, ICONS.map(([icon]) => icon)),
      themeColors: surfaces(ctx),
      layout: String(answers.layout),
      ...(like && { like: like.body }),
    });
    const from = likePath && posix.relative(ctx.cwd, likePath);
    const linked = [...(stylesheet ? [stylesheet] : []), ...iconFiles(ctx, ICONS.map(([icon]) => icon))].map((f) => posix.relative(ctx.cwd, f));
    return [
      { add: `${name}.html`, template: html },
      ...(linked.length ? [{ note: `links ${list(linked)} by relative paths – works from file://`, file: `${name}.html`, written: true }] : []),
      ...(stylesheet ? [] : [{ note: 'no stylesheet to link yet – run jen web:cube (or web:base) first, then make the page again with --force' }]),
      ...(like
        ? [
            {
              note: `has ${from}'s header, nav and sidebar; <main> holds just the <h1> – add your content${like.current ? '' : `; no nav link points to ${name}.html yet – add one on both pages`}`,
              file: `${name}.html`,
              written: true as const,
            },
          ]
        : []),
      ...(answers.layout === 'none'
        ? []
        : [
            {
              note: `has placeholder content from the ${answers.layout} layout – replace ${list(placeholders(String(answers.layout), Boolean(answers.site)))}; then jen web:check finds what's left and classes no stylesheet defines`,
              file: `${name}.html`,
              written: true as const,
            },
          ]),
    ];
  },
};

export default pageGenerator;
