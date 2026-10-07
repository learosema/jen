/**
 * `web:tailwind`: sets up the stylesheet entry point for Tailwind v4 – Tailwind's
 * layers fitted into the CUBE CSS order, and `@import "tailwindcss"`. Run it
 * before web:palette and web:fluid (or web:cube), which then write their tokens
 * into Tailwind's @theme; an existing palette needs a re-run with --force.
 *
 * jen doesn't install anything: add `tailwindcss` and its build integration
 * (e.g. `@tailwindcss/vite`) yourself.
 *
 *   jen web:tailwind [--dir=src/css]
 */
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
