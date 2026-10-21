/** `web:cube`: base, fluid, compositions and utilities at once – plus palette and buttons with `--primary`. */
import type { Generator } from '@codejen/jen';
import { BASE, RESET } from './base.ts';
import { buttonCss } from './button.ts';
import { fail } from './common.ts';
import { NAMES, compositionItem } from './compositions.ts';
import { usesTailwind, wireEntry } from './entry.ts';
import { FLUID_PARAMS, fluidCss } from './fluid.ts';
import { PALETTE_PARAMS, groupsFor, paletteCss } from './palette.ts';
import { INTO_PARAMS, bulkActions, newFiles, unlayer } from './single.ts';
import type { Item } from './single.ts';
import { allItems, tokensFrom } from './utilities.ts';

/** One of cube's own files as an item, so `--into` can append it without its layer. */
const layered = (path: string, css: string, defines: string): Item => ({ path, css, rules: unlayer(css), defines });

const cubeGenerator: Generator = {
  description: 'create a CUBE CSS starter: base, fluid scales, compositions, utilities (+ palette and buttons with --primary)',
  params: {
    ...PALETTE_PARAMS,
    primary: { default: '', description: 'brand color – adds the palette and buttons: any CSS color (deeppink, #f37, rgb(), hsl(), oklch() …) or a hue in degrees' },
    ...FLUID_PARAMS,
    ...INTO_PARAMS,
  },
  examples: ['--dir=src/css', '--primary=#5b5bd6 --secondary=330 --dir=src/css', '--primary=#0d9488 --into=css/styles.css'],
  actions: (answers, _helpers, ctx) => {
    const tailwind = Boolean(answers.tailwind) || usesTailwind(ctx);
    const palette = answers.primary ? paletteCss(answers, tailwind) : null;
    const fluid = fluidCss(answers, tailwind);
    const button = palette ? buttonCss(groupsFor(answers).map((g) => g.name)) : null;
    const utilities = tailwind ? [] : allItems(tokensFrom(palette, fluid));
    if (answers.into) {
      if (tailwind) fail('web:cube --into isn\'t for Tailwind projects – Tailwind needs its layers');
      // without layers, source order is the cascade: utilities last, so they win over a block
      const items = [
        layered('reset.css', RESET, '*::before'),
        layered('base.css', BASE, 'li[data-icon]::marker'),
        ...(palette ? [layered('palette.css', palette, '--color-surface')] : []),
        layered('fluid.css', fluid, '--step-0'),
        ...NAMES.map(compositionItem),
        ...(button ? [layered('button.css', button, '.button')] : []),
        ...utilities,
      ];
      return bulkActions(ctx, items, answers.into, false, true);
    }
    const compositions = newFiles(ctx, NAMES.map(compositionItem));
    const utilityFiles = newFiles(ctx, utilities);
    const files = [
      { add: 'reset.css', template: RESET },
      { add: 'base.css', template: BASE },
      ...(palette ? [{ add: 'palette.css', template: palette }] : []),
      { add: 'fluid.css', template: fluid },
      ...compositions.files,
      ...(button ? [{ add: 'button.css', template: button }] : []),
      ...utilityFiles.files,
    ];
    return [...wireEntry(ctx, files, tailwind), ...compositions.notes, ...utilityFiles.notes];
  },
};

export default cubeGenerator;
