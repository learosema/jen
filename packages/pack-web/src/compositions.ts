/** Layout compositions after Every Layout (Heydon Pickering, Andy Bell) and SmolCSS (Stephanie Eckles): `web:flow`, `web:cluster`, … and `web:compositions` for several. */
import type { Generator } from '@codejen/jen';
import { fail, props } from './common.ts';
import { INTO_PARAMS, bulkActions, singleActions } from './single.ts';
import type { Item } from './single.ts';
import { fill, template } from './templates.ts';

/** Each composition, in the order `web:compositions` writes them – one template each in templates/compositions/. */
const DESCRIPTIONS: Record<string, string> = {
  flow: 'space the children of an element evenly, one below the other',
  cluster: 'wrap items in rows with even gaps, like tags or buttons',
  repel: 'push two items to opposite ends of a row, like a logo and a nav',
  sidebar: 'a sidebar next to the content that wraps below it when space runs out',
  switcher: 'items side by side that switch to one column when there\'s too little room',
  grid: 'a responsive grid with as many equal columns as fit',
  wrapper: 'center the content with a maximum width and room at the sides',
  center: 'center something horizontally and vertically',
  overlay: 'stack children on top of each other, like text over an image',
  breakout: 'a content column whose children can break out wide or full width',
  reel: 'a row that scrolls sideways and snaps to each item',
  gallery: 'a gallery of images or videos in one aspect ratio',
};

const GUTTER: [string, string] = ['--gutter: var(--space-s-m, 1rem)', 'the gap'];

/** How to use each one: its markup and the custom properties it reads, defaults from its template. */
const USAGE: Record<string, string[]> = {
  flow: [
    '<div class="flow"><h2>…</h2><p>…</p><p>…</p></div>',
    ...props('.flow', [['--flow-space: 1em', 'the space between the children – on one child, the space above it']]),
  ],
  cluster: [
    '<ul class="cluster" role="list"><li>…</li><li>…</li></ul>',
    ...props('.cluster', [['--cluster-justify: flex-start', 'where the rows line up: center, space-between …'], ['--cluster-align: center', 'how items line up across a row'], GUTTER]),
  ],
  repel: [
    '<header class="repel"><a href="/">…</a><nav>…</nav></header>',
    'the two children go to either end, and stack when there\'s no room for both',
    ...props('.repel', [['--repel-align: center', 'how they line up across the row'], GUTTER]),
  ],
  sidebar: [
    '<div class="sidebar"><aside>…</aside><main>…</main></div>',
    'the first child is the sidebar; data-direction="end" makes it the last',
    ...props('.sidebar', [
      ['--sidebar-target: 20rem', 'the sidebar\'s width'],
      ['--sidebar-content-min: 50%', 'the content\'s narrowest width before both stack'],
      GUTTER,
    ]),
  ],
  switcher: [
    '<div class="switcher"><div>…</div><div>…</div><div>…</div></div>',
    'five or more children always stack',
    ...props('.switcher', [['--switcher-threshold: 30rem', 'below this width, the children stack'], GUTTER]),
  ],
  grid: [
    '<ul class="grid" role="list"><li>…</li><li>…</li><li>…</li></ul>',
    ...props('.grid', [
      ['--grid-min-item-size: 16rem', 'each column\'s narrowest width: as many columns as fit'],
      ['--grid-placement: auto-fit', 'auto-fill keeps empty columns, so a few items don\'t stretch'],
      GUTTER,
    ]),
  ],
  wrapper: [
    '<main class="wrapper">…</main>',
    ...props('.wrapper', [['--wrapper-max-width: 75rem', 'the widest it gets'], ['--wrapper-gutter: var(--space-s-l, 1rem)', 'the least room at the sides']]),
  ],
  center: ['<div class="center" style="min-block-size: 100dvb">…</div>', 'centers its content in its own size, so give it one'],
  overlay: ['<div class="overlay"><img src="…" alt=""><h2>…</h2></div>', 'every child fills the same grid cell; later ones are on top'],
  breakout: [
    '<article class="breakout"><p>…</p><figure data-breakout="wide">…</figure><img data-breakout="full" src="…" alt=""></article>',
    'children stay in the text column; data-breakout="wide" or "full" lets one out',
    ...props('.breakout', [
      ['--breakout-max-width: 65ch', 'the text column'],
      ['--breakout-wide: 10rem', 'how far wide children reach past it on each side'],
      ['--breakout-gutter: var(--space-s-l, 1rem)', 'the least room at the sides – on .breakout itself'],
    ]),
  ],
  reel: ['<ul class="reel" role="list"><li>…</li><li>…</li></ul>', ...props('.reel', [['--reel-item-size: min(80%, 20rem)', 'each item\'s width'], GUTTER])],
  gallery: [
    '<ul class="gallery" role="list"><li><img src="…" alt="…"></li><li><img src="…" alt="…"></li></ul>',
    ...props('.gallery', [['--gallery-min-item-size: 12rem', 'each item\'s narrowest width'], ['--gallery-ratio: 4 / 3', 'the images\' and videos\' aspect ratio'], GUTTER]),
  ],
};

export const NAMES = Object.keys(DESCRIPTIONS);

export function compositionItem(name: string): Item {
  const rules = template(`compositions/${name}.css`).trimEnd();
  return { path: `compositions/${name}.css`, css: fill(template('compositions.css'), { compositions: rules }), rules, defines: `.${name}` };
}

/** The compositions `--only` names (all if empty). */
export function pickCompositions(only: string): string[] {
  const names = only
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const n of names) {
    if (!NAMES.includes(n)) fail(`web:compositions --only: unknown "${n}" – pick from ${NAMES.join(', ')}`);
  }
  return names.length ? NAMES.filter((n) => names.includes(n)) : NAMES;
}

const compositionGenerator = (name: string): Generator => ({
  description: `create a .${name} composition: ${DESCRIPTIONS[name]}`,
  params: INTO_PARAMS,
  usage: USAGE[name],
  examples: ['', '--dir=src/css', '--into=css/layout.css'],
  actions: ({ into }, _helpers, ctx) => singleActions(ctx, compositionItem(name), into),
});

export const compositionGenerators: Record<string, Generator> = Object.fromEntries(NAMES.map((n) => [n, compositionGenerator(n)]));

const compositionsGenerator: Generator = {
  description: 'create several compositions at once, one file each or all --into one (web:flow, web:cluster, …) – all by default',
  params: { only: { default: '', description: 'comma-separated compositions to pick, e.g. flow,cluster (default: all)' }, ...INTO_PARAMS },
  examples: ['', '--only=flow,cluster,sidebar', '--only=flow,cluster --into=css/layout.css'],
  actions: ({ only, into }, _helpers, ctx) => bulkActions(ctx, pickCompositions(String(only)).map(compositionItem), into),
};

export default compositionsGenerator;
