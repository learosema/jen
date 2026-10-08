/** `web:compositions`: layout primitives after Every Layout (Heydon Pickering, Andy Bell) and SmolCSS (Stephanie Eckles). */
import type { Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { importActions } from './entry.ts';
import { fill, template } from './templates.ts';

export const FILE = 'compositions.css';

/** The compositions, in the order they're written – one file each in templates/compositions/. */
const NAMES = ['flow', 'cluster', 'repel', 'sidebar', 'switcher', 'grid', 'wrapper', 'center', 'overlay', 'breakout', 'reel', 'gallery'];

export const COMPOSITIONS: Record<string, string> = Object.fromEntries(NAMES.map((n) => [n, template(`compositions/${n}.css`)]));

/** The compositions `--only` names (all if empty). */
export function pickCompositions(only: string): string[] {
  const names = only
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const n of names) {
    if (!(n in COMPOSITIONS)) fail(`web:compositions --only: unknown "${n}" – pick from ${Object.keys(COMPOSITIONS).join(', ')}`);
  }
  return names.length ? Object.keys(COMPOSITIONS).filter((n) => names.includes(n)) : Object.keys(COMPOSITIONS);
}

export const compositionsCss = (names: string[]): string =>
  fill(template('compositions.css'), { compositions: names.map((n) => COMPOSITIONS[n].trimEnd()).join('\n\n') });

const compositionsGenerator: Generator = {
  description: 'create CUBE CSS compositions (flow, cluster, sidebar, grid, wrapper, breakout, reel, …)',
  params: { only: { default: '' } },
  actions: ({ only }, _helpers, ctx) => [{ add: FILE, template: compositionsCss(pickCompositions(String(only))) }, ...importActions(ctx, [FILE])],
};

export default compositionsGenerator;
