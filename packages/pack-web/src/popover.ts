/** `web:popover`: a `.popover` anchored to its trigger. */
import type { Generator } from '@codejen/jen';
import { importActions } from './entry.ts';
import { fill, template } from './templates.ts';
import { LINE_PARAMS, intoPage, lineParam, sentence } from './html.ts';

export const FILE = 'popover.css';

export const POPOVER = template('popover.css');

export const popoverMarkup = (id: string): string => fill(template('popover.html'), { id, label: sentence(id) }).trimEnd();

const popoverGenerator: Generator = {
  description: 'create an anchored .popover block (and its markup with --into)',
  params: {
    name: {},
    ...LINE_PARAMS,
  },
  actions: (answers, { kebab }, ctx) => {
    const at = lineParam('web:popover', answers, ctx);
    return [
      { add: FILE, template: POPOVER },
      ...importActions(ctx, [FILE]),
      ...(answers.into ? intoPage(String(answers.into), [popoverMarkup(kebab(String(answers.name)))], at) : []),
    ];
  },
};

export default popoverGenerator;
