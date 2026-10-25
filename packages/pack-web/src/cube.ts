/** `web:cube`: base, fluid, compositions and utilities at once – plus palette and buttons with `--primary`. */
import type { Generator } from '@codejen/jen';
import { BASE, RESET } from './base.ts';
import { BLOCK_NAMES } from './blocks.ts';
import { buttonCss } from './button.ts';
import { fail } from './common.ts';
import { NAMES, compositionItem } from './compositions.ts';
import { usesTailwind, wireEntry } from './entry.ts';
import { FLUID_GUARANTEE, FLUID_PARAMS, fluidCss } from './fluid.ts';
import { PALETTE_PARAMS, brandNotes, groupsFor, paletteCss, paletteGuarantee } from './palette.ts';
import { missingModifiers } from './modifiers.ts';
import { INTO_PARAMS, bulkActions, newFiles, unlayer } from './single.ts';
import type { Item } from './single.ts';
import { allItems, tokensFrom } from './utilities.ts';

/** One of cube's own files as an item, so `--into` can append it without its layer. */
const layered = (path: string, css: string, defines: string): Item => ({ path, css, rules: unlayer(css), defines });

const cubeGenerator: Generator = {
  description: 'create a CUBE CSS starter: base, fluid scales, and every composition and utility at once (+ palette.css and button.css with --primary, so no web:button then) – blocks like web:card are separate',
  params: {
    ...PALETTE_PARAMS,
    primary: { default: '', description: 'brand color – adds the palette and buttons: any CSS color (deeppink, #f37, rgb(), hsl(), oklch() …) or a hue in degrees' },
    ...FLUID_PARAMS,
    ...INTO_PARAMS,
  },
  usage: [
    'writes reset.css, base.css, fluid.css, compositions/*.css and utilities/*.css, imported by styles.css (--into: all in one file); --primary adds palette.css and button.css',
    `the compositions: ${NAMES.map((n) => `.${n}`).join(', ')} – each one's markup: jen web:<name> --help`,
    `blocks to add: jen web:card, web:button (with --primary already in), ${['avatars', 'dialog', 'popover', 'theme-toggle', ...BLOCK_NAMES].map((n) => `web:${n}`).join(', ')}`,
    'with --primary, the palette\'s role tokens – which goes on which: jen web:palette --help',
  ],
  examples: ['--dir=src/css', '--primary=#5b5bd6 --secondary=330 --dir=src/css', '--primary=#0d9488 --into=css/styles.css'],
  actions: (answers, _helpers, ctx) => {
    const tailwind = Boolean(answers.tailwind) || usesTailwind(ctx);
    const palette = answers.primary ? paletteCss(answers, tailwind) : null;
    const fluid = fluidCss(answers, tailwind);
    const button = palette ? buttonCss(groupsFor(answers).map((g) => g.name)) : null;
    const utilities = tailwind ? [] : allItems(tokensFrom(palette, fluid));
    // cube writes the buttons itself; a badge the project already has gets the palette's new colors
    const modifiers = palette ? missingModifiers(ctx, groupsFor(answers).map((g) => g.name), ['button']) : [];
    const guarantee = { note: `guaranteed: ${[...(palette ? [paletteGuarantee(answers)] : []), FLUID_GUARANTEE, 'no px in any file'].join('; ')}` };
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
      return [...bulkActions(ctx, items, answers.into, false, true), ...modifiers, ...(palette ? brandNotes(answers) : []), guarantee];
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
    const buttonNote = button ? [{ note: 'has the buttons – web:button isn\'t needed', file: 'button.css', written: true as const }] : [];
    return [...wireEntry(ctx, files, tailwind), ...compositions.notes, ...utilityFiles.notes, ...buttonNote, ...modifiers, ...(palette ? brandNotes(answers) : []), guarantee];
  },
};

export default cubeGenerator;
