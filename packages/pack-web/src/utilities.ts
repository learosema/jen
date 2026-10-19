/** Utility classes, one file each: from the project's tokens (`web:color-classes`, …) and fixed ones (`web:visually-hidden`, …); `web:utilities` for all. */
import type { Context, Generator } from '@codejen/jen';
import { SHADES } from './color.ts';
import { fail } from './common.ts';
import { usesTailwind } from './entry.ts';
import { bulkActions, singleActions } from './single.ts';
import type { Item } from './single.ts';
import { fill, template } from './templates.ts';

export interface Tokens {
  /** Colors with shades (`--color-pink-1` …), from web:color or web:palette. */
  colors: string[];
  /** web:palette's role tokens (`--color-primary-subtle`, `--color-text`). */
  roles: string[];
  steps: string[];
  space: string[];
}

const CSS = /\.css$/;

// Matched per declaration with an anchored pattern: an unanchored global scan backtracks quadratically (ReDoS).
const names = (css: string, pattern: RegExp): string[] => [
  ...new Set(css.split(/[;{}]|\*\//).flatMap((decl) => pattern.exec(decl.trim())?.[1] ?? [])),
];

/** Token names defined in some stylesheets (any of them may be missing). */
export function tokensFrom(...sheets: (string | null | undefined)[]): Tokens {
  const css = sheets.filter(Boolean).join('\n');
  return {
    colors: names(css, /^--color-([a-z0-9-]+)-1:\s*#/),
    roles: names(css, /^--color-([a-z0-9-]+): light-dark\(/),
    steps: names(css, /^--step-(-?\d+):/),
    space: names(css, /^--space-([a-z0-9-]+):/),
  };
}

/** Token names defined anywhere in the project. */
export function projectTokens(ctx: Context, generator: string): Tokens {
  if (usesTailwind(ctx)) fail(`${generator}: this project uses Tailwind, whose utilities take the place of these`);
  return tokensFrom(...ctx.grep(CSS).map((f) => ctx.read(f)));
}

/** The color a role token belongs to: the longest color it's named after (`primary-subtle`, `on-primary`), else neutral (`text`, `surface`). */
function owner(role: string, colors: string[]): string {
  const of = colors.filter((c) => role === c || role.startsWith(`${c}-`) || role === `on-${c}`);
  return of.sort((a, b) => b.length - a.length)[0] ?? 'neutral';
}

const rule = (selector: string, decl: string) => `.${selector} {\n  ${decl};\n}`;

const utilitiesCss = (rules: string[]): string => fill(template('utilities.css'), { utilities: rules.join('\n\n') });

/** `.color-*` and `.bg-*` for one color: its role tokens if the palette made some (to stay on checked pairs), else its shades. */
export function colorClassesItem({ colors, roles }: Tokens, name: string): Item {
  const own = roles.filter((r) => owner(r, colors) === name);
  const tokens = own.length ? own : colors.includes(name) ? Array.from({ length: SHADES }, (_, i) => `${name}-${i + 1}`) : null;
  if (!tokens) {
    const known = [...new Set([...colors, ...roles.map((r) => owner(r, colors))])];
    fail(
      `web:color-classes: there's no color "${name}" in the project – run \`jen web:color --name=${name} --color=<color>\` first` +
        (known.length ? ` (it has ${known.join(', ')})` : ''),
    );
  }
  return {
    path: `utilities/color-${name}.css`,
    css: utilitiesCss([...tokens.map((t) => rule(`color-${t}`, `color: var(--color-${t})`)), ...tokens.map((t) => rule(`bg-${t}`, `background-color: var(--color-${t})`))]),
    defines: `.color-${tokens[0]}`,
  };
}

export function stepsItem({ steps }: Tokens): Item {
  if (!steps.length) fail('web:step-classes needs the fluid type steps – run `jen web:fluid` first');
  return { path: 'utilities/steps.css', css: utilitiesCss(steps.map((n) => rule(`step-${n}`, `font-size: var(--step-${n})`))), defines: `.step-${steps[0]}` };
}

export function spaceItem({ space }: Tokens): Item {
  if (!space.length) fail('web:space-classes needs the fluid space sizes – run `jen web:fluid` first');
  return {
    path: 'utilities/space.css',
    css: utilitiesCss([...space.map((s) => rule(`flow-space-${s}`, `--flow-space: var(--space-${s})`)), ...space.map((s) => rule(`gutter-${s}`, `--gutter: var(--space-${s})`))]),
    defines: `.flow-space-${space[0]}`,
  };
}

const FIXED: Record<string, string> = {
  'visually-hidden': 'hide something visually but keep it for screen readers (.visually-hidden)',
  'pad-fluid': 'padding that grows with the container (.pad-fluid)',
  unbreakable: 'let long words and URLs break instead of overflowing (.unbreakable)',
};

const fixedItem = (name: string): Item => ({ path: `utilities/${name}.css`, css: utilitiesCss([template(`utilities/${name}.css`).trimEnd()]), defines: `.${name}` });

/** Every utility that fits the tokens: per color, steps and space if there's a fluid scale, and the fixed ones. */
export function allItems(tokens: Tokens): Item[] {
  const colors = [...new Set([...tokens.colors, ...tokens.roles.map((r) => owner(r, tokens.colors))])];
  return [
    ...colors.map((c) => colorClassesItem(tokens, c)),
    ...(tokens.steps.length ? [stepsItem(tokens)] : []),
    ...(tokens.space.length ? [spaceItem(tokens)] : []),
    ...Object.keys(FIXED).map(fixedItem),
  ];
}

export const utilityGenerators: Record<string, Generator> = {
  'color-classes': {
    description: 'create .color-* and .bg-* classes for one color',
    params: { name: { description: 'the color: one from web:color (pink), from web:palette (primary), or neutral for the page colors' } },
    examples: ['--name=primary', '--name=pink --dir=src/css'],
    actions: ({ name }, _helpers, ctx) => singleActions(ctx, 'web:color-classes', colorClassesItem(projectTokens(ctx, 'web:color-classes'), String(name))),
  },
  'step-classes': {
    description: 'create .step-* font size classes from the fluid type steps',
    examples: ['', '--dir=src/css'],
    actions: (_answers, _helpers, ctx) => singleActions(ctx, 'web:step-classes', stepsItem(projectTokens(ctx, 'web:step-classes'))),
  },
  'space-classes': {
    description: 'create .flow-space-* and .gutter-* classes from the fluid space sizes',
    examples: ['', '--dir=src/css'],
    actions: (_answers, _helpers, ctx) => singleActions(ctx, 'web:space-classes', spaceItem(projectTokens(ctx, 'web:space-classes'))),
  },
  ...Object.fromEntries(
    Object.entries(FIXED).map(([name, description]): [string, Generator] => [
      name,
      { description, examples: ['', '--dir=src/css'], actions: (_answers, _helpers, ctx) => singleActions(ctx, `web:${name}`, fixedItem(name)) },
    ]),
  ),
};

const utilitiesGenerator: Generator = {
  description: 'create every utility that fits the project\'s tokens at once, one file each (web:color-classes, web:step-classes, …)',
  examples: ['', '--dir=src/css'],
  actions: (_answers, _helpers, ctx) => bulkActions(ctx, allItems(projectTokens(ctx, 'web:utilities'))),
};

export default utilitiesGenerator;
