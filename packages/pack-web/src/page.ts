/** `web:page`: an HTML page after the HTML boilerplate by Manuel Matuzović (https://matuzo.at/blog/html-boilerplate/). */
import { posix } from 'node:path';
import type { Context, Generator } from '@codejen/jen';
import { findEntry } from './entry.ts';
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
  const css = ctx.grep(/\.css$/, '--color-neutral-1:').map((f) => ctx.read(f) ?? '')[0];
  const shade = (n: number) => new RegExp(`--color-neutral-${n}: (#[0-9a-f]{6});`).exec(css ?? '')?.[1];
  const [light, dark] = [shade(1), shade(6)];
  return light && dark ? [light, dark] : null;
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
  return fill(template('page.html'), {
    lang: escape(o.lang),
    title,
    heading: escape(o.title),
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
  },
  usage: [
    '<main id="main"> starts with just the <h1>; a layout from compositions and blocks, each with its own --help:',
    'header:  <header class="wrapper repel"><a href="/">…</a><nav>…</nav></header>  – jen web:repel --help',
    'sidebar: <div class="wrapper sidebar"><aside>…</aside><main id="main">…</main></div>  – jen web:sidebar --help',
    'grid:    <div class="grid" style="--grid-min-item-size: 10rem"><article class="card">…</article> …</div>  – jen web:grid --help, jen web:card --help',
    'wrapper: class="wrapper" centers each part with room at the sides  – jen web:wrapper --help',
    'jen web:cube writes all of these compositions; a whole dashboard, step by step: https://learosema.github.io/jen/web.html#dashboard',
  ],
  examples: ['--name=about', '--name=about --site="My Site" --lang=en-GB --url=https://example.com'],
  actions: (answers, { kebab }, ctx) => {
    const name = kebab(String(answers.name));
    const file = posix.join(ctx.destDir, `${name}.html`);
    const stylesheet = findEntry(ctx);
    const html = pageHtml(file, {
      title: String(answers.title) || sentence(name),
      site: String(answers.site),
      description: String(answers.description),
      lang: String(answers.lang),
      url: String(answers.url),
      image: String(answers.image),
      imageAlt: String(answers.imageAlt),
      stylesheet,
      script: answers.script ? String(answers.script).replace(/^\//, '') : null,
      icons: iconsIn(ctx, ICONS.map(([icon]) => icon)),
      themeColors: surfaces(ctx),
    });
    const linked = [...(stylesheet ? [stylesheet] : []), ...iconFiles(ctx, ICONS.map(([icon]) => icon))].map((f) => posix.relative(ctx.cwd, f));
    return [
      { add: `${name}.html`, template: html },
      ...(linked.length ? [{ note: `links ${list(linked)}`, file: `${name}.html`, written: true }] : []),
      ...(stylesheet ? [] : [{ note: 'no stylesheet to link yet – run jen web:cube (or web:base) first, then make the page again with --force' }]),
    ];
  },
};

export default pageGenerator;
