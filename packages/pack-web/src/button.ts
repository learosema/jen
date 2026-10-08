/** `web:button`: a `.button` block on the palette's role tokens. */
import type { Context, Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { importActions } from './entry.ts';
import { fill, template } from './templates.ts';
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

const colorModifier = (name: string) => `.button--${name} {
  --button-bg: var(--color-${name});
  --button-bg-hover: var(--color-${name}-strong);
  --button-fg: var(--color-on-${name});
}`;

export function buttonCss(colors: string[]): string {
  const modifiers = COLOR_MODIFIERS.filter((c) => colors.includes(c));
  return fill(template('button.css'), { 'color-modifiers': modifiers.length ? modifiers.map(colorModifier).join('\n\n') : null });
}

const buttonGenerator: Generator = {
  description: 'create a contrast-checked .button block on the palette tokens',
  actions: (_answers, _helpers, ctx) => [{ add: FILE, template: buttonCss(paletteColors(ctx)) }, ...importActions(ctx, [FILE])],
};

export default buttonGenerator;
