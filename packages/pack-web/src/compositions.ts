/**
 * `web:compositions`: CUBE CSS compositions – layout primitives after Every
 * Layout (https://every-layout.dev) and SmolCSS (https://smolcss.dev), written
 * fresh – in the `compositions` layer: flow, cluster, repel, sidebar, switcher,
 * grid, wrapper, center, overlay, breakout, reel and gallery.
 * `--only=flow,cluster` picks some.
 *
 * Each is tuned with custom properties (`--gutter`, `--flow-space`,
 * `--sidebar-target`, …) that fall back to web:fluid's space tokens, then to
 * fixed rem values, so they work without either.
 *
 *   jen web:compositions [--only=flow,cluster,sidebar]
 */
import type { Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { importActions } from './entry.ts';

export const FILE = 'compositions.css';

const GUTTER = 'var(--gutter, var(--space-s-m, 1rem))';

export const COMPOSITIONS: Record<string, string> = {
  flow: `  /* Vertical rhythm between siblings; set --flow-space to change it. */
  .flow > * + * {
    margin-block-start: var(--flow-space, 1em);
  }`,
  cluster: `  /* Items that wrap as a group: tags, buttons, nav links. */
  .cluster {
    display: flex;
    flex-wrap: wrap;
    gap: ${GUTTER};
    justify-content: var(--cluster-justify, flex-start);
    align-items: var(--cluster-align, center);
  }`,
  repel: `  /* Two groups pushed to either end, stacking when there's no room. */
  .repel {
    display: flex;
    flex-wrap: wrap;
    gap: ${GUTTER};
    justify-content: space-between;
    align-items: var(--repel-align, center);
  }`,
  sidebar: `  /* A sidebar next to the content, stacking below --sidebar-content-min; data-direction="end" puts it last. */
  .sidebar {
    display: flex;
    flex-wrap: wrap;
    gap: ${GUTTER};
  }

  .sidebar > :first-child,
  .sidebar[data-direction="end"] > :last-child {
    flex-basis: var(--sidebar-target, 20rem);
    flex-grow: 1;
    min-inline-size: auto;
  }

  .sidebar > :last-child,
  .sidebar[data-direction="end"] > :first-child {
    flex-basis: 0;
    flex-grow: 999;
    min-inline-size: var(--sidebar-content-min, 50%);
  }`,
  switcher: `  /* Side by side above --switcher-threshold, stacked below; five or more items always stack. */
  .switcher {
    display: flex;
    flex-wrap: wrap;
    gap: ${GUTTER};
  }

  .switcher > * {
    flex-grow: 1;
    flex-basis: calc((var(--switcher-threshold, 30rem) - 100%) * 999);
  }

  .switcher > :nth-last-child(n + 5),
  .switcher > :nth-last-child(n + 5) ~ * {
    flex-basis: 100%;
  }`,
  grid: `  /* As many columns as fit, each at least --grid-min-item-size wide; few items stretch to fill the row. */
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--grid-placement, auto-fit), minmax(min(var(--grid-min-item-size, 16rem), 100%), 1fr));
    gap: ${GUTTER};
  }`,
  wrapper: `  /* Centered column up to --wrapper-max-width, never touching the viewport edges. */
  .wrapper {
    inline-size: min(100% - 2 * var(--wrapper-gutter, var(--space-s-l, 1rem)), var(--wrapper-max-width, 75rem));
    margin-inline: auto;
  }`,
  center: `  /* Content centered in both directions. */
  .center {
    display: grid;
    place-content: center;
  }`,
  overlay: `  /* Children layered on top of each other in one grid cell, e.g. text over an image. */
  .overlay {
    display: grid;
    grid-template-areas: "overlay";
  }

  .overlay > * {
    grid-area: overlay;
  }`,
  breakout: `  /* A text column whose children can break out: data-breakout="wide" or "full". */
  .breakout {
    --breakout-gutter: var(--space-s-l, 1rem);

    display: grid;
    grid-template-columns:
      [full-start] minmax(var(--breakout-gutter), 1fr)
      [wide-start] minmax(0, var(--breakout-wide, 10rem))
      [content-start] min(100% - 2 * var(--breakout-gutter), var(--breakout-max-width, 65ch))
      [content-end] minmax(0, var(--breakout-wide, 10rem))
      [wide-end] minmax(var(--breakout-gutter), 1fr)
      [full-end];
  }

  .breakout > * {
    grid-column: content;
  }

  .breakout > [data-breakout="wide"] {
    grid-column: wide;
  }

  .breakout > [data-breakout="full"] {
    grid-column: full;
  }`,
  reel: `  /* A horizontally scrolling row that snaps to its items. */
  .reel {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: var(--reel-item-size, min(80%, 20rem));
    gap: ${GUTTER};
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scroll-snap-type: inline mandatory;
    padding-block-end: var(--space-2xs, 0.5rem);
  }

  .reel > * {
    scroll-snap-align: center;
  }`,
  gallery: `  /* Media in rows of equal aspect ratio, cropped to fit. */
  .gallery {
    display: flex;
    flex-wrap: wrap;
    gap: ${GUTTER};
  }

  .gallery > * {
    flex: 1 1 var(--gallery-min-item-size, 12rem);
  }

  .gallery :is(img, video) {
    inline-size: 100%;
    block-size: auto;
    aspect-ratio: var(--gallery-ratio, 4 / 3);
    object-fit: cover;
  }`,
};

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

export const compositionsCss = (names: string[]): string => `/* CUBE CSS compositions: layout primitives after https://every-layout.dev and https://smolcss.dev */
@layer compositions {
${names.map((n) => COMPOSITIONS[n]).join('\n\n')}
}
`;

const compositionsGenerator: Generator = {
  description: 'create CUBE CSS compositions (flow, cluster, sidebar, grid, wrapper, breakout, reel, …)',
  params: { only: { default: '' } },
  actions: ({ only }, _helpers, ctx) => [{ add: FILE, template: compositionsCss(pickCompositions(String(only))) }, ...importActions(ctx, [FILE])],
};

export default compositionsGenerator;
