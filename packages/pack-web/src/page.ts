/** `web:page`: an HTML page after the HTML boilerplate by Manuel Matuzović (https://matuzo.at/blog/html-boilerplate/). */
import { posix } from 'node:path';
import type { Context, Generator } from '@codejen/jen';
import { findEntry } from './entry.ts';
import { sentence } from './html.ts';
import { fill, template } from './templates.ts';

/** Icon and manifest files a page links to when the project has them (at its root or in public/). */
const ICONS: [string, (href: string) => string][] = [
  ['favicon.ico', (href) => `<link rel="icon" href="${href}" sizes="32x32">`],
  ['favicon.svg', (href) => `<link rel="icon" href="${href}" type="image/svg+xml">`],
  ['apple-touch-icon.png', (href) => `<link rel="apple-touch-icon" href="${href}">`],
  ['manifest.webmanifest', (href) => `<link rel="manifest" href="${href}">`],
];

const escape = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/** `path` (from the project root) as seen from the folder `from`. */
const relativeTo = (from: string, path: string): string => {
  const rel = posix.relative(from, path);
  return rel.startsWith('.') ? rel : `./${rel}`;
};

/** The palette's page background in light and dark mode, if there is a palette. */
function surfaces(ctx: Context): [string, string] | null {
  const css = ctx.grep(/\.css$/, '--color-neutral-1:').map((f) => ctx.read(f) ?? '')[0];
  const shade = (n: number) => new RegExp(`--color-neutral-${n}: (#[0-9a-f]{6});`).exec(css ?? '')?.[1];
  const [light, dark] = [shade(1), shade(6)];
  return light && dark ? [light, dark] : null;
}

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
  const base = o.url.replace(/\/+$/, '');
  const pageUrl = base ? `${base}/${file === 'index.html' ? '' : file}` : null;
  const image = o.image && base ? (/^https?:/.test(o.image) ? o.image : `${base}/${o.image.replace(/^\/+/, '')}`) : null;
  const icons = o.icons.map((icon) => ICONS.find(([name]) => name === posix.basename(icon))![1](relativeTo(dir, icon)));
  return fill(template('page.html'), {
    lang: escape(o.lang),
    title,
    heading: escape(o.title),
    description: escape(o.description),
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
    name: {},
    title: { default: '' },
    site: { default: '' },
    description: { default: 'Page description' },
    lang: { default: 'en' },
    url: { default: '' },
    image: { default: '' },
    imageAlt: { default: '' },
    script: { path: true, default: '' },
  },
  actions: (answers, { kebab }, ctx) => {
    const name = kebab(String(answers.name));
    const file = posix.join(ctx.destDir, `${name}.html`);
    const icons = ICONS.flatMap(([icon]) => [icon, `public/${icon}`]).filter((p) => ctx.exists(p));
    const html = pageHtml(file, {
      title: String(answers.title) || sentence(name),
      site: String(answers.site),
      description: String(answers.description),
      lang: String(answers.lang),
      url: String(answers.url),
      image: String(answers.image),
      imageAlt: String(answers.imageAlt),
      stylesheet: findEntry(ctx),
      script: answers.script ? String(answers.script).replace(/^\//, '') : null,
      icons: icons.map((p) => p.replace(/^public\//, '')),
      themeColors: surfaces(ctx),
    });
    return [{ add: `${name}.html`, template: html }];
  },
};

export default pageGenerator;
