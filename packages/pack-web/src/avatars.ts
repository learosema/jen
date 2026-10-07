/**
 * `web:avatars`: an `.avatars` block after SmolCSS's avatar list
 * (https://smolcss.dev), written fresh: overlapping round avatars that move
 * apart on hover or focus to reveal the one underneath. Each step is at least
 * 2.75rem (44px) wide, the WCAG AAA target size, for avatars that are links.
 *
 *   jen web:avatars [--dir=src/css]
 */
import type { Generator } from '@codejen/jen';
import { paletteColors } from './button.ts';
import { importActions } from './entry.ts';

export const FILE = 'avatars.css';

export const AVATARS = `/* .avatars: <ul class="avatars"><li><a href="…"><img alt="…" src="…"></a></li>…</ul> */
@layer blocks {
  .avatars {
    --avatar-size: 3.5rem;

    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: max(2.75rem, calc(var(--avatar-size) * 0.6));
    justify-content: start;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .avatars > * {
    inline-size: var(--avatar-size);
    transition: translate var(--transition-duration, 0.2s) var(--transition-easing, ease-out);
  }

  .avatars > :is(:hover, :focus-within) ~ * {
    translate: calc(var(--avatar-size) * 0.4) 0;
  }

  .avatars img {
    inline-size: var(--avatar-size);
    aspect-ratio: 1;
    border: 0.1875rem solid var(--color-surface);
    border-radius: 100vmax;
    object-fit: cover;
  }
}
`;

const avatarsGenerator: Generator = {
  description: 'create an overlapping .avatars list block',
  actions: (_answers, _helpers, ctx) => {
    paletteColors(ctx);
    return [{ add: FILE, template: AVATARS }, ...importActions(ctx, [FILE])];
  },
};

export default avatarsGenerator;
