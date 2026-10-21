/** Layout compositions after Every Layout (Heydon Pickering, Andy Bell) and SmolCSS (Stephanie Eckles): `web:flow`, `web:cluster`, … and `web:compositions` for several. */
import type { Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { INTO_PARAMS, bulkActions, singleActions } from './single.ts';
import type { Item } from './single.ts';
import { fill, template } from './templates.ts';

/** Each composition, in the order `web:compositions` writes them – one template each in templates/compositions/. */
const DESCRIPTIONS: Record<string, string> = {
  flow: 'space the children of an element evenly, one below the other (.flow)',
  cluster: 'wrap items in rows with even gaps, like tags or buttons (.cluster)',
  repel: 'push two items to opposite ends of a row, like a logo and a nav (.repel)',
  sidebar: 'a sidebar next to the content that wraps below it when space runs out (.sidebar)',
  switcher: 'items side by side that switch to one column when there\'s too little room (.switcher)',
  grid: 'a responsive grid with as many equal columns as fit (.grid)',
  wrapper: 'center the content with a maximum width and room at the sides (.wrapper)',
  center: 'center something horizontally and vertically (.center)',
  overlay: 'stack children on top of each other, like text over an image (.overlay)',
  breakout: 'a content column whose children can break out wide or full width (.breakout)',
  reel: 'a row that scrolls sideways and snaps to each item (.reel)',
  gallery: 'a gallery of images or videos in one aspect ratio (.gallery)',
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
  description: DESCRIPTIONS[name],
  params: INTO_PARAMS,
  examples: ['', '--dir=src/css', '--into=css/layout.css'],
  actions: ({ into }, _helpers, ctx) => singleActions(ctx, `web:${name}`, compositionItem(name), into),
});

export const compositionGenerators: Record<string, Generator> = Object.fromEntries(NAMES.map((n) => [n, compositionGenerator(n)]));

const compositionsGenerator: Generator = {
  description: 'create several compositions at once, one file each or all --into one (web:flow, web:cluster, …) – all by default',
  params: { only: { default: '', description: 'comma-separated compositions to pick, e.g. flow,cluster (default: all)' }, ...INTO_PARAMS },
  examples: ['', '--only=flow,cluster,sidebar', '--only=flow,cluster --into=css/layout.css'],
  actions: ({ only, into }, _helpers, ctx) => bulkActions(ctx, pickCompositions(String(only)).map(compositionItem), into),
};

export default compositionsGenerator;
