/** `web:tailwind`: the stylesheet entry point for Tailwind v4, its layers fitted into the CUBE CSS order. */
import type { Generator } from '@codejen/jen';
import { ENTRY, IMPORTS_MARKER, TAILWIND_IMPORT, entryCss, findEntry } from './entry.ts';

/** An entry's layer line in either order pack-web has written – utilities before blocks is the older one – keeping its order. */
const OUR_LAYERS = /^@layer reset, tokens, base, compositions, (utilities, blocks|blocks, utilities), exceptions;$/m;

const tailwindGenerator: Generator = {
  description: 'set up the stylesheet entry point for Tailwind v4 (layers in CUBE CSS order)',
  examples: ['--dir=src/css'],
  actions: (_answers, _helpers, ctx) => {
    const entry = findEntry(ctx);
    if (!entry) return [{ add: ENTRY, template: entryCss([], true) }];
    return [
      { modify: `/${entry}`, pattern: OUR_LAYERS, replace: '@layer theme, reset, tokens, base, compositions, components, $1, exceptions;' },
      { insert: `/${entry}`, before: IMPORTS_MARKER, line: TAILWIND_IMPORT },
    ];
  },
};

export default tailwindGenerator;
