/** Blocks for app UIs, one file each: `web:nav`, `web:badge`, `web:stat`, `web:table`, `web:list`, `web:field`. */
import type { Generator } from '@codejen/jen';
import { paletteColors } from './button.ts';
import { props } from './common.ts';
import { importActions } from './entry.ts';
import { intoPage, lineParam, lineParams } from './html.ts';
import { BADGE_MODIFIERS, modifierCss } from './modifiers.ts';
import { fill, template } from './templates.ts';

/** One color modifier per color the palette has, besides primary (the default): `.badge--success` … */
export function badgeCss(colors: string[]): string {
  return fill(template('badge.css'), { 'color-modifiers': modifierCss(BADGE_MODIFIERS, colors) });
}

export const NAV_MARKUP = template('nav.html').trimEnd();

interface Block {
  description: string;
  usage: string[];
  examples?: string[];
  /** The CSS, from the palette's colors. */
  css?: (colors: string[]) => string;
  /** Markup `--into` adds to a page. */
  markup?: string;
}

const BLOCKS: Record<string, Block> = {
  nav: {
    description: 'create a .nav block: links in a row or a column, the current page marked by aria-current',
    usage: [
      '<nav class="nav" aria-label="Main"><ul role="list"><li><a href="/" aria-current="page">Home</a></li><li><a href="/about">About</a></li></ul></nav>',
      'data-direction="vertical" on .nav stacks the links, e.g. in a sidebar',
      ...props('.nav', [['--nav-gap: 0.25em', 'the space between the links'], ['--nav-radius: 0.375em', 'the corners of a link\'s background']]),
    ],
    examples: ['--dir=css', '--into=index.html --line="<main"'],
    markup: NAV_MARKUP,
  },
  badge: {
    description: 'create a .badge block: a small label for a status, count or tag, in each palette color',
    usage: [
      '<span class="badge">New</span>  <span class="badge badge--success">Paid</span>',
      'colors: badge--neutral, and badge--secondary, --tertiary, --success, --warning, --danger, --info – those the palette has',
      'your own color sets these in a modifier – a -strong on its -subtle stays on a checked pair:',
      ...props('.badge--mine', [['--badge-bg: var(--color-primary-subtle)', 'the background'], ['--badge-fg: var(--color-primary-strong)', 'the text']]),
    ],
    css: badgeCss,
  },
  stat: {
    description: 'create a .stat block: a metric with its label and a trend, the direction in words, not color alone',
    usage: [
      '<article class="stat"><p class="stat__label">Visitors</p><p class="stat__value">12,480</p><p class="stat__trend" data-trend="up">+4 % since last week</p></article>',
      'data-trend="up", "down" or "flat" colors the trend and adds an arrow; the text says which way',
      'in a .card: <article class="card stat">…</article>',
      ...props('.stat', [['--stat-value-size: var(--step-3, 2rem)', 'the value\'s size'], ['--stat-gap: 0.25em', 'the space between the lines']]),
    ],
  },
  table: {
    description: 'create a .table block: readable data tables in a scroll region, numbers aligned, optional stripes and sticky header',
    usage: [
      '<div class="table-scroll" role="region" aria-labelledby="sales" tabindex="0"><table class="table"><caption id="sales">…</caption><thead>…</thead><tbody>…</tbody></table></div>',
      'the region scrolls a wide table sideways and can be scrolled with the keyboard; its name comes from the caption',
      'numbers: <td data-numeric>1,234</td> aligns them at the end; table--striped tints every other row',
      ...props('.table-scroll', [['--table-max-height: 20rem', 'scrolls the rows too, under a sticky header (default: none)']]),
      ...props('.table', [['--table-padding: 0.5em 0.75em', 'the cells\' padding'], ['--table-head-bg: var(--color-surface-2)', 'the header\'s background in a .card']]),
    ],
  },
  list: {
    description: 'create a .list block: a list without bullets, for feeds and settings – with list--divided, lines between the items',
    usage: [
      '<ul class="list list--divided" role="list"><li>…</li><li>…</li></ul>',
      'role="list" keeps it a list for screen readers in Safari, which drops it without bullets',
      ...props('.list', [['--list-space: 0.75em', 'the space above and below each item']]),
    ],
  },
  field: {
    description: 'create a .field block: a form control with its label above, a hint and an error message',
    usage: [
      '<div class="field"><label for="email">Email</label><p class="field__hint" id="email-hint">…</p><input id="email" type="email" aria-describedby="email-hint"></div>',
      'an error: <p class="field__error" id="email-error">…</p> before the input, aria-invalid="true" and its id in aria-describedby on it',
      'a checkbox or radio: <div class="field field--check"><input id="terms" type="checkbox"><label for="terms">…</label></div>',
      ...props('.field', [['--field-width: 20rem', 'the control\'s widest (default: the full width)'], ['--field-gap: 0.375em', 'the space between label, hint and control']]),
    ],
  },
};

const blockGenerator = (name: string, block: Block): Generator => ({
  description: block.description,
  ...(block.markup && { params: lineParams(`${name}.css`) }),
  usage: block.usage,
  examples: block.examples ?? ['--dir=css'],
  actions: (answers, _helpers, ctx) => {
    const colors = paletteColors(ctx, `web:${name}`);
    const file = `${name}.css`;
    const into = String(answers.into ?? '');
    const at = block.markup ? lineParam(`web:${name}`, answers, ctx) : null;
    return [
      { add: file, template: block.css ? block.css(colors) : template(file) },
      ...importActions(ctx, [file]),
      ...(into && block.markup ? intoPage(into, [block.markup], at) : []),
    ];
  },
});

export const BLOCK_NAMES = Object.keys(BLOCKS);

export const blockGenerators: Record<string, Generator> = Object.fromEntries(BLOCK_NAMES.map((n) => [n, blockGenerator(n, BLOCKS[n])]));
