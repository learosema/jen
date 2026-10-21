/** `web:popover`: a `.popover` anchored to its trigger. */
import type { Generator } from '@codejen/jen';
import { importActions } from './entry.ts';
import { props } from './common.ts';
import { fill, template } from './templates.ts';
import { LINE_PARAMS, lineParam, sentence, triggerAndElement } from './html.ts';

export const FILE = 'popover.css';

export const POPOVER = template('popover.css');

/** The button that toggles the popover, and the popover. */
export const popoverMarkup = (id: string): [string, string] => [
  fill(template('popover-button.html'), { id, label: sentence(id) }).trimEnd(),
  fill(template('popover.html'), { id }).trimEnd(),
];

const popoverGenerator: Generator = {
  description: 'create an anchored .popover block (and with --into, a button that toggles it, and the popover)',
  params: {
    name: { description: 'id, and the label from it: user-menu makes "User menu"' },
    ...LINE_PARAMS,
  },
  examples: ['--name=user-menu --into=index.html'],
  usage: [
    '<button type="button" popovertarget="menu" style="anchor-name: --menu">…</button>',
    '<div id="menu" class="popover" popover style="position-anchor: --menu">…</div>',
    'the anchor name ties the popover to its button; without anchor positioning, it opens centered',
    ...props([['--popover-offset: 0.25rem', 'the gap to the button'], ['--popover-radius: 0.5rem', 'the corners']]),
  ],
  actions: (answers, { kebab }, ctx) => {
    const at = lineParam('web:popover', answers, ctx);
    return [
      { add: FILE, template: POPOVER },
      ...importActions(ctx, [FILE]),
      ...(answers.into ? triggerAndElement(String(answers.into), popoverMarkup(kebab(String(answers.name))), at) : []),
    ];
  },
};

export default popoverGenerator;
