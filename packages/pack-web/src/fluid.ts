/**
 * `web:fluid`: Utopia-style fluid type and space scales (https://utopia.fyi)
 * as custom properties – `--step--2` … `--step-5` and `--space-3xs` …
 * `--space-3xl`, plus one-up pairs (`--space-s-m`, …) and `--space-s-l`.
 *
 * Every size is a clamp() between its value at `--minWidth` and at
 * `--maxWidth`, all in rem: the rem part of the formula keeps text zoomable.
 * Sizes may grow at most 2.5× across the range – beyond that, browser zoom
 * can't reach 200% text size (WCAG 1.4.4), so the generator refuses.
 *
 *   jen web:fluid [--minWidth=20 --maxWidth=77.5] [--minSize=1.125 --maxSize=1.25]
 *                 [--minRatio=1.2 --maxRatio=1.25] [--tailwind]
 */
import type { Answers, Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { importActions, usesTailwind } from './entry.ts';

export const FILE = 'fluid.css';

export const STEPS = [-2, -1, 0, 1, 2, 3, 4, 5];

/** Space sizes as multiples of step 0. */
export const SPACE: [string, number][] = [
  ['3xs', 0.25],
  ['2xs', 0.5],
  ['xs', 0.75],
  ['s', 1],
  ['m', 1.5],
  ['l', 2],
  ['xl', 3],
  ['2xl', 4],
  ['3xl', 6],
];

/** Largest growth across the range that still lets zoom reach 200% (Adrian Roselli's rule of thumb for WCAG 1.4.4). */
const MAX_GROWTH = 2.5;

/** A positive number flag, in rem where it's a length: "20" or "20rem". */
function num(answers: Answers, flag: string, unit: 'rem' | ''): number {
  const raw = String(answers[flag]).trim();
  if (/px$/.test(raw)) fail(`web:fluid --${flag}: "${raw}" – use rem (16px = 1rem at the default font size)`);
  const n = Number(unit ? raw.replace(/rem$/, '') : raw);
  if (!Number.isFinite(n) || n <= 0) fail(`web:fluid --${flag}: "${raw}" is not a positive number`);
  return n;
}

const round = (n: number): number => Number(n.toFixed(4));

/** A clamp() growing from `min` at `minWidth` to `max` at `maxWidth` (all rem). */
export function fluid(minWidth: number, maxWidth: number, min: number, max: number): string {
  const slope = (max - min) / (maxWidth - minWidth);
  const intercept = min - slope * minWidth;
  const vi = round(slope * 100);
  const preferred = vi === 0 ? `${round(intercept)}rem` : `${round(intercept)}rem ${vi < 0 ? '-' : '+'} ${Math.abs(vi)}vi`;
  return `clamp(${round(Math.min(min, max))}rem, ${preferred}, ${round(Math.max(min, max))}rem)`;
}

export interface Scale {
  minWidth: number;
  maxWidth: number;
  steps: [string, string][];
  space: [string, string][];
}

export function scaleFor(answers: Answers): Scale {
  const minWidth = num(answers, 'minWidth', 'rem');
  const maxWidth = num(answers, 'maxWidth', 'rem');
  const minSize = num(answers, 'minSize', 'rem');
  const maxSize = num(answers, 'maxSize', 'rem');
  const minRatio = num(answers, 'minRatio', '');
  const maxRatio = num(answers, 'maxRatio', '');
  if (minWidth >= maxWidth) fail(`web:fluid: --minWidth (${minWidth}) must be below --maxWidth (${maxWidth})`);

  const at = (size: [number, number], name: string): string => {
    const [min, max] = size;
    if (Math.max(min, max) / Math.min(min, max) > MAX_GROWTH) {
      fail(`web:fluid: ${name} grows from ${round(min)}rem to ${round(max)}rem, more than ${MAX_GROWTH}× – zoom couldn't reach 200% text size (WCAG 1.4.4); pick closer sizes or ratios`);
    }
    return fluid(minWidth, maxWidth, min, max);
  };

  const steps = STEPS.map((n): [string, string] => [`step-${n}`, at([minSize * minRatio ** n, maxSize * maxRatio ** n], `--step-${n}`)]);
  const size = (k: number): [number, number] => [minSize * k, maxSize * k];
  const space: [string, string][] = SPACE.map(([name, k]) => [`space-${name}`, at(size(k), `--space-${name}`)]);
  // One-up pairs (xs-s, s-m, …) grow from the smaller size to the next one up; s-l is Utopia's custom default.
  const pairs = SPACE.slice(1).map(([b, kb], i): [string, string] => {
    const [a, ka] = SPACE[i];
    return [`space-${a}-${b}`, at([minSize * ka, maxSize * kb], `--space-${a}-${b}`)];
  });
  pairs.push(['space-s-l', at([minSize, maxSize * 2], '--space-s-l')]);
  return { minWidth, maxWidth, steps, space: [...space, ...pairs] };
}

/** The scales as custom properties; with `tailwind`, also mapped into Tailwind's `--text-*` and `--spacing-*` (`text-step-1`, `p-s-m`). */
export function fluidCss(answers: Answers, tailwind = false): string {
  const { minWidth, maxWidth, steps, space } = scaleFor(answers);
  const decl = (list: [string, string][]) => list.map(([name, value]) => `    --${name}: ${value};`).join('\n');
  const theme = `
@theme inline {
${steps.map(([name]) => `  --text-${name}: var(--${name});`).join('\n')}

${space.map(([name]) => `  --spacing-${name.slice('space-'.length)}: var(--${name});`).join('\n')}
}
`;
  return `/* Fluid type and space (https://utopia.fyi), ${minWidth}rem to ${maxWidth}rem viewport width. */
@layer tokens {
  :root {
${decl(steps)}

${decl(space)}
  }
}
${tailwind ? theme : ''}`;
}

export const FLUID_PARAMS = {
  minWidth: { default: '20' },
  maxWidth: { default: '77.5' },
  minSize: { default: '1.125' },
  maxSize: { default: '1.25' },
  minRatio: { default: '1.2' },
  maxRatio: { default: '1.25' },
  tailwind: { default: false },
};

const fluidGenerator: Generator = {
  description: 'create fluid type and space scales (Utopia-style clamp() tokens)',
  params: FLUID_PARAMS,
  actions: (answers, _helpers, ctx) => [
    { add: FILE, template: fluidCss(answers, Boolean(answers.tailwind) || usesTailwind(ctx)) },
    ...importActions(ctx, [FILE]),
  ],
};

export default fluidGenerator;
