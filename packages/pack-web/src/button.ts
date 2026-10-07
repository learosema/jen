/**
 * `web:button`: a `.button` block (BEM modifiers, `blocks` layer) built on
 * web:palette's role tokens, so every state keeps the palette's checked
 * contrast: the text on the fill and on its hover fill, the fill against the
 * page, and the focus ring.
 *
 * The palette is looked up in the project (the .css file defining
 * `--color-primary-1`); each of its brand colors besides primary, and
 * danger, gets a modifier – `.button--secondary`, `.button--danger`, … –
 * plus `--outline`, `--ghost`, `--pill`, `--small` and `--large`.
 *
 *   jen web:button [--dir=src/css]
 */
import type { Context, Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { importActions } from './entry.ts';
import { BRAND } from './palette.ts';

export const FILE = 'button.css';

/** Color modifiers: brand colors other than primary, and danger – in this order, if the palette has them. */
const COLOR_MODIFIERS = [...BRAND.slice(1), 'danger'];

/** Names of the colors defined in the project's palette, or a failure explaining how to make one. */
export function paletteColors(ctx: Context): string[] {
  const file = ctx.grep(/\.css$/, '--color-primary-1:')[0];
  if (!file) fail('web:button needs a palette – run `jen web:palette --primary=<color>` first');
  const css = ctx.read(file) ?? '';
  return [...css.matchAll(/--color-([a-z]+)-1:/g)].map((m) => m[1]);
}

const colorModifier = (name: string) => `
  .button--${name} {
    --button-bg: var(--color-${name});
    --button-bg-hover: var(--color-${name}-strong);
    --button-fg: var(--color-on-${name});
  }
`;

export function buttonCss(colors: string[]): string {
  const modifiers = COLOR_MODIFIERS.filter((c) => colors.includes(c));
  return `/*
 * .button with BEM modifiers (.button--outline, …) on the palette's checked role tokens.
 * Your own variant: a modifier that sets the --button-* properties.
 */
@layer blocks {
  .button {
    --button-bg: var(--color-primary);
    --button-bg-hover: var(--color-primary-strong);
    --button-fg: var(--color-on-primary);
    /* Transparent, but forced-colors mode (Windows High Contrast) draws it. */
    --button-border: transparent;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    padding: 0.625em 1.25em;
    border: thin solid var(--button-border);
    border-radius: 0.5em;
    background: var(--button-bg);
    color: var(--button-fg);
    font: inherit;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    transition: background-color 0.15s, translate 0.1s;
  }

  .button:hover {
    background: var(--button-bg-hover);
  }

  .button:focus-visible {
    outline: 0.125rem solid var(--color-focus);
    outline-offset: 0.125rem;
  }

  .button:active {
    translate: 0 0.0625em;
  }

  /* Disabled controls are exempt from WCAG contrast; muted, but still readable. */
  .button:is(:disabled, [aria-disabled="true"]) {
    --button-bg: var(--color-surface-2);
    --button-bg-hover: var(--color-surface-2);
    --button-fg: var(--color-text-muted);
    --button-border: var(--color-border);

    cursor: not-allowed;
    translate: none;
  }

  .button svg {
    flex: none;
    inline-size: 1.25em;
    block-size: 1.25em;
  }
${modifiers.map(colorModifier).join('')}
  /* On the page background: primary text, a primary border, a tinted hover. */
  .button--outline {
    --button-bg: transparent;
    --button-bg-hover: var(--color-primary-subtle);
    --button-fg: var(--color-primary);
    --button-border: currentColor;
  }

  .button--ghost {
    --button-bg: transparent;
    --button-bg-hover: var(--color-primary-subtle);
    --button-fg: var(--color-primary);
  }

  .button--pill {
    border-radius: 100vmax;
  }

  .button--small {
    font-size: 0.875em;
  }

  .button--large {
    font-size: 1.125em;
  }
}
`;
}

const buttonGenerator: Generator = {
  description: 'create a contrast-checked .button block on the palette tokens',
  actions: (_answers, _helpers, ctx) => [{ add: FILE, template: buttonCss(paletteColors(ctx)) }, ...importActions(ctx, [FILE])],
};

export default buttonGenerator;
