/** `web:utilities`: utility classes from the project's tokens; `.pad-fluid` and `.unbreakable` after Stephanie Eckles (https://smolcss.dev). */
import type { Context, Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { importActions, usesTailwind } from './entry.ts';

export const FILE = 'utilities.css';

export interface Tokens {
  roles: string[];
  steps: string[];
  space: string[];
}

const CSS = /\.css$/;

// Matched per declaration with an anchored pattern: an unanchored global scan backtracks quadratically (ReDoS).
const names = (css: string | null | undefined, pattern: RegExp): string[] => [
  ...new Set((css ?? '').split(/[;{}]|\*\//).flatMap((decl) => pattern.exec(decl.trim())?.[1] ?? [])),
];

/** Role, step and space token names defined in the project. */
export function projectTokens(ctx: Context): Tokens {
  if (usesTailwind(ctx)) {
    fail('web:utilities: this project uses Tailwind, whose utilities take the place of these');
  }
  const palette = ctx.grep(CSS, '--color-surface:').map((f) => ctx.read(f))[0];
  const fluid = ctx.grep(CSS, '--step-0:').map((f) => ctx.read(f))[0];
  if (!palette && !fluid) fail('web:utilities builds on your tokens – run `jen web:palette --primary=<color>` and/or `jen web:fluid` first');
  return tokensFrom(palette, fluid);
}

/** Token names defined in a palette and a fluid stylesheet (either may be missing). */
export function tokensFrom(palette: string | null | undefined, fluid: string | null | undefined): Tokens {
  return {
    roles: names(palette, /^--color-([a-z0-9-]+): light-dark\(/),
    steps: names(fluid, /^--step-(-?\d+):/),
    space: names(fluid, /^--space-([a-z0-9-]+):/),
  };
}

const rule = (selector: string, decl: string) => `  .${selector} {\n    ${decl};\n  }`;

export function utilitiesCss({ roles, steps, space }: Tokens): string {
  const rules = [
    ...roles.map((r) => rule(`color-${r}`, `color: var(--color-${r})`)),
    ...roles.map((r) => rule(`bg-${r}`, `background-color: var(--color-${r})`)),
    ...steps.map((n) => rule(`step-${n}`, `font-size: var(--step-${n})`)),
    ...space.map((s) => rule(`flow-space-${s}`, `--flow-space: var(--space-${s})`)),
    ...space.map((s) => rule(`gutter-${s}`, `--gutter: var(--space-${s})`)),
  ];
  return `@layer utilities {
${rules.join('\n\n')}

  /* .pad-fluid and .unbreakable after Stephanie Eckles, https://smolcss.dev */
  .pad-fluid {
    padding: clamp(var(--space-s, 1rem), 5%, var(--space-xl, 3rem));
  }

  .unbreakable {
    overflow-wrap: anywhere;
    hyphens: auto;
  }

  .visually-hidden:not(:focus, :active) {
    position: absolute;
    inline-size: 0.0625rem;
    block-size: 0.0625rem;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
`;
}

const utilitiesGenerator: Generator = {
  description: 'create utility classes from the palette and fluid tokens',
  actions: (_answers, _helpers, ctx) => [{ add: FILE, template: utilitiesCss(projectTokens(ctx)) }, ...importActions(ctx, [FILE])],
};

export default utilitiesGenerator;
