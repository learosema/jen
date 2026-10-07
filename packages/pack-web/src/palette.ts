/**
 * `web:palette`: a contrast-checked color palette as CSS custom properties.
 *
 * Every color gets 6 shades (`--color-primary-1` … `-6`, lightest first),
 * placed by luminance (see color.ts), so across all colors shades 2 apart
 * reach 3:1, 3 apart 4.5:1 (WCAG AA) and 4 apart 7:1 (AAA). On top come role
 * tokens (`--color-surface`, `--color-text`, `--color-primary`,
 * `--color-on-primary`, …) that switch with light-dark(). They meet WCAG AAA
 * (shades 4 apart) by default, `--contrast=aa` relaxes them to 3 apart.
 * `--color-primary-large` and friends sit one shade closer to the background,
 * for large text (h1s, heroes), which needs less contrast for the same level.
 *
 * Everything is checked on the final hex values before anything is written;
 * a failed check is a bug in this generator, never a silent miss.
 *
 *   jen web:palette --primary=#5b5bd6 [--secondary=… --tertiary=…] [--neutral=…]
 *                   [--success=… --warning=… --danger=… --info=…] [--contrast=aaa|aa]
 */
import type { Answers, Generator } from '@codejen/jen';
import { DISTANCE_RATIO, SHADES, colorAtLuminance, contrast, parseColor, targetLuminance } from './color.ts';
import type { Oklch } from './color.ts';
import { fail } from './common.ts';
import { importActions } from './entry.ts';

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

/** A role token: the shade it uses in light and in dark mode. */
interface Role {
  name: string;
  group: string;
  light: number;
  dark: number;
}

export interface Group {
  name: string;
  shades: string[];
}

export function shadesFor({ c, h }: Oklch, chroma: (n: number) => number = (n) => c * CHROMA_CURVE[n - 1]): string[] {
  return Array.from({ length: SHADES }, (_, i) => colorAtLuminance(targetLuminance(i + 1), chroma(i + 1), h));
}

/** The palette's colors: brand colors given, neutral, then status colors. */
export function groupsFor(answers: Answers): Group[] {
  const groups: Group[] = [];
  const primary = parseColor(String(answers.primary), '--primary');
  for (const name of BRAND) {
    const given = String(answers[name] ?? '');
    if (given) groups.push({ name, shades: shadesFor(parseColor(given, `--${name}`)) });
  }
  const neutralGiven = String(answers.neutral ?? '');
  const neutral = neutralGiven ? parseColor(neutralGiven, '--neutral') : primary;
  const neutralChroma = neutralGiven ? Math.min(neutral.c, 0.04) : Math.min(NEUTRAL_CHROMA, primary.c * 0.15);
  groups.push({ name: 'neutral', shades: shadesFor(neutral, () => neutralChroma) });
  for (const [name, fallback] of Object.entries(STATUS)) {
    const given = String(answers[name] ?? '');
    groups.push({ name, shades: shadesFor(parseColor(given || fallback, `--${name}`)) });
  }
  return groups;
}

export function rolesFor(groups: Group[], level: Level): Role[] {
  const d = level === 'aaa' ? 1 : 0;
  const roles: Role[] = [
    { name: 'surface', group: 'neutral', light: 1, dark: 6 },
    { name: 'surface-2', group: 'neutral', light: 2, dark: 5 },
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
      { name: `${name}-subtle`, group: name, light: 1, dark: 6 },
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
      { fg: name, bg: `${name}-subtle`, ratio: text },
      { fg: `on-${name}`, bg: `${name}-large`, ratio: large },
      { fg: `${name}-large`, bg: 'surface', ratio: large },
      { fg: `${name}-large`, bg: `${name}-subtle`, ratio: large },
    );
  }
  return claims;
}

/** Measures every shade distance and every claimed pair; fails on any miss. */
export function verify(groups: Group[], roles: Role[], level: Level): void {
  const byName = new Map(groups.map((g) => [g.name, g.shades]));
  const roleByName = new Map(roles.map((r) => [r.name, r]));
  const hex = (role: string, mode: 'light' | 'dark'): string => {
    const r = roleByName.get(role) ?? fail(`web:palette: unknown role ${role}`);
    return byName.get(r.group)![r[mode] - 1];
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

const roleValue = (r: Role, mode: 'light' | 'dark' | 'both'): string =>
  mode === 'both' ? `light-dark(var(--color-${r.group}-${r.light}), var(--color-${r.group}-${r.dark}))` : `var(--color-${r.group}-${r[mode]})`;

const declarations = (roles: Role[], mode: 'light' | 'dark' | 'both', indent: string): string =>
  roles.map((r) => `${indent}--color-${r.name}: ${roleValue(r, mode)};`).join('\n');

function command(answers: Answers): string {
  const flags = ['primary', ...BRAND.slice(1), 'neutral', ...Object.keys(STATUS)]
    .filter((k) => answers[k])
    .map((k) => `--${k}=${answers[k]}`);
  if (answers.contrast !== 'aaa') flags.push(`--contrast=${answers.contrast}`);
  return `jen web:palette ${flags.join(' ')}`;
}

export function paletteCss(answers: Answers): string {
  const level = String(answers.contrast);
  if (level !== 'aa' && level !== 'aaa') fail(`web:palette --contrast: "${level}" – use aa or aaa`);
  const groups = groupsFor(answers);
  const roles = rolesFor(groups, level);
  verify(groups, roles, level);

  const shades = groups
    .map((g) => g.shades.map((hex, i) => `    --color-${g.name}-${i + 1}: ${hex};`).join('\n'))
    .join('\n\n');

  return `/*
 * Generated by \`${command(answers)}\` – re-run with --force to change it.
 * Shades 3 apart reach 4.5:1, 4 apart 7:1; -large roles are for large text only.
 */
@layer tokens {
  :root {
    color-scheme: light dark;

${shades}

${declarations(roles, 'both', '    ')}
  }

  :root[data-theme="light"] {
    color-scheme: light;
  }

  :root[data-theme="dark"] {
    color-scheme: dark;
  }

  /* Browsers without light-dark(): the same roles via prefers-color-scheme. */
  @supports not (color: light-dark(#000, #fff)) {
    :root {
${declarations(roles, 'light', '      ')}
    }

    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
${declarations(roles, 'dark', '        ')}
      }
    }

    :root[data-theme="dark"] {
${declarations(roles, 'dark', '      ')}
    }
  }
}
`;
}

const paletteGenerator: Generator = {
  description: 'create a contrast-checked color palette (CSS custom properties)',
  params: {
    primary: {},
    secondary: { default: '' },
    tertiary: { default: '' },
    neutral: { default: '' },
    success: { default: '' },
    warning: { default: '' },
    danger: { default: '' },
    info: { default: '' },
    contrast: { default: 'aaa' },
  },
  actions: (answers, _helpers, ctx) => [{ add: FILE, template: paletteCss(answers) }, ...importActions(ctx, [FILE])],
};

export default paletteGenerator;
