/**
 * Color math for web:palette: OKLab/OKLCH by Björn Ottosson (https://bottosson.github.io/posts/oklab/)
 * and WCAG 2 contrast. Shades are placed by luminance, so contrast depends only on their distance.
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

/** OKLab as OKLCH; gray gets hue 0. */
function oklabToOklch(l: number, a: number, b: number): Oklch {
  const c = Math.hypot(a, b);
  return { l, c, h: c < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

const linearToOklch = (rgb: Rgb): Oklch => oklabToOklch(...linearToOklab(rgb));

export const hexToOklch = (hex: string): Oklch => linearToOklch(hexToRgb(hex).map((v) => toLinear(v / 255)) as Rgb);

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

/** An OKLCH color as sRGB hex, its chroma reduced until it fits. */
export const oklchToHex = ({ l, c, h }: Oklch): string => linearToHex(fitChroma(l, c, h));

/** CSS named colors (CSS Color Module Level 4), as 6-digit hex without `#`. */
const NAMED = Object.fromEntries(
  `aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000
  blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00
  chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b
  darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b
  darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a
  darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1
  darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff
  firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff
  gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0
  hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5
  lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff
  lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1
  lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899
  lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000
  mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371
  mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585
  midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080
  oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa
  palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f
  pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f
  royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee
  sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa
  springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0
  violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32`
    .split(/\s+/)
    .flatMap((w, i, all) => (i % 2 ? [] : [[w, all[i + 1]]])),
) as Record<string, string>;

type Matrix = [Rgb, Rgb, Rgb];
const mul = (m: Matrix, v: Rgb): Rgb => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as Rgb;

// Conversion matrices from CSS Color Module Level 4 (https://www.w3.org/TR/css-color-4/#color-conversion-code)
const XYZ_TO_SRGB: Matrix = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const P3_TO_XYZ: Matrix = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
];
/** Bradford chromatic adaptation, D50 to D65. */
const D50_TO_D65: Matrix = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
];
const D50_WHITE: Rgb = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

/** Gamma-encoded sRGB (0…1 each) to linear. */
const srgb = (rgb: Rgb): Rgb => rgb.map(toLinear) as Rgb;

/** CIE Lab (D50) to linear sRGB, possibly out of gamut. */
function labToLinear(L: number, a: number, b: number): Rgb {
  const k = 24389 / 27;
  const e = 216 / 24389;
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const xyz = [
    fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k,
    L > k * e ? fy ** 3 : L / k,
    fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k,
  ].map((v, i) => v * D50_WHITE[i]) as Rgb;
  return mul(XYZ_TO_SRGB, mul(D50_TO_D65, xyz));
}

