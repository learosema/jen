/** `web:manifest`: a web app manifest, after MDN's reference (https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest). */
import { posix } from 'node:path';
import type { Action, Context, Generator } from '@codejen/jen';
import { oklchToHex, parseColor } from './color.ts';
import { fail } from './common.ts';
import { HEAD_END, intoPage } from './html.ts';
import { iconsIn, relativeTo, surfaces } from './page.ts';
import { served, servedPath } from './platform.ts';
import { roleIn } from './recolor.ts';
import { PNG_ICONS, appleTouchIcon, nestedSvg, renderPngs } from './png.ts';
import { fill, template } from './templates.ts';

export const FILE = 'manifest.webmanifest';
export const MASKABLE = 'icon-maskable.svg';

const DISPLAY = ['fullscreen', 'standalone', 'minimal-ui', 'browser'];

/** Languages written right to left, by their primary subtag. */
const RTL = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'ha', 'he', 'khw', 'ks', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi']);

const NEUTRAL = '#ffffff';

/** A color role of the palette (`primary`, `surface`) in light mode, as hex; null without a palette. */
export function paletteColor(ctx: Context, role: string): string | null {
  const css = ctx.grep(/\.css$/, `--color-${role}:`).map((f) => ctx.read(f) ?? '')[0];
  return css ? roleIn(css, role) : null;
}

/** A color flag as hex: manifest colors need wide browser support. */
export function hexColor(spec: string, flag: string): string {
  const s = spec.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${[...s.slice(1)].map((d) => d + d).join('')}`;
  return oklchToHex(parseColor(s, flag));
}

/** favicon.svg inside a full-bleed background, scaled into the square that fits the safe zone of a maskable icon. */
export const maskableSvg = (svg: string, background: string): string =>
  fill(template(MASKABLE), { background, icon: nestedSvg(svg, 21.7, 56.6) });

const manifestGenerator: Generator = {
  description: 'create a web app manifest with the palette\'s colors and the icons the project has (--into links it from a page)',
  params: {
    name: { description: 'the app name the install prompt shows' },
    shortName: { default: '', description: 'name under the icon (default: the name, or its first word if it is longer than 12 characters)' },
    display: { default: 'standalone', choices: DISPLAY, description: 'how the installed app shows' },
    themeColor: { default: '', description: 'browser toolbar color: any CSS color or a hue (default: the palette\'s primary, else white)' },
    backgroundColor: { default: '', description: 'splash screen color: any CSS color or a hue (default: the palette\'s surface, else white)' },
    lang: { default: 'en', description: 'app language; also sets the text direction (rtl for Arabic, Hebrew, …)' },
    png: { default: false, description: 'also render PNG icons from favicon.svg, with rsvg-convert or ImageMagick' },
    into: { path: true, default: '', description: 'a page to link the manifest from (with --png, also the apple-touch icon) – only adds to it' },
  },
  examples: ['--name="My Site" --into=index.html', '--name="My Site" --display=minimal-ui --png --into=index.html'],
  actions: (answers, _helpers, ctx) => {
    const name = String(answers.name).trim();
    if (!name) fail('web:manifest --name: the app needs a name');
    const display = String(answers.display);
    if (!DISPLAY.includes(display)) fail(`web:manifest --display: expected ${DISPLAY.join(', ')}, got "${display}"`);
    const lang = String(answers.lang);
    const themeColor = answers.themeColor ? hexColor(String(answers.themeColor), '--themeColor') : (paletteColor(ctx, 'primary') ?? NEUTRAL);
    const backgroundColor = answers.backgroundColor
      ? hexColor(String(answers.backgroundColor), '--backgroundColor')
      : (paletteColor(ctx, 'surface') ?? NEUTRAL);

    const manifest = served(ctx, FILE);
    const from = posix.dirname(servedPath(ctx, manifest.path));
    const icon = (path: string, type: string, sizes: string, purpose: string) => ({ src: posix.relative(from, path), type, sizes, purpose });

    const actions: Action[] = [];
    const icons = [];
    const svg = iconsIn(ctx, ['favicon.svg'])[0];
    const source = ctx.exists('public/favicon.svg') ? 'public/favicon.svg' : 'favicon.svg';
    const png = Boolean(answers.png);
    if (png && !svg) fail('web:manifest --png: renders the PNGs from favicon.svg, and there is none at the root or in public/');
    if (svg) {
      icons.push(icon(svg, 'image/svg+xml', 'any', 'any'));
      actions.push({ add: `/${posix.join(posix.dirname(source), MASKABLE)}`, template: maskableSvg(ctx.read(source) ?? '', backgroundColor) });
      icons.push(icon(posix.join(posix.dirname(svg), MASKABLE), 'image/svg+xml', 'any', 'maskable'));
    }
    if (png) {
      const apple = appleTouchIcon(backgroundColor);
      for (const [file, bytes] of renderPngs(ctx.read(source) ?? '', [...PNG_ICONS, apple])) {
        actions.push({ add: `/${posix.join(posix.dirname(source), file)}`, bytes });
      }
    }
    for (const { file, size } of PNG_ICONS) {
      const path = png ? posix.join(posix.dirname(svg), file) : iconsIn(ctx, [file])[0];
      if (path) icons.push(icon(path, 'image/png', `${size}x${size}`, 'any'));
    }

    const shortName = String(answers.shortName) || (name.length <= 12 ? name : name.split(/\s+/)[0].slice(0, 12));
    const json = {
      name,
      short_name: shortName,
      start_url: './',
      scope: './',
      display,
      theme_color: themeColor,
      background_color: backgroundColor,
      icons,
      lang,
      dir: RTL.has(lang.split('-')[0].toLowerCase()) ? 'rtl' : 'ltr',
    };
    actions.unshift({ add: manifest.add, template: `${JSON.stringify(json, null, 2)}\n` });

    const into = String(answers.into);
    if (into) {
      const page = posix.dirname(into.replace(/^\//, ''));
      const schemes = answers.themeColor ? null : surfaces(ctx);
      const metas = schemes
        ? [
            `<meta name="theme-color" content="${schemes[0]}" media="(prefers-color-scheme: light)">`,
            `<meta name="theme-color" content="${schemes[1]}" media="(prefers-color-scheme: dark)">`,
          ]
        : [`<meta name="theme-color" content="${themeColor}">`];
      const appleLink = png ? [`<link rel="apple-touch-icon" href="${relativeTo(page, posix.join(posix.dirname(svg), 'apple-touch-icon.png'))}">`] : [];
      actions.push(...intoPage(into, [...appleLink, `<link rel="manifest" href="${relativeTo(page, servedPath(ctx, manifest.path))}">`, ...metas], HEAD_END));
    }
    return actions;
  },
};

export default manifestGenerator;
