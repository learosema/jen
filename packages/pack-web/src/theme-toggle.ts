/** `web:theme-toggle`: Light / Dark / System as three radio buttons, setting the palette's `data-theme`. */
import type { Generator } from '@codejen/jen';
import { paletteColors } from './button.ts';
import { importActions } from './entry.ts';
import { HEAD_END, intoPage, lineParam, lineParams } from './html.ts';
import { template } from './templates.ts';

export const FILE = 'theme-toggle.css';

export const TOGGLE_MARKUP = template('theme-toggle.html').trimEnd();
export const HEAD_SCRIPT = template('theme-toggle-head.html').trimEnd();

const themeToggleGenerator: Generator = {
  description: 'create a light / dark / system .theme-toggle: three radio buttons that set data-theme for the palette and remember it',
  params: lineParams(FILE),
  examples: ['--into=index.html', '--into=index.html --line="</nav>"'],
  usage: [
    '<fieldset class="theme-toggle"><legend>Theme</legend><label><input type="radio" name="theme" value="light"> Light</label> … dark, system</fieldset>',
    'a script after it sets data-theme="light" or "dark" on <html> (none for system) and stores it in localStorage',
    'a script in <head> applies the stored choice before the first paint – --into adds both',
  ],
  actions: (answers, _helpers, ctx) => {
    paletteColors(ctx, 'web:theme-toggle');
    const into = String(answers.into);
    const at = lineParam('web:theme-toggle', answers, ctx);
    return [
      { add: FILE, template: template(FILE) },
      ...importActions(ctx, [FILE]),
      ...(into ? [...intoPage(into, [HEAD_SCRIPT], HEAD_END), ...intoPage(into, [TOGGLE_MARKUP], at)] : []),
    ];
  },
};

export default themeToggleGenerator;
