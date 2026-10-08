/** `web:cube`: base, fluid, compositions and utilities at once – plus palette and buttons with `--primary`. */
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
