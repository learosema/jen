/** Generators that make something together, in order – `recipes` in `jen --list --json` and `jen --find`. */
import type { Recipe } from '@codejen/jen';
import { template } from './templates.ts';

export const DASHBOARD_MARKUP = template('recipes/dashboard.html').trimEnd();

export const recipes: Recipe[] = [
  {
    name: 'dashboard',
    description: 'a dashboard page: a header, a sidebar and a row of stat cards, from compositions and blocks',
    steps: ['web:cube --primary=#0d9488 --dir=css', 'web:card --dir=css', 'web:page --name=index --title=Dashboard'],
    usage: ['the page\'s <body> then takes this markup:', ...DASHBOARD_MARKUP.split('\n')],
    docs: 'https://learosema.github.io/jen/web.html#dashboard',
  },
];
