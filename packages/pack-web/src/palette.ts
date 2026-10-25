/** `web:palette`: a contrast-checked palette; shade distances after Reasonable Colors by Matthew Howell (https://www.reasonable.work/colors/). */
import type { Action, Answers, Generator, Params } from '@codejen/jen';
import { DISTANCE_RATIO, SHADES, colorAtLuminance, contrast, luminance, oklchToHex, parseColor, span, targetLuminance } from './color.ts';
import type { Oklch } from './color.ts';
import { fail, rules } from './common.ts';
import { importActions, usesTailwind } from './entry.ts';
import { missingModifiers } from './modifiers.ts';

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
  /** Colors between shades, by position (BETWEEN). */
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
    tints: Object.fromEntries(BETWEEN.map((n) => [n, at(n)])),
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

/**
 * Each role sits just as far from what it's measured against as its ratio needs (span()), often between
 * shades: on whole shades, 7:1 would land on 9.6:1 and make buttons and borders needlessly dark.
 */
export function rolesFor(groups: Pick<Group, 'name'>[], level: Level): Role[] {
  const text = span(LEVEL_RATIO[level]);
  const large = span(LARGE_RATIO[level]);
  const ui = span(3);
  const roles: Role[] = [
    { name: 'surface', group: 'neutral', light: 1, dark: 6 },
    { name: 'surface-2', group: 'neutral', ...TINT },
    { name: 'text', group: 'neutral', light: 6, dark: 1 },
    // measured against surface-2, the tint farther in
    { name: 'text-muted', group: 'neutral', light: TINT.light + text, dark: TINT.dark - text },
    { name: 'border', group: 'neutral', light: TINT.light + ui, dark: TINT.dark - ui },
    // decorative dividers: WCAG 1.4.11 asks 3:1 only of borders that carry meaning, so claimsFor() has no pair for it
    { name: 'border-subtle', group: 'neutral', light: 2, dark: 5 },
  ];
  for (const { name } of groups) {
    if (name === 'neutral') continue;
    roles.push(
      { name, group: name, light: 1 + text, dark: 6 - text },
      // half a shade on: a visible hover, and far enough from -subtle for text on it
      { name: `${name}-strong`, group: name, light: 1.5 + text, dark: 5.5 - text },
      { name: `${name}-large`, group: name, light: 1 + large, dark: 6 - large },
      { name: `${name}-subtle`, group: name, ...TINT },
      { name: `on-${name}`, group: name, light: 1, dark: 6 },
    );
  }
  roles.push({ name: 'focus', group: 'primary', light: 1 + text, dark: 6 - text });
  return roles;
}

/** Every place between shades a role can sit, at either level: the colors groupFor() makes besides the shades. */
const BETWEEN = [
  ...new Set((['aa', 'aaa'] as const).flatMap((level) => rolesFor([{ name: 'x' }], level).flatMap((r) => [r.light, r.dark]))),
].filter((n) => !Number.isInteger(n));

/** A pair of roles the palette promises to keep apart: text (`ratio` = the level) or UI (3:1). */
interface Claim {
  fg: string;
  bg: string;
  ratio: number;
}

