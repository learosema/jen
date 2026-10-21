/** `web:dialog`: a modal `.dialog`, opened through the command API. */
import type { Generator } from '@codejen/jen';
import { importActions } from './entry.ts';
import { props } from './common.ts';
import { fill, template } from './templates.ts';
import { lineParam, lineParams, sentence, triggerAndElement } from './html.ts';

export const FILE = 'dialog.css';

export const DIALOG = template('dialog.css');

/** The button that opens the dialog, and the dialog. */
export const dialogMarkup = (id: string, title: string): [string, string] => [
  fill(template('dialog-button.html'), { id, title }).trimEnd(),
  fill(template('dialog.html'), { id, title }).trimEnd(),
];

const dialogGenerator: Generator = {
  description: 'create a modal .dialog block (and with --into, a button that opens it via the command API, and the dialog)',
  params: {
    name: { description: 'id, and the title from it: settings makes "Settings"' },
    ...lineParams(FILE, 'dialog'),
  },
  examples: ['--name=confirm-delete --into=index.html'],
  usage: [
    '<button type="button" commandfor="confirm" command="show-modal">…</button>',
    '<dialog id="confirm" class="dialog" aria-labelledby="confirm-title" closedby="any"><h2 id="confirm-title">…</h2>…</dialog>',
    'command="close" on a button inside closes it; closedby="any" lets a click outside close it too',
    ...props('.dialog', [['--dialog-max-width: 32rem', 'the widest it gets'], ['--dialog-radius: 0.75rem', 'the corners']]),
  ],
  actions: (answers, { kebab }, ctx) => {
    const id = kebab(String(answers.name));
    const into = String(answers.into);
    const at = lineParam('web:dialog', answers, ctx);
    return [
      { add: FILE, template: DIALOG },
      ...importActions(ctx, [FILE]),
      ...(into ? triggerAndElement(into, dialogMarkup(id, sentence(id)), at) : []),
    ];
  },
};

export default dialogGenerator;
