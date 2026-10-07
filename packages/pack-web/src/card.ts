/**
 * `web:card`: a composable `.card` block after SmolCSS's card
 * (https://smolcss.dev), written fresh: any children – media, heading, text,
 * a footer – get the card's padding, media goes edge to edge, and the last
 * child sits at the bottom so footers line up across a row of cards.
 * Colors come from web:palette's checked pairs, so it needs a palette.
 *
 *   jen web:card [--dir=src/css]
 */
import type { Generator } from '@codejen/jen';
import { paletteColors } from './button.ts';
import { importActions } from './entry.ts';

export const FILE = 'card.css';

export const CARD = `/* .card: padded children, edge-to-edge media, the last child pinned to the bottom. */
@layer blocks {
  .card {
    --card-padding: var(--space-s-m, 1.25rem);

    display: flex;
    flex-direction: column;
    gap: var(--card-gap, var(--space-xs, 0.75rem));
    padding-block: var(--card-padding);
    border: thin solid var(--color-border);
    border-radius: var(--card-radius, 0.75rem);
    background: var(--color-surface-2);
    color: var(--color-text);
    overflow: hidden;
  }

  .card > * {
    margin: 0;
    padding-inline: var(--card-padding);
  }

  .card > :last-child:not(:first-child) {
    margin-block-start: auto;
  }

  .card > :is(img, picture, video) {
    padding-inline: 0;
    inline-size: 100%;
    aspect-ratio: var(--card-media-ratio, 16 / 9);
    object-fit: cover;
  }

  .card > :is(img, picture, video):first-child {
    margin-block-start: calc(-1 * var(--card-padding));
  }

  .card > :is(img, picture, video):last-child {
    margin-block-end: calc(-1 * var(--card-padding));
  }

  .card a {
    color: var(--color-primary-strong);
  }
}
`;

const cardGenerator: Generator = {
  description: 'create a composable .card block on the palette tokens',
  actions: (_answers, _helpers, ctx) => {
    paletteColors(ctx);
    return [{ add: FILE, template: CARD }, ...importActions(ctx, [FILE])];
  },
};

export default cardGenerator;
