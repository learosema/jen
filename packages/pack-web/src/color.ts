/**
 * Color math for `web:palette`: sRGB ↔ OKLab/OKLCH (Björn Ottosson's
 * matrices), sRGB gamut mapping by reducing chroma, and WCAG 2 relative
 * luminance / contrast ratios.
 *
 * Shades are placed by luminance, not by OKLCH lightness: every hue's shade n
 * gets the same target luminance, so the contrast between two shades depends
 * only on how far apart they are – across hues, too (the idea behind
 * https://www.reasonable.work/colors/). Contrast is always checked on the
 * final, rounded hex values.
 */
import { fail } from './common.ts';

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

type Rgb = [number, number, number];

/** Number of shades per color. */
export const SHADES = 6;

/**
 * Ratio of (luminance + 0.05) between neighbouring shades. 1.76² ≈ 3.1, so
 * shades 2 apart reach 3:1, 3 apart 4.5:1 (AA) and 4 apart 7:1 (AAA), with a
 * little headroom for rounding to 8-bit hex.
 */
const STEP = 1.76;

/** Target luminance of shade n (1 = lightest … 6 = darkest); shade 1 sits just below white. */
export const targetLuminance = (n: number): number => 1 / STEP ** (n - 1) - 0.05;

/** Contrast every distance between shades guarantees (at least). */
export const DISTANCE_RATIO: Record<number, number> = { 2: 3, 3: 4.5, 4: 7 };

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function linearToOklab([r, g, b]: Rgb): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: Rgb): boolean => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

const luminanceOfLinear = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function hexToOklch(hex: string): Oklch {
  const [L, a, b] = linearToOklab(hexToRgb(hex).map((v) => toLinear(v / 255)) as Rgb);
  const c = Math.hypot(a, b);
  return { l: L, c, h: c < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

function hexToRgb(hex: string): Rgb {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((d) => d + d).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

function linearToHex(rgb: Rgb): string {
  const byte = (v: number) => Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255);
  return `#${rgb.map((v) => byte(v).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG 2 relative luminance of a hex color. */
export function luminance(hex: string): number {
  return luminanceOfLinear(hexToRgb(hex).map((v) => toLinear(v / 255)) as Rgb);
}

/** WCAG 2 contrast ratio between two hex colors (1 … 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The color at lightness `l`, with as much of `c` as fits into sRGB. */
function fitChroma(l: number, c: number, h: number): Rgb {
  let rgb = oklchToLinear({ l, c, h });
  if (inGamut(rgb)) return rgb;
  let lo = 0;
  let hi = c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinear({ l, c: mid, h }))) lo = mid;
    else hi = mid;
  }
  rgb = oklchToLinear({ l, c: lo, h });
  return rgb.map((v) => Math.min(1, Math.max(0, v))) as Rgb;
}

/** The sRGB color of hue `h` and (up to) chroma `c` whose luminance is `y`, as hex. */
export function colorAtLuminance(y: number, c: number, h: number): string {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (luminanceOfLinear(fitChroma(mid, c, h)) < y) lo = mid;
    else hi = mid;
  }
  return linearToHex(fitChroma((lo + hi) / 2, c, h));
}

/**
 * Parses a color flag: `#rgb`, `#rrggbb`, `oklch(L C H)` (L as 0…1 or %), or a
 * bare hue in degrees (`264`), which gets a medium chroma.
 */
export function parseColor(spec: string, flag: string): Oklch {
  const s = spec.trim().toLowerCase();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(s)) return hexToOklch(s);
  if (/^\d+(?:\.\d+)?$/.test(s)) return { l: 0.6, c: 0.15, h: Number(s) % 360 };
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/.exec(s);
  if (m) return { l: Number(m[1]) / (m[2] ? 100 : 1), c: Number(m[3]), h: Number(m[4]) % 360 };
  return fail(`${flag}: "${spec}" is not a color – use #rrggbb, #rgb, oklch(L C H) or a hue in degrees (e.g. 264)`);
}
