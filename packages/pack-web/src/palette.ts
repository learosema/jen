/** `web:palette`: a contrast-checked palette; shade distances after Reasonable Colors by Matthew Howell (https://www.reasonable.work/colors/). */
import type { Answers, Generator, Params } from '@codejen/jen';
import { DISTANCE_RATIO, SHADES, colorAtLuminance, contrast, parseColor, targetLuminance } from './color.ts';
import type { Oklch } from './color.ts';
import { fail } from './common.ts';
import { importActions, usesTailwind } from './entry.ts';

export const FILE = 'palette.css';

/** Share of a color's chroma each shade keeps: muted at the light and dark ends, where shades serve as surfaces and text. */
const CHROMA_CURVE = [0.3, 0.6, 0.9, 1, 0.85, 0.6];

/** Neutral gray: tinted toward the primary hue, at most this much chroma. */
const NEUTRAL_CHROMA = 0.012;

export const BRAND = ['primary', 'secondary', 'tertiary'] as const;
export const STATUS: Record<string, string> = {
  success: 'oklch(0.6 0.15 150)',
  warning: 'oklch(0.75 0.15 75)',
  danger: 'oklch(0.58 0.2 27)',
  info: 'oklch(0.6 0.13 240)',
};

export type Level = 'aa' | 'aaa';
const LEVEL_RATIO: Record<Level, number> = { aa: 4.5, aaa: 7 };
/** WCAG large text: at least 24px, or 18.66px bold (1.5rem / 1.1667rem at the default font size). */
const LARGE_RATIO: Record<Level, number> = { aa: 3, aaa: 4.5 };

/**
 * Where tinted backgrounds (-subtle, surface-2) sit: between shades, so they
 * stand out from the page yet keep text on them at the full level.
 */
export const TINT = { light: 1.4, dark: 5.6 };

/** A role token: the shade it uses in light and in dark mode (a fraction: a tint, see TINT). */
interface Role {
  name: string;
  group: string;
  light: number;
  dark: number;
}

export interface Group {
  name: string;
  shades: string[];
  /** Colors between shades, by position (TINT). */
  tints: Record<number, string>;
}

/** CHROMA_CURVE at shade `n`, interpolated between shades. */
function curve(n: number): number {
  const i = Math.min(Math.max(Math.floor(n), 1), SHADES - 1);
  return CHROMA_CURVE[i - 1] + (CHROMA_CURVE[i] - CHROMA_CURVE[i - 1]) * (n - i);
}

export function groupFor(name: string, { c, h }: Oklch, chroma: (n: number) => number = (n) => c * curve(n)): Group {
  const at = (n: number) => colorAtLuminance(targetLuminance(n), chroma(n), h);
  return {
    name,
    shades: Array.from({ length: SHADES }, (_, i) => at(i + 1)),
    tints: Object.fromEntries(Object.values(TINT).map((n) => [n, at(n)])),
  };
}

/** The palette's colors: brand colors given, neutral, then status colors. */
export function groupsFor(answers: Answers): Group[] {
  const groups: Group[] = [];
  const primary = parseColor(String(answers.primary), '--primary');
  for (const name of BRAND) {
    const given = String(answers[name] ?? '');
    if (given) groups.push(groupFor(name, parseColor(given, `--${name}`)));
  }
  const neutralGiven = String(answers.neutral ?? '');
  const neutral = neutralGiven ? parseColor(neutralGiven, '--neutral') : primary;
  const neutralChroma = neutralGiven ? Math.min(neutral.c, 0.04) : Math.min(NEUTRAL_CHROMA, primary.c * 0.15);
  groups.push(groupFor('neutral', neutral, () => neutralChroma));
  for (const [name, fallback] of Object.entries(STATUS)) {
    const given = String(answers[name] ?? '');
    groups.push(groupFor(name, parseColor(given || fallback, `--${name}`)));
  }
  return groups;
}

