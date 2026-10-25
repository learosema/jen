/** Generators that make something together, in order – `recipes` in `jen --list --json` and `jen --find`. */
import type { Recipe } from '@codejen/jen';
import { layoutMarkup } from './page.ts';

export const DASHBOARD_MARKUP = layoutMarkup('dashboard', 'Acme', 'Dashboard');

export const recipes: Recipe[] = [
  {
    name: 'dashboard',
    description: 'a dashboard page: a header, a sidebar and a row of stat cards, from compositions and blocks',
    steps: [
      'web:cube --primary=#0d9488 --dir=css',
      'web:card --dir=css',
      'web:nav --dir=css',
      'web:stat --dir=css',
      'web:page --name=index --title=Dashboard --site=Acme --layout=dashboard',
    ],
    usage: ['web:page --layout=dashboard writes this <body>, with --site in the header and --title as the <h1>; then replace the placeholder content:', ...DASHBOARD_MARKUP.split('\n')],
    docs: 'https://learosema.github.io/jen/web.html#dashboard',
  },
];
