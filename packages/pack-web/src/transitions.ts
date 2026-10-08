/** `web:transitions`: view transitions between pages, and a same-document helper. */
import type { Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { importActions } from './entry.ts';
import { template } from './templates.ts';

export const FILE = 'transitions.css';
export const SCRIPT = 'view-transition.js';

export const transitionsCss = (style: string): string => template(`transitions-${style}.css`);

export const SPA_JS = template('view-transition.js');

const transitionsGenerator: Generator = {
  description: 'create view transitions between pages (and a same-document helper with --spa)',
  params: {
    style: { default: 'fade' },
    spa: { default: false },
  },
  actions: ({ style, spa }, _helpers, ctx) => {
    if (style !== 'fade' && style !== 'slide') fail(`web:transitions --style: "${style}" – use fade or slide`);
    return [
      { add: FILE, template: transitionsCss(String(style)) },
      ...importActions(ctx, [FILE]),
      ...(spa ? [{ add: SCRIPT, template: SPA_JS }] : []),
    ];
  },
};

export default transitionsGenerator;
