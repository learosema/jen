/**
 * `web:cube`: the whole CUBE CSS starter in one go – web:base, web:fluid,
 * web:compositions and web:utilities, plus web:palette and web:button when
 * `--primary` is given. Takes the flags of web:palette and web:fluid.
 * With `--tailwind` (or in a Tailwind project), the entry imports Tailwind
 * and the tokens go into its @theme; Tailwind's utilities replace web:utilities.
 *
 *   jen web:cube --primary=#5b5bd6 [--tailwind] [--dir=src/css]
 */
import type { Generator } from '@codejen/jen';
import { BASE, RESET } from './base.ts';
import { buttonCss } from './button.ts';
import { compositionsCss, pickCompositions } from './compositions.ts';
import { usesTailwind, wireEntry } from './entry.ts';
import { FLUID_PARAMS, fluidCss } from './fluid.ts';
import { PALETTE_PARAMS, groupsFor, paletteCss } from './palette.ts';
import { tokensFrom, utilitiesCss } from './utilities.ts';

const cubeGenerator: Generator = {
  description: 'create a CUBE CSS starter: base, fluid scales, compositions, utilities (+ palette and buttons with --primary)',
  params: { ...PALETTE_PARAMS, primary: { default: '' }, ...FLUID_PARAMS },
  actions: (answers, _helpers, ctx) => {
    const tailwind = Boolean(answers.tailwind) || usesTailwind(ctx);
    const palette = answers.primary ? paletteCss(answers, tailwind) : null;
    const fluid = fluidCss(answers, tailwind);
    const files = [
      { add: 'reset.css', template: RESET },
      { add: 'base.css', template: BASE },
      ...(palette ? [{ add: 'palette.css', template: palette }] : []),
      { add: 'fluid.css', template: fluid },
      { add: 'compositions.css', template: compositionsCss(pickCompositions('')) },
      ...(tailwind ? [] : [{ add: 'utilities.css', template: utilitiesCss(tokensFrom(palette, fluid)) }]),
      ...(palette ? [{ add: 'button.css', template: buttonCss(groupsFor(answers).map((g) => g.name)) }] : []),
    ];
    return wireEntry(ctx, files, tailwind);
  },
};

export default cubeGenerator;
