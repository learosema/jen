/** `web:scroll`: scroll-driven reading progress, reveal and parallax. */
import type { Generator } from '@codejen/jen';
import { importActions } from './entry.ts';
import { template } from './templates.ts';
import { intoPage } from './html.ts';

export const FILE = 'scroll.css';

export const SCROLL = template('scroll.css');

export const PROGRESS_MARKUP = '<div class="reading-progress" aria-hidden="true"></div>';

const scrollGenerator: Generator = {
  description: 'create scroll-driven animations: reading progress, reveal, parallax',
  params: {
    into: { path: true, default: '' },
  },
  actions: ({ into }, _helpers, ctx) => [
    { add: FILE, template: SCROLL },
    ...importActions(ctx, [FILE]),
    ...(into ? intoPage(String(into), [PROGRESS_MARKUP]) : []),
  ],
};

export default scrollGenerator;
