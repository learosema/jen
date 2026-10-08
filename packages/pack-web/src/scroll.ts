/** `web:scroll`: scroll-driven reading progress, reveal and parallax. */
import type { Generator } from '@codejen/jen';
import { importActions } from './entry.ts';
import { template } from './templates.ts';
import { LINE_PARAMS, intoPage, lineParam } from './html.ts';

export const FILE = 'scroll.css';

export const SCROLL = template('scroll.css');

export const PROGRESS_MARKUP = '<div class="reading-progress" aria-hidden="true"></div>';

const scrollGenerator: Generator = {
  description: 'create scroll-driven animations: reading progress, reveal, parallax',
  params: LINE_PARAMS,
  actions: (answers, _helpers, ctx) => {
    const at = lineParam('web:scroll', answers, ctx);
    return [
      { add: FILE, template: SCROLL },
      ...importActions(ctx, [FILE]),
      ...(answers.into ? intoPage(String(answers.into), [PROGRESS_MARKUP], at) : []),
    ];
  },
};

export default scrollGenerator;
