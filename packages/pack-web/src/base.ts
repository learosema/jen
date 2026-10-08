/** `web:base`: the stylesheet entry point, reset and base styles. */
import type { Generator } from '@codejen/jen';
import { wireEntry } from './entry.ts';
import { template } from './templates.ts';

export const RESET = template('reset.css');

export const BASE = template('base.css');

const baseGenerator: Generator = {
  description: 'create the stylesheet entry point (CUBE CSS layers), a modern reset and base styles',
  actions: (_answers, _helpers, ctx) =>
    wireEntry(ctx, [
      { add: 'reset.css', template: RESET },
      { add: 'base.css', template: BASE },
    ]),
};

export default baseGenerator;