export function claimsFor(groups: Pick<Group, 'name'>[], level: Level): Claim[] {
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

/** Where each role (shown for primary) typically goes, for `usage`: a selector, a declaration using it, what for. */
const ROLE_USES: Record<string, [string, string, string]> = {
  surface: ['body', 'background: var(--color-surface)', 'the page'],
  'surface-2': ['.card', 'background: var(--color-surface-2)', 'cards, sidebars: a tint off the page'],
  text: ['body', 'color: var(--color-text)', 'text'],
  'text-muted': ['small', 'color: var(--color-text-muted)', 'secondary text'],
  border: ['input', 'border: thin solid var(--color-border)', 'borders that must be seen: inputs, focusable outlines'],
  'border-subtle': ['hr', 'border-color: var(--color-border-subtle)', 'dividers that carry no meaning – not 3:1, so not for inputs'],
  primary: ['a', 'color: var(--color-primary)', 'links; the background of a primary button'],
  'primary-strong': ['a:hover', 'color: var(--color-primary-strong)', 'hover, and colored text on tints'],
  'primary-large': ['h1', 'color: var(--color-primary-large)', 'large text only (1.5rem, or 1.1667rem bold)'],
  'primary-subtle': ['.badge', 'background: var(--color-primary-subtle)', 'a tinted background'],
  'on-primary': ['.button', 'color: var(--color-on-primary)', 'text on the color'],
  focus: [':focus-visible', 'outline-color: var(--color-focus)', 'focus rings'],
};

const ratio = (r: number): string => `${r}:1`;

/**
 * `usage` for the role tokens, made from rolesFor() and claimsFor() so it can't drift: one line per role
 * (shown for primary), with the pairs measured for it at the default level.
 */
export function paletteUsage(): string[] {
  const groups = groupsFor({ primary: '#5b5bd6' });
  const shown = rolesFor(groups, 'aaa').filter((r) => r.group === 'neutral' || r.group === 'primary');
  const names = new Set(shown.map((r) => r.name));
  const claims = claimsFor(groups, 'aaa').filter((c) => names.has(c.fg) && names.has(c.bg));
  const lines = rules(
    shown.map(({ name }): [string, string, string] => {
      const [selector, decl, what] = ROLE_USES[name] ?? fail(`web:palette: no usage for --color-${name}`);
      if (!decl.includes(`var(--color-${name})`)) fail(`web:palette: the usage for --color-${name} doesn't use it`);
      const byRatio = Map.groupBy(claims.filter((c) => c.fg === name), (c) => c.ratio);
      const checked = [...byRatio].map(([r, cs]) => `${ratio(r)} on ${cs.map((c) => c.bg).join(', ')}`).join('; ');
      return [selector, decl, checked ? `${what} – ${checked}` : what];
    }),
  );
  const perColor = shown.filter((r) => r.group === 'primary' && r.name !== 'focus').length;
  const others = [...BRAND.slice(1), ...Object.keys(STATUS)].join(', ');
  return [
    ...lines,
    `the same ${perColor} roles for ${others}: --color-danger, --color-danger-strong, --color-on-danger …`,
    `each pair is measured in light and dark mode before writing; with --contrast=aa, ${ratio(LEVEL_RATIO.aaa)} is ${ratio(LEVEL_RATIO.aa)} and ${ratio(LARGE_RATIO.aaa)} is ${ratio(LARGE_RATIO.aa)}`,
  ];
}

/** Where a role sits, in shade names: `-5`, or `between -4 and -5`. */
const shadeAt = (n: number): string => (Number.isInteger(n) ? `-${n}` : `between -${Math.floor(n)} and -${Math.ceil(n)}`);

/** A bare hue (`264`, `264deg`) has no lightness of its own to compare. */
const isHue = (spec: string): boolean => /^\s*-?[\d.]+(deg)?\s*$/.test(spec);

/**
 * `info:` lines for brand colors whose shade isn't the one `--color-<name>` (buttons, links) uses: the palette
 * places shades by luminance, so `--primary=#0d9488` can end up as a much darker button. Says which shade the
 * color is closest to, which roles use it, and what `--contrast=aa` would change.
 */
export function brandNotes(answers: Answers): Action[] {
  const level = String(answers.contrast) as Level;
  const roles = rolesFor(groupsFor(answers), level);
  const notes: Action[] = [];
  for (const name of BRAND) {
    const given = String(answers[name] ?? '');
    if (!given || isHue(given)) continue;
    const y = luminance(oklchToHex(parseColor(given, `--${name}`)));
    const distance = (n: number) => Math.abs(Math.log((y + 0.05) / (targetLuminance(n) + 0.05)));
    const closest = Array.from({ length: SHADES }, (_, i) => i + 1).reduce((a, b) => (distance(b) < distance(a) ? b : a));
    const main = roles.find((r) => r.name === name)!;
    if (Math.round(main.light) === closest) continue;
    const users = roles
      .filter((r) => r.group === name && r.name !== 'focus')
      .flatMap((r) => [...(r.light === closest ? [`--color-${r.name} in light mode`] : []), ...(r.dark === closest ? [`--color-${r.name} in dark mode`] : [])]);
    const aa = rolesFor(groupsFor(answers), 'aa').find((r) => r.name === name)!.light;
    const closer = level === 'aaa' && Math.abs(aa - closest) < Math.abs(main.light - closest);
    notes.push({
      note:
        `${given} is closest to --color-${name}-${closest}${users.length ? ` (${users.join(', ')})` : ''}; ` +
        `buttons and links use a ${main.light > closest ? 'darker' : 'lighter'} color ${shadeAt(main.light)} in light mode${closer ? `, ${shadeAt(aa)} with --contrast=aa` : ''}`,
    });
  }
  return notes;
}

/** What the palette's files guarantee, so nobody has to measure them again. */
export const paletteGuarantee = (answers: Answers): string => {
  const level = String(answers.contrast) as Level;
  return `WCAG ${level.toUpperCase()} for the role tokens in light and dark mode (light-dark()): text, links and buttons ${ratio(LEVEL_RATIO[level])}, -large ${ratio(LARGE_RATIO[level])}, borders and focus 3:1`;
};

/** Measures every shade distance, across colors too; fails on any miss. */
export function verifyShades(groups: Group[], generator = 'web:palette'): void {
  for (const a of groups) {
    for (const b of groups) {
      for (let i = 0; i < SHADES; i++) {
        for (const [distance, ratio] of Object.entries(DISTANCE_RATIO)) {
          const j = i + Number(distance);
          if (j >= SHADES) continue;
          const got = contrast(a.shades[i], b.shades[j]);
          if (got < ratio) {
            fail(`${generator}: ${a.name}-${i + 1} vs ${b.name}-${j + 1} only reach ${got.toFixed(2)}:1, below ${ratio}:1 – please report this with your flags`);
          }
        }
      }
    }
  }
}

/** Measures every shade distance and every claimed pair; fails on any miss. */
export function verify(groups: Group[], roles: Role[], level: Level): void {
  const byName = new Map(groups.map((g) => [g.name, g]));
  const roleByName = new Map(roles.map((r) => [r.name, r]));
  const hex = (role: string, mode: 'light' | 'dark'): string => {
    const r = roleByName.get(role) ?? fail(`web:palette: unknown role ${role}`);
    return shadeHex(byName.get(r.group)!, r[mode]);
  };
  verifyShades(groups);
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

/** A value as one shell word: `#5b5bd6` as is, `rgb(255 51 119)` quoted. */
export const shellWord = (value: string): string => (/^[\w#.%+-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`);

function command(answers: Answers, tailwind: boolean): string {
  const flags = ['primary', ...BRAND.slice(1), 'neutral', ...Object.keys(STATUS)]
    .filter((k) => answers[k])
    .map((k) => `--${k}=${shellWord(String(answers[k]))}`);
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
  primary: { description: 'brand color: any CSS color (deeppink, #f37, rgb(), hsl(), oklch() …) or a hue in degrees' },
  secondary: { default: '', description: 'a second brand color, e.g. an accent – same formats as --primary, checked the same way' },
  tertiary: { default: '', description: 'a third brand color, same formats as --primary' },
  neutral: { default: '', description: 'the gray\'s tint (default: the primary\'s hue)' },
  success: { default: '', description: 'overrides the built-in success color' },
  warning: { default: '', description: 'overrides the built-in warning color' },
  danger: { default: '', description: 'overrides the built-in danger color' },
  info: { default: '', description: 'overrides the built-in info color' },
  contrast: { default: 'aaa', choices: ['aaa', 'aa'], description: 'WCAG level of the role tokens: 7:1 for text, or 4.5:1 with aa' },
  tailwind: { default: false, description: 'write Tailwind\'s @theme instead – on by itself in a Tailwind project' },
};

const paletteGenerator: Generator = {
  description: 'create a contrast-checked color palette (CSS custom properties) – --secondary and --tertiary for accent colors',
  params: PALETTE_PARAMS,
  usage: paletteUsage(),
  examples: ['--primary=#5b5bd6', '--primary=#5b5bd6 --secondary=330 --contrast=aa'],
  actions: (answers, _helpers, ctx) => [
    { add: FILE, template: paletteCss(answers, Boolean(answers.tailwind) || usesTailwind(ctx)) },
    ...importActions(ctx, [FILE]),
    ...missingModifiers(ctx, groupsFor(answers).map((g) => g.name)),
    ...brandNotes(answers),
    { note: `guaranteed: ${paletteGuarantee(answers)} – measured before writing` },
  ],
};

export default paletteGenerator;
