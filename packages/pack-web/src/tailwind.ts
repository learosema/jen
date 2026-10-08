/** `web:tailwind`: the stylesheet entry point for Tailwind v4, its layers fitted into the CUBE CSS order. */
import type { Generator } from '@codejen/jen';
import { ENTRY, IMPORTS_MARKER, LAYERS, TAILWIND_IMPORT, entryCss, findEntry, layerLine } from './entry.ts';

const tailwindGenerator: Generator = {
  description: 'set up the stylesheet entry point for Tailwind v4 (layers in CUBE CSS order)',
  actions: (_answers, _helpers, ctx) => {
    const entry = findEntry(ctx);
    if (!entry) return [{ add: ENTRY, template: entryCss([], true) }];
    return [
      { modify: `/${entry}`, pattern: new RegExp(`^@layer ${LAYERS.join(', ')};$`, 'm'), replace: layerLine(true) },
      { insert: `/${entry}`, before: IMPORTS_MARKER, line: TAILWIND_IMPORT },
    ];
  },
};

export default tailwindGenerator;
