/** `web:manifest --png`: PNG icons from favicon.svg, rendered by rsvg-convert or ImageMagick – whichever is installed. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fail } from './common.ts';

export interface PngIcon {
  file: string;
  size: number;
  /** A background filling the square, with the icon inset by this share of the size on each side; null for a transparent icon edge to edge. */
  frame: { background: string; inset: number } | null;
}

/** The set after Andrey Sitnik's How to Favicon (https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs). */
export const PNG_ICONS: PngIcon[] = [
  { file: 'icon-192.png', size: 192, frame: null },
  { file: 'icon-512.png', size: 512, frame: null },
];

/** iOS fills transparent corners with black, so the home screen icon gets the background and some room. */
export const appleTouchIcon = (background: string): PngIcon => ({ file: 'apple-touch-icon.png', size: 180, frame: { background, inset: 20 / 180 } });

/** favicon.svg's root element as a nested `<svg>` at x/y with width and height `size`, in a 0–100 viewBox. */
export function nestedSvg(svg: string, offset: number, size: number): string {
  const body = svg.slice(Math.max(0, svg.indexOf('<svg'))).trim();
  const open = /^<svg\b[^>]*>/.exec(body)?.[0] ?? fail('web:manifest: favicon.svg has no <svg> element');
  const attr = (name: string) => new RegExp(`\\s${name}=(["'])(.*?)\\1`).exec(open)?.[2];
  const [width, height] = [attr('width'), attr('height')].map((v) => (v ? parseFloat(v) : NaN));
  let tag = open.replace(/\s(width|height|x|y)=(["']).*?\2/g, '');
  if (!attr('viewBox') && width > 0 && height > 0) tag = tag.replace(/^<svg/, `<svg viewBox="0 0 ${width} ${height}"`);
  tag = tag.replace(/^<svg/, `<svg x="${offset}" y="${offset}" width="${size}" height="${size}"`);
  return tag + body.slice(open.length);
}

/** The SVG a PNG icon is rendered from: `size` pixels square, framed if the icon asks for it. */
export function iconSvg(favicon: string, { size, frame }: PngIcon): string {
  const inset = frame ? +(frame.inset * 100).toFixed(1) : 0;
  const rect = frame ? `<rect width="100" height="100" fill="${frame.background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${rect}${nestedSvg(favicon, inset, 100 - 2 * inset)}</svg>\n`;
}

type Converter = { name: string; args: (svg: string, png: string, size: number) => string[] };

const CONVERTERS: Converter[] = [
  { name: 'rsvg-convert', args: (svg, png, size) => ['-w', String(size), '-h', String(size), '-o', png, svg] },
  // Rendered at 4× and scaled down, so ImageMagick's own SVG renderer antialiases well too.
  { name: 'magick', args: (svg, png, size) => ['-background', 'none', '-density', '384', svg, '-resize', `${size}x${size}`, png] },
  // ImageMagick 6; on Windows, `convert` is a system tool for something else.
  ...(process.platform === 'win32' ? [] : [{ name: 'convert', args: (svg: string, png: string, size: number) => ['-background', 'none', '-density', '384', svg, '-resize', `${size}x${size}`, png] }]),
];

/** The first converter on the PATH, or null. */
export function findConverter(): Converter | null {
  return CONVERTERS.find(({ name }) => !spawnSync(name, ['--version'], { stdio: 'ignore' }).error) ?? null;
}

/** Renders each icon from favicon.svg into PNG bytes, in a throwaway directory. */
export function renderPngs(favicon: string, icons: PngIcon[]): Map<string, Uint8Array> {
  const converter = findConverter() ?? fail('web:manifest --png: needs rsvg-convert (librsvg) or ImageMagick (magick) on the PATH – or leave out --png and add the PNGs yourself');
  const dir = mkdtempSync(join(tmpdir(), 'jen-png-'));
  try {
    return new Map(
      icons.map((icon) => {
        const [svg, png] = [join(dir, `${icon.file}.svg`), join(dir, icon.file)];
        writeFileSync(svg, iconSvg(favicon, icon));
        const run = spawnSync(converter.name, converter.args(svg, png, icon.size), { encoding: 'utf8' });
        if (run.status !== 0) fail(`web:manifest --png: ${converter.name} failed on ${icon.file}: ${(run.stderr || run.error?.message || '').trim()}`);
        return [icon.file, new Uint8Array(readFileSync(png))];
      }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
