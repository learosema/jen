/** `web:button`: a `.button` block on the palette's role tokens. */
import type { Context, Generator } from '@codejen/jen';
import { fail, props } from './common.ts';
import { importActions } from './entry.ts';
import { BUTTON_MODIFIERS, modifierCss } from './modifiers.ts';
import { fill, template } from './templates.ts';

export const FILE = 'button.css';

/** Names of the colors defined in the project's palette, or a failure explaining how to make one, naming `generator`. */
export function paletteColors(ctx: Context, generator: string): string[] {
  const file = ctx.grep(/\.css$/, '--color-primary-1:')[0];
  if (!file) fail(`${generator} needs a palette – run \`jen web:palette --primary=<color>\` first`);
  const css = ctx.read(file) ?? '';
  return [...css.matchAll(/--color-([a-z]+)-1:/g)].map((m) => m[1]);
}

export function buttonCss(colors: string[]): string {
  return fill(template('button.css'), { 'color-modifiers': modifierCss(BUTTON_MODIFIERS, colors) });
}

const buttonGenerator: Generator = {
  description: 'create a contrast-checked .button block on the palette tokens',
  examples: ['--dir=src/css'],
  usage: [
    '<button type="button" class="button">…</button> or <a class="button" href="…">…</a>',
    'colors: button--secondary, button--tertiary, button--danger – those the palette has',
    'styles: button--outline, button--ghost, button--pill, button--small, button--large',
    'your own variant sets these in a modifier, shown here with their defaults:',
    ...props('.button--mine', [
      ['--button-bg: var(--color-primary)', 'the fill'],
      ['--button-bg-hover: var(--color-primary-strong)', 'the fill on hover'],
      ['--button-fg: var(--color-on-primary)', 'the text'],
      ['--button-fg-hover: var(--button-fg)', 'the text on hover'],
      ['--button-border: transparent', 'the border – drawn in forced-colors mode'],
    ]),
  ],
  actions: (_answers, _helpers, ctx) => [{ add: FILE, template: buttonCss(paletteColors(ctx, 'web:button')) }, ...importActions(ctx, [FILE])],
};

export default buttonGenerator;