/** HSL (h in degrees, s and l 0…1) to gamma-encoded sRGB. */
function hslToRgb(h: number, s: number, l: number): Rgb {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function hwbToRgb(h: number, w: number, b: number): Rgb {
  if (w + b >= 1) return [w / (w + b), w / (w + b), w / (w + b)];
  return hslToRgb(h, 1, 0.5).map((v) => v * (1 - w - b) + w) as Rgb;
}

const HUE_UNITS: Record<string, number> = { '': 1, deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

/** A hue in degrees, from `264`, `264deg`, `0.5turn`, `3rad` or `400grad`; null if it isn't one. */
function hue(arg: string): number | null {
  const m = /^(-?[\d.]+(?:e-?\d+)?)(deg|grad|rad|turn)?$/.exec(arg);
  if (!m || Number.isNaN(Number(m[1]))) return null;
  return (((Number(m[1]) * HUE_UNITS[m[2] ?? '']) % 360) + 360) % 360;
}

/**
 * A number, or a percentage scaled so 100% is `full`; `none` is 0. Null if it's
 * neither. Without `full`, a percentage isn't allowed.
 */
function amount(arg: string, full?: number): number | null {
  if (arg === 'none') return 0;
  const m = /^(-?[\d.]+(?:e-?\d+)?)(%?)$/.exec(arg);
  if (!m || Number.isNaN(Number(m[1])) || (m[2] && full === undefined)) return null;
  return m[2] ? (Number(m[1]) / 100) * full! : Number(m[1]);
}

/** Each color function: its arguments (alpha already removed) as OKLCH, or null if they don't fit. */
const FUNCTIONS: Record<string, (args: string[]) => Oklch | null> = {
  rgb: (args) => {
    const v = args.map((a) => amount(a, 255));
    return args.length === 3 && v.every((n) => n !== null) ? linearToOklch(srgb(v.map((n) => n! / 255) as Rgb)) : null;
  },
  hsl: ([h, s, l, ...rest]) => {
    const v = [hue(h ?? ''), amount(s ?? '', 100), amount(l ?? '', 100)];
    return rest.length === 0 && v.every((n) => n !== null) ? linearToOklch(srgb(hslToRgb(v[0]!, v[1]! / 100, v[2]! / 100))) : null;
  },
  hwb: ([h, w, b, ...rest]) => {
    const v = [hue(h ?? ''), amount(w ?? '', 100), amount(b ?? '', 100)];
    return rest.length === 0 && v.every((n) => n !== null) ? linearToOklch(srgb(hwbToRgb(v[0]!, v[1]! / 100, v[2]! / 100))) : null;
  },
  lab: ([L, a, b, ...rest]) => {
    const v = [amount(L ?? '', 100), amount(a ?? '', 125), amount(b ?? '', 125)];
    return rest.length === 0 && v.every((n) => n !== null) ? linearToOklch(labToLinear(v[0]!, v[1]!, v[2]!)) : null;
  },
  lch: ([L, C, H, ...rest]) => {
    const v = [amount(L ?? '', 100), amount(C ?? '', 150), hue(H ?? '')];
    if (rest.length > 0 || !v.every((n) => n !== null)) return null;
    const rad = (v[2]! * Math.PI) / 180;
    return linearToOklch(labToLinear(v[0]!, v[1]! * Math.cos(rad), v[1]! * Math.sin(rad)));
  },
  oklab: ([L, a, b, ...rest]) => {
    const v = [amount(L ?? '', 1), amount(a ?? '', 0.4), amount(b ?? '', 0.4)];
    return rest.length === 0 && v.every((n) => n !== null) ? oklabToOklch(v[0]!, v[1]!, v[2]!) : null;
  },
  oklch: ([L, C, H, ...rest]) => {
    const v = [amount(L ?? '', 1), amount(C ?? '', 0.4), hue(H ?? '')];
    return rest.length === 0 && v.every((n) => n !== null) ? { l: v[0]!, c: v[1]!, h: v[2]! } : null;
  },
  color: ([space, ...args]) => {
    const v = args.map((a) => amount(a, 1));
    if (args.length !== 3 || !v.every((n) => n !== null)) return null;
    const rgb = v as Rgb;
    switch (space) {
      case 'srgb':
        return linearToOklch(srgb(rgb));
      case 'srgb-linear':
        return linearToOklch(rgb);
      case 'display-p3':
        return linearToOklch(mul(XYZ_TO_SRGB, mul(P3_TO_XYZ, srgb(rgb))));
      case 'xyz':
      case 'xyz-d65':
        return linearToOklch(mul(XYZ_TO_SRGB, rgb));
      case 'xyz-d50':
        return linearToOklch(mul(XYZ_TO_SRGB, mul(D50_TO_D65, rgb)));
      default:
        return null;
    }
  },
};
FUNCTIONS.rgba = FUNCTIONS.rgb;
FUNCTIONS.hsla = FUNCTIONS.hsl;

/** A CSS color function call, e.g. `rgb(255 51 119 / 50%)` or `hsla(340, 100%, 60%, .5)`, as OKLCH; null if it isn't one. Alpha is ignored. */
function parseFunction(s: string): Oklch | null {
  const m = /^([a-z]+)\((.*)\)$/.exec(s);
  const fn = m && FUNCTIONS[m[1]];
  if (!fn) return null;
  // legacy commas and the modern spaces both work; alpha comes after "/" or as a fourth value
  const args = m[2].split('/')[0].trim().split(/\s*,\s*|\s+/).filter(Boolean);
  const legacyAlpha = m[2].includes(',') && args.length === (m[1] === 'color' ? 5 : 4);
  return fn(legacyAlpha ? args.slice(0, -1) : args);
}

/** `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` as `#rrggbb`; null if it isn't one. */
function opaqueHex(s: string): string | null {
  if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(s)) return null;
  const h = s.length <= 5 ? [...s.slice(1, 4)].map((d) => d + d).join('') : s.slice(1, 7);
  return `#${h}`;
}

/**
 * Parses a color flag: any CSS color – a name (`deeppink`), hex (`#f37`,
 * `#ff3377`), `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`,
 * `oklch()` or `color()` – or a bare hue in degrees (`264`), which gets a
 * medium chroma. Alpha is ignored: palette colors are opaque.
 */
export function parseColor(spec: string, flag: string): Oklch {
  const s = spec.trim().toLowerCase();
  const hex = opaqueHex(s) ?? (NAMED[s] ? `#${NAMED[s]}` : null);
  if (hex) return hexToOklch(hex);
  const h = hue(s);
  if (h !== null) return { l: 0.6, c: 0.15, h };
  const parsed = parseFunction(s);
  if (parsed) return parsed;
  return fail(
    `${flag}: can't read "${spec}" as a color. Any CSS color works – deeppink, #f37, #ff3377, rgb(255 51 119), ` +
      'hsl(340 100% 60%), oklch(0.65 0.24 5) – or a hue in degrees, like 264.',
  );
}
