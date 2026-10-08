/** `web:card`: a composable card, after Smol Composable Card Component by Stephanie Eckles (https://smolcss.dev). */
import type { Generator } from '@codejen/jen';
import { paletteColors } from './button.ts';
import { importActions } from './entry.ts';
import { template } from './templates.ts';

export const FILE = 'card.css';

export const CARD = template('card.css');

const cardGenerator: Generator = {
  description: 'create a composable .card block on the palette tokens',
  actions: (_answers, _helpers, ctx) => {
    paletteColors(ctx);
    return [{ add: FILE, template: CARD }, ...importActions(ctx, [FILE])];
  },
};

export default cardGenerator;
