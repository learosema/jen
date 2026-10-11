/** `web:sw`: a service worker with the caching strategies of Jake Archibald's Offline Cookbook (https://web.dev/articles/offline-cookbook). */
import { posix } from 'node:path';
import type { Action, Context, Generator } from '@codejen/jen';
import { TYPES_PARAM, type Types, ext, importExt, stripTypes, typesFor } from '@codejen/jen';
import { fail } from './common.ts';
import { findEntry } from './entry.ts';
import { ICONS, iconsIn, pageHtml, relativeTo, surfaces } from './page.ts';
import { packageName, publicDir, served, servedPath, usesVite } from './platform.ts';
import { fill, template } from './templates.ts';

export const FILE = 'sw.js';
export const OFFLINE = 'offline.html';
export const REGISTER = 'register-sw';

const STRATEGIES: Record<string, string> = { 'cache-first': 'sw/cache-first.js', swr: 'sw/stale-while-revalidate.js' };

const quote = (s: string): string => `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

/** A URL for the service worker's cache, relative to it: `index.html` is cached as its folder, which is what navigations ask for. */
const cacheUrl = (from: string, path: string): string => {
  const url = relativeTo(from, path);
  return posix.basename(url) === 'index.html' ? url.slice(0, -'index.html'.length) : url;
};

/** `--precache`, else the pages next to the service worker and (unless a bundler builds it) the entry stylesheet with its imports. */
function precacheList(given: string, ctx: Context, swDir: string, vite: boolean): string[] {
  if (given) {
    return given
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => (/^(\.{0,2}\/|[a-z]+:)/.test(f) ? f : `./${f}`));
  }
  const pagesDir = publicDir(ctx) ? '.' : swDir;
  const pages = ctx
    .readdir(pagesDir)
    .filter((f) => f.endsWith('.html') && f !== OFFLINE)
    .map((f) => cacheUrl(publicDir(ctx) ? '.' : swDir, posix.join(pagesDir, f)));
  const entry = vite ? null : findEntry(ctx);
  return [...pages, ...(entry ? stylesheets(ctx, entry).map((f) => relativeTo(swDir, f)) : [])];
}

/** A stylesheet and the local ones it imports, all the way down. */
function stylesheets(ctx: Context, file: string, seen = new Set<string>()): string[] {
  if (seen.has(file) || !ctx.exists(file)) return [];
  seen.add(file);
  const imports = [...(ctx.read(file) ?? '').matchAll(/@import\s+(?:url\()?["'](\.{1,2}\/[^"']+)["']/g)].map((m) => posix.join(posix.dirname(file), m[1]));
  return [file, ...imports.flatMap((f) => stylesheets(ctx, f, seen))];
}

/** The register module in the project's style. */
function registerSource(types: Types, url: string, when: string): string {
  const text = types === 'ts' ? template(`sw/${REGISTER}.ts.tmpl`) : template(`sw/${REGISTER}.js.tmpl`);
  return fill(types === 'none' ? stripTypes(text) : text, { url, when });
}

/** The register module loaded from the `--into` page (a script tag) or module (an import line). */
function wire(into: string, file: string, ctx: Context, extension: string): Action[] {
  const path = relativeTo(posix.dirname(into.slice(1)), posix.join(ctx.destDir, file));
  if (into.endsWith('.html')) return [{ insert: into, before: /<\/body>/, line: `<script type="module" src="${path}"></script>` }];
  return [{ insert: into, before: /^(?!\s*(\/\/|\/\*|\*|$))/, line: `import '${path.replace(/\.[jt]s$/, extension)}';` }];
}

const swGenerator: Generator = {
  description: 'create a service worker (network-first pages, cached assets, an offline page) and a module that registers it',
  params: {
    precache: { default: '' },
    strategy: { default: 'cache-first' },
    offline: { default: false },
    into: { path: true, default: '' },
    ...TYPES_PARAM,
  },
  actions: (answers, { kebab }, ctx) => {
    const strategy = String(answers.strategy);
    if (!(strategy in STRATEGIES)) fail(`web:sw --strategy: expected cache-first or swr, got "${strategy}"`);
    const types = typesFor('web:sw', answers, ctx);
    const vite = usesVite(ctx);
    const pub = publicDir(ctx);
    const sw = served(ctx, FILE);
    const swDir = posix.dirname(sw.path);
    const offline = Boolean(answers.offline);
    const actions: Action[] = [];

    const precache = precacheList(String(answers.precache), ctx, swDir, vite);
    if (offline) {
      const page = served(ctx, OFFLINE);
      const file = servedPath(ctx, page.path);
      actions.push({
        add: page.add,
        template: pageHtml(file, {
          title: 'Offline',
          site: '',
          description: 'You are offline. This page comes back once you are connected again.',
          lang: 'en',
          url: '',
          image: '',
          imageAlt: '',
          stylesheet: pub ? null : findEntry(ctx),
          script: null,
          icons: iconsIn(ctx, ICONS.map(([icon]) => icon)),
          themeColors: surfaces(ctx),
        }),
      });
      precache.push(`./${OFFLINE}`);
    }

    actions.unshift({
      add: sw.add,
      template: fill(template('sw/sw.js.tmpl'), {
        cache: kebab(packageName(ctx) ?? 'site'),
        offline: offline ? quote(`./${OFFLINE}`) : 'null',
        precache: [...new Set(precache)].map((url) => `${quote(url)},`).join('\n'),
        assets: template(STRATEGIES[strategy]).trimEnd(),
      }),
    });

    const register = `${REGISTER}${ext(types)}`;
    const url = pub
      ? vite
        ? '`${import.meta.env.BASE_URL}' + FILE + '`'
        : quote(`/${FILE}`)
      : `new URL(${quote(relativeTo(ctx.destDir, sw.path))}, import.meta.url)`;
    const when = vite ? "import.meta.env.PROD && 'serviceWorker' in navigator" : "'serviceWorker' in navigator";
    actions.push({ add: register, template: registerSource(types, url, when) });

    const into = String(answers.into);
    if (into) actions.push(...wire(into, register, ctx, importExt(ctx, types)));
    return actions;
  },
};

export default swGenerator;
