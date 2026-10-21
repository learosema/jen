/** `web:card`: a composable card, after Smol Composable Card Component by Stephanie Eckles (https://smolcss.dev). */
import type { Generator } from '@codejen/jen';
import { paletteColors } from './button.ts';
import { props } from './common.ts';
import { importActions } from './entry.ts';
import { template } from './templates.ts';

export const FILE = 'card.css';

export const CARD = template('card.css');

const cardGenerator: Generator = {
  description: 'create a composable .card block on the palette tokens',
  examples: ['--dir=src/css'],
  usage: [
    '<article class="card"><img src="…" alt=""><h3>…</h3><p>…</p><footer>…</footer></article>',
    'media first or last (img, picture, video, .card__media) goes edge to edge; the last child sits at the bottom',
    ...props('.card', [
      ['--card-padding: var(--space-s-m, 1.25rem)', 'the padding – on the card, or on a parent for all its cards'],
      ['--card-gap: var(--space-xs, 0.75rem)', 'the space between the children'],
      ['--card-radius: 0.75rem', 'the corners'],
      ['--card-media-ratio: 16 / 9', 'the aspect ratio of images and videos'],
    ]),
  ],
  actions: (_answers, _helpers, ctx) => {
    paletteColors(ctx, 'web:card');
    return [{ add: FILE, template: CARD }, ...importActions(ctx, [FILE])];
  },
};

export default cardGenerator;
