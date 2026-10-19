/** `web:cube`: base, fluid, compositions and utilities at once – plus palette and buttons with `--primary`. */
import type { Generator } from '@codejen/jen';
import { BASE, RESET } from './base.ts';
import { buttonCss } from './button.ts';
import { NAMES, compositionItem } from './compositions.ts';
import { usesTailwind, wireEntry } from './entry.ts';
import { FLUID_PARAMS, fluidCss } from './fluid.ts';
import { PALETTE_PARAMS, groupsFor, paletteCss } from './palette.ts';
import { newFiles } from './single.ts';
import { allItems, tokensFrom } from './utilities.ts';

const cubeGenerator: Generator = {
  description: 'create a CUBE CSS starter: base, fluid scales, compositions, utilities (+ palette and buttons with --primary)',
  params: { ...PALETTE_PARAMS, primary: { default: '', description: 'brand color – adds the palette and buttons: any CSS color (deeppink, #f37, rgb(), hsl(), oklch() …) or a hue in degrees' }, ...FLUID_PARAMS },
  examples: ['--dir=src/css', '--primary=#5b5bd6 --secondary=330 --dir=src/css'],
  actions: (answers, _helpers, ctx) => {
    const tailwind = Boolean(answers.tailwind) || usesTailwind(ctx);
    const palette = answers.primary ? paletteCss(answers, tailwind) : null;
    const fluid = fluidCss(answers, tailwind);
    const files = [
      { add: 'reset.css', template: RESET },
      { add: 'base.css', template: BASE },
      ...(palette ? [{ add: 'palette.css', template: palette }] : []),
      { add: 'fluid.css', template: fluid },
      ...newFiles(ctx, NAMES.map(compositionItem)),
      ...(tailwind ? [] : newFiles(ctx, allItems(tokensFrom(palette, fluid)))),
      ...(palette ? [{ add: 'button.css', template: buttonCss(groupsFor(answers).map((g) => g.name)) }] : []),
    ];
    return wireEntry(ctx, files, tailwind);
  },
};

export default cubeGenerator;
