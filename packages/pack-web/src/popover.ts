/** `web:popover`: a `.popover` anchored to its trigger. */
import type { Generator } from '@codejen/jen';
import { importActions } from './entry.ts';
import { fill, template } from './templates.ts';
import { intoPage, sentence } from './html.ts';

export const FILE = 'popover.css';

export const POPOVER = template('popover.css');

export const popoverMarkup = (id: string): string => fill(template('popover.html'), { id, label: sentence(id) }).trimEnd();

const popoverGenerator: Generator = {
  description: 'create an anchored .popover block (and its markup with --into)',
  params: {
    name: {},
    into: { path: true, default: '' },
  },
  actions: ({ name, into }, { kebab }, ctx) => [
    { add: FILE, template: POPOVER },
    ...importActions(ctx, [FILE]),
    ...(into ? intoPage(String(into), [popoverMarkup(kebab(String(name)))]) : []),
  ],
};

export default popoverGenerator;