export function rolesFor(groups: Group[], level: Level): Role[] {
  const d = level === 'aaa' ? 1 : 0;
  const roles: Role[] = [
    { name: 'surface', group: 'neutral', light: 1, dark: 6 },
    { name: 'surface-2', group: 'neutral', ...TINT },
    { name: 'text', group: 'neutral', light: 6, dark: 1 },
    { name: 'text-muted', group: 'neutral', light: 5, dark: 2 },
    { name: 'border', group: 'neutral', light: 4, dark: 3 },
  ];
  for (const { name } of groups) {
    if (name === 'neutral') continue;
    roles.push(
      { name, group: name, light: 4 + d, dark: 3 - d },
      { name: `${name}-strong`, group: name, light: 5 + d, dark: 2 - d },
      { name: `${name}-large`, group: name, light: 3 + d, dark: 4 - d },
      { name: `${name}-subtle`, group: name, ...TINT },
      { name: `on-${name}`, group: name, light: 1, dark: 6 },
    );
  }
  roles.push({ name: 'focus', group: 'primary', light: 4 + d, dark: 3 - d });
  return roles;
}

/** A pair of roles the palette promises to keep apart: text (`ratio` = the level) or UI (3:1). */
interface Claim {
  fg: string;
  bg: string;
  ratio: number;
}

function claimsFor(groups: Group[], level: Level): Claim[] {
  const text = LEVEL_RATIO[level];
  const large = LARGE_RATIO[level];
  const claims: Claim[] = [
    { fg: 'text', bg: 'surface', ratio: text },
    { fg: 'text', bg: 'surface-2', ratio: text },
    { fg: 'text-muted', bg: 'surface', ratio: text },
    { fg: 'text-muted', bg: 'surface-2', ratio: text },
    { fg: 'border', bg: 'surface', ratio: 3 },
    { fg: 'border', bg: 'surface-2', ratio: 3 },
    { fg: 'focus', bg: 'surface', ratio: 3 },
  ];
  for (const { name } of groups) {
    if (name === 'neutral') continue;
    claims.push(
      { fg: `on-${name}`, bg: name, ratio: text },
      { fg: `on-${name}`, bg: `${name}-strong`, ratio: text },
      { fg: name, bg: 'surface', ratio: text },
      { fg: `${name}-strong`, bg: `${name}-subtle`, ratio: text },
      { fg: 'text', bg: `${name}-subtle`, ratio: text },
      { fg: `${name}-strong`, bg: 'surface-2', ratio: text },
      { fg: `on-${name}`, bg: `${name}-large`, ratio: large },
      { fg: `${name}-large`, bg: 'surface', ratio: large },
    );
  }
  return claims;
}

/** Measures every shade distance and every claimed pair; fails on any miss. */
export function verify(groups: Group[], roles: Role[], level: Level): void {
  const byName = new Map(groups.map((g) => [g.name, g]));
  const roleByName = new Map(roles.map((r) => [r.name, r]));
  const hex = (role: string, mode: 'light' | 'dark'): string => {
    const r = roleByName.get(role) ?? fail(`web:palette: unknown role ${role}`);
    return shadeHex(byName.get(r.group)!, r[mode]);
  };
  for (const a of groups) {
    for (const b of groups) {
      for (let i = 0; i < SHADES; i++) {
        for (const [distance, ratio] of Object.entries(DISTANCE_RATIO)) {
          const j = i + Number(distance);
          if (j >= SHADES) continue;
          const got = contrast(a.shades[i], b.shades[j]);
          if (got < ratio) {
            fail(`web:palette: ${a.name}-${i + 1} vs ${b.name}-${j + 1} only reach ${got.toFixed(2)}:1, below ${ratio}:1 – please report this with your flags`);
          }
        }
      }
    }
  }
  for (const claim of claimsFor(groups, level)) {
    const light = contrast(hex(claim.fg, 'light'), hex(claim.bg, 'light'));
    const dark = contrast(hex(claim.fg, 'dark'), hex(claim.bg, 'dark'));
    if (Math.min(light, dark) < claim.ratio) {
      fail(`web:palette: --color-${claim.fg} on --color-${claim.bg} misses ${claim.ratio}:1 – please report this with your flags`);
    }
  }
}

const shadeHex = (g: Group, n: number): string => (Number.isInteger(n) ? g.shades[n - 1] : g.tints[n]);

/** A shade as CSS: its custom property, or the hex of a tint (which has none). */
const shadeRef = (groups: Group[], group: string, n: number): string =>
  Number.isInteger(n) ? `var(--color-${group}-${n})` : shadeHex(groups.find((g) => g.name === group)!, n);

