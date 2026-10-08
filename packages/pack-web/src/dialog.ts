/** `web:dialog`: a modal `.dialog`, opened through the command API. */
import type { Generator } from '@codejen/jen';
import { importActions } from './entry.ts';
import { fill, template } from './templates.ts';
import { commandsFallback, intoPage, sentence } from './html.ts';

export const FILE = 'dialog.css';

export const DIALOG = template('dialog.css');

export const dialogMarkup = (id: string, title: string): string => fill(template('dialog.html'), { id, title }).trimEnd();

const dialogGenerator: Generator = {
  description: 'create a modal .dialog block (and its markup, opened via the command API, with --into)',
  params: {
    name: {},
    into: { path: true, default: '' },
  },
  actions: ({ name, into }, { kebab }, ctx) => {
    const id = kebab(String(name));
    return [
      { add: FILE, template: DIALOG },
      ...importActions(ctx, [FILE]),
      ...(into ? [...intoPage(String(into), [dialogMarkup(id, sentence(id))]), ...commandsFallback(String(into))] : []),
    ];
  },
};

export default dialogGenerator;
