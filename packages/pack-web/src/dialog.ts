/** `web:dialog`: a modal `.dialog`, opened through the command API. */
import type { Generator } from '@codejen/jen';
import { importActions } from './entry.ts';
import { fill, template } from './templates.ts';
import { LINE_PARAMS, commandsFallback, intoPage, lineParam, sentence } from './html.ts';

export const FILE = 'dialog.css';

export const DIALOG = template('dialog.css');

export const dialogMarkup = (id: string, title: string): string => fill(template('dialog.html'), { id, title }).trimEnd();

const dialogGenerator: Generator = {
  description: 'create a modal .dialog block (and its markup, opened via the command API, with --into)',
  params: {
    name: {},
    ...LINE_PARAMS,
  },
  actions: (answers, { kebab }, ctx) => {
    const id = kebab(String(answers.name));
    const into = String(answers.into);
    const at = lineParam('web:dialog', answers, ctx);
    return [
      { add: FILE, template: DIALOG },
      ...importActions(ctx, [FILE]),
      ...(into ? [...intoPage(into, [dialogMarkup(id, sentence(id))], at), ...commandsFallback(into)] : []),
    ];
  },
};

export default dialogGenerator;
