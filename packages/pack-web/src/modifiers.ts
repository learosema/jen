/** The color modifiers of `.button` and `.badge`: written with the block, added later when the palette gets a color. */
import type { Action, Context } from '@codejen/jen';
import { BRAND, STATUS } from './palette.ts';

interface Modifiers {
  block: string;
  /** The colors it has a modifier for, in order – read when called, so the palette's lists are there. */
  colors: () => string[];
  css: (name: string) => string;
}

export const BUTTON_MODIFIERS: Modifiers = {
  block: 'button',
  // brand colors other than primary, and danger
  colors: () => [...BRAND.slice(1), 'danger'],
  css: (name) => `.button--${name} {
  --button-bg: var(--color-${name});
  --button-bg-hover: var(--color-${name}-strong);
  --button-fg: var(--color-on-${name});
}`,
};

export const BADGE_MODIFIERS: Modifiers = {
  block: 'badge',
  // every color besides primary, the default
  colors: () => [...BRAND.slice(1), ...Object.keys(STATUS)],
  css: (name) => `.badge--${name} {
  --badge-bg: var(--color-${name}-subtle);
  --badge-fg: var(--color-${name}-strong);
}`,
};

/** The modifiers for those of `colors` that `m` has one for, as CSS, or null. */
export function modifierCss(m: Modifiers, colors: string[]): string | null {
  const names = m.colors().filter((c) => colors.includes(c));
  return names.length ? names.map(m.css).join('\n\n') : null;
}

/**
 * Adds to the project's .button and .badge the modifiers for `colors` they don't have yet: inside the
 * `@layer blocks` that holds the block, or at the end of a file without layers (`--into`).
 */
export function missingModifiers(ctx: Context, colors: string[], skip: string[] = []): Action[] {
  const actions: Action[] = [];
  for (const m of [BUTTON_MODIFIERS, BADGE_MODIFIERS]) {
    if (skip.includes(m.block)) continue;
    for (const file of ctx.grep(/\.css$/, `.${m.block} {`)) {
      const css = ctx.read(file) ?? '';
      const missing = m.colors().filter((c) => colors.includes(c) && !css.includes(`.${m.block}--${c} {`));
      if (missing.length === 0) continue;
      const rules = `\n${missing.map(m.css).join('\n\n')}`;
      const lines = css.split('\n');
      const at = lines.findIndex((l) => l.includes(`.${m.block} {`));
      const layer = lines.findLastIndex((l, i) => i < at && /^@layer\b[^;]*\{\s*$/.test(l));
      const close = layer < 0 ? -1 : lines.findIndex((l, i) => i > at && /^\}\s*$/.test(l));
      actions.push(close < 0 ? { append: `/${file}`, text: rules } : { insert: `/${file}`, before: close + 1, line: rules });
      actions.push({ note: `adds .${m.block}--${missing.join(`, .${m.block}--`)} for the palette's new color${missing.length > 1 ? 's' : ''}`, file: `/${file}` });
    }
  }
  return actions;
}