const roleValue = (groups: Group[], r: Role, mode: 'light' | 'dark' | 'both'): string =>
  mode === 'both'
    ? `light-dark(${shadeRef(groups, r.group, r.light)}, ${shadeRef(groups, r.group, r.dark)})`
    : shadeRef(groups, r.group, r[mode]);

const declarations = (groups: Group[], roles: Role[], mode: 'light' | 'dark' | 'both', indent: string): string =>
  roles.map((r) => `${indent}--color-${r.name}: ${roleValue(groups, r, mode)};`).join('\n');

function command(answers: Answers, tailwind: boolean): string {
  const flags = ['primary', ...BRAND.slice(1), 'neutral', ...Object.keys(STATUS)]
    .filter((k) => answers[k])
    .map((k) => `--${k}=${answers[k]}`);
  if (answers.contrast !== 'aaa') flags.push(`--contrast=${answers.contrast}`);
  if (tailwind) flags.push('--tailwind');
  return `jen web:palette ${flags.join(' ')}`;
}

/** Shifts every non-empty line of `text` right by `by`. */
const indent = (text: string, by: string): string =>
  text
    .split('\n')
    .map((l) => (l ? by + l : l))
    .join('\n');

/** The roles again, for browsers without light-dark(): via prefers-color-scheme. */
const fallback = (groups: Group[], roles: Role[]) => `@supports not (color: light-dark(#000, #fff)) {
  :root {
${declarations(groups, roles, 'light', '    ')}
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
${declarations(groups, roles, 'dark', '      ')}
    }
  }

  :root[data-theme="dark"] {
${declarations(groups, roles, 'dark', '    ')}
  }
}`;

const SCHEMES = `:root[data-theme="light"] {
  color-scheme: light;
}

:root[data-theme="dark"] {
  color-scheme: dark;
}`;

/**
 * The palette stylesheet. With `tailwind`, the tokens go into Tailwind v4's
 * `@theme` (same names, so Tailwind makes `bg-primary-subtle`, `text-on-primary`,
 * …) and Tailwind's own colors are dropped, leaving only checked ones.
 */
export function paletteCss(answers: Answers, tailwind = false): string {
  const level = String(answers.contrast);
  if (level !== 'aa' && level !== 'aaa') fail(`web:palette --contrast: "${level}" – use aa or aaa`);
  const groups = groupsFor(answers);
  const roles = rolesFor(groups, level);
  verify(groups, roles, level);

  const shades = groups.map((g) => g.shades.map((hex, i) => `--color-${g.name}-${i + 1}: ${hex};`).join('\n')).join('\n\n');
  const tokens = `${shades}\n\n${declarations(groups, roles, 'both', '')}`;
  const header = `/*
 * Generated by \`${command(answers, tailwind)}\` – re-run with --force to change it.
 * Shade distances after Reasonable Colors by Matthew Howell, https://www.reasonable.work/colors/
 */`;

  if (tailwind) {
    return `${header}
@theme {
  --color-*: initial;
}

@theme static {
${indent(tokens, '  ')}
}

@layer base {
  :root {
    color-scheme: light dark;
  }

${indent(SCHEMES, '  ')}
}

/* Unlayered, so it wins over @theme in browsers without light-dark(). */
${fallback(groups, roles)}
`;
  }

  return `${header}
@layer tokens {
  :root {
    color-scheme: light dark;

${indent(tokens, '    ')}
  }

${indent(SCHEMES, '  ')}

${indent(fallback(groups, roles), '  ')}
}
`;
}

export const PALETTE_PARAMS: Params = {
  primary: {},
  secondary: { default: '' },
  tertiary: { default: '' },
  neutral: { default: '' },
  success: { default: '' },
  warning: { default: '' },
  danger: { default: '' },
  info: { default: '' },
  contrast: { default: 'aaa' },
  tailwind: { default: false },
};

const paletteGenerator: Generator = {
  description: 'create a contrast-checked color palette (CSS custom properties)',
  params: PALETTE_PARAMS,
  actions: (answers, _helpers, ctx) => [
    { add: FILE, template: paletteCss(answers, Boolean(answers.tailwind) || usesTailwind(ctx)) },
    ...importActions(ctx, [FILE]),
  ],
};

export default paletteGenerator;
