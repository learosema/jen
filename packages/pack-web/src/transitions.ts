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
    style: { default: 'fade', choices: ['fade', 'slide'], description: 'fade (the browser\'s crossfade) or slide' },
    spa: { default: false, description: 'also add view-transition.js for same-document transitions in a single-page app' },
  },
  examples: ['', '--style=slide --spa'],
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
