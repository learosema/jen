/**
 * Tests for @codejen/pack-web – the color math, the palette's contrast
 * guarantees over many inputs, and each generator's actions against a small
 * in-memory project (a stand-in for jen's Context, so the tests don't need
 * jen's dist built first).
 */
import assert from 'node:assert/strict';
import { posix } from 'node:path';
import { describe, it } from 'node:test';
import type { Action, Answers, Context, Helpers } from '@codejen/jen';
import pack from './src/index.ts';
import { DISTANCE_RATIO, SHADES, contrast, hexToOklch, luminance, parseColor, targetLuminance } from './src/color.ts';
import { groupsFor, paletteCss, rolesFor, verify } from './src/palette.ts';
import { buttonCss } from './src/button.ts';
import { BASE, RESET } from './src/base.ts';
import { LAYERS } from './src/entry.ts';
import { COMPOSITIONS } from './src/compositions.ts';
import { fluid } from './src/fluid.ts';
import { COMMANDS_JS } from './src/html.ts';
import { tokensFrom } from './src/utilities.ts';
import { fill } from './src/templates.ts';
import { Script } from 'node:vm';

const words = (s: string): string[] => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_\-./]+/).filter(Boolean);
/** The one jen helper these generators use. */
const helpers = { kebab: (s: string) => words(s).map((w) => w.toLowerCase()).join('-') } as Helpers;

/** A Context over an in-memory project; `destDir` is where the user stands (or --dir). */
function context(files: Record<string, string>, destDir = '.'): Context {
  const paths = Object.keys(files);
  return {
    root: '/project',
    cwd: destDir,
    destDir,
    exists: (p) => p in files,
    isDir: (p) => paths.some((f) => f.startsWith(`${p}/`)),
    read: (p) => files[p] ?? null,
    readdir: (dir) =>
      [...new Set(paths.filter((f) => dir === '.' || f.startsWith(`${dir}/`)).map((f) => (dir === '.' ? f : f.slice(dir.length + 1)).split('/')[0]))].sort(),
    findUp: () => null,
    grep: (name, text) =>
      paths
        .filter((f) => (typeof name === 'string' ? posix.basename(f) === name : name.test(posix.basename(f))))
        .filter((f) => !text || files[f].includes(text))
        .sort((a, b) => a.split('/').length - b.split('/').length),
  };
}

function run(generator: string, answers: Answers, ctx: Context): Action[] {
  const g = pack[generator];
  const defaults = Object.fromEntries(Object.entries(g.params ?? {}).map(([k, p]) => [k, p.default]));
  return g.actions({ ...defaults, ...answers }, helpers, ctx);
}

const added = (actions: Action[]) => actions.flatMap((a) => ('add' in a ? [a.add] : []));
const inserts = (actions: Action[]) => actions.flatMap((a) => ('insert' in a ? [a] : []));
const template = (actions: Action[], file: string) => {
  const a = actions.find((x) => 'add' in x && x.add === file);
  return a && 'template' in a ? a.template : assert.fail(`no ${file} added`);
};

const PX = /\d\s*px\b/;

describe('color math', () => {
  it('measures WCAG contrast', () => {
    assert.equal(contrast('#000000', '#ffffff').toFixed(2), '21.00');
    assert.equal(contrast('#777777', '#ffffff').toFixed(2), '4.48');
    assert.equal(luminance('#fff'), 1);
  });

  it('parses hex, oklch() and bare hues', () => {
    assert.ok(Math.abs(hexToOklch('#ffffff').l - 1) < 1e-6);
    assert.deepEqual(parseColor('oklch(60% 0.15 264)', '--x'), { l: 0.6, c: 0.15, h: 264 });
    assert.deepEqual(parseColor('oklch(0.6 0.15 264deg)', '--x'), { l: 0.6, c: 0.15, h: 264 });
    assert.equal(parseColor('390', '--x').h, 30);
    assert.throws(() => parseColor('rebeccapurple', '--primary'), /--primary: "rebeccapurple" is not a color/);
  });

  it('spaces shades so the distances leave headroom', () => {
    for (const [distance, ratio] of Object.entries(DISTANCE_RATIO)) {
      for (let n = 1; n + Number(distance) <= SHADES; n++) {
        const got = (targetLuminance(n) + 0.05) / (targetLuminance(n + Number(distance)) + 0.05);
        assert.ok(got > ratio * 1.02, `shade ${n} vs ${n + Number(distance)}: ${got}`);
      }
    }
  });
});

describe('web:palette', () => {
  it('keeps every shade distance and role pair across many hues and both levels', () => {
    const colors = ['#5b5bd6', '#ff0000', '#ffff00', '#00ff00', '#0000ff', '#00ffff', '#ff00ff', '#888888', '#000000', '#ffffff', 'oklch(0.9 0.37 120)'];
    for (let h = 0; h < 360; h += 15) colors.push(String(h));
    for (const level of ['aa', 'aaa'] as const) {
      for (let i = 0; i < colors.length; i++) {
        const answers = { primary: colors[i], secondary: colors[(i + 3) % colors.length], tertiary: colors[(i + 7) % colors.length], contrast: level };
        const groups = groupsFor(answers);
        assert.doesNotThrow(() => verify(groups, rolesFor(groups, level), level), `${level} ${JSON.stringify(answers)}`);
      }
    }
  });

  it('writes shades, role tokens with light-dark() and a fallback', () => {
    const actions = run('palette', { primary: '#5b5bd6', secondary: '330' }, context({}));
    const css = template(actions, 'palette.css');
    for (const g of ['primary', 'secondary', 'neutral', 'success', 'warning', 'danger', 'info']) {
      for (let n = 1; n <= SHADES; n++) assert.match(css, new RegExp(`--color-${g}-${n}: #[0-9a-f]{6};`));
    }
    assert.doesNotMatch(css, /--color-tertiary/);
    assert.match(css, /--color-surface: light-dark\(var\(--color-neutral-1\), var\(--color-neutral-6\)\);/);
    assert.match(css, /--color-primary: light-dark\(var\(--color-primary-5\), var\(--color-primary-2\)\);/);
    assert.match(css, /--color-primary-large: light-dark\(var\(--color-primary-4\), var\(--color-primary-3\)\);/);
    assert.match(css, /--color-primary-subtle: light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\);/, 'tints between shades are literal colors');
    assert.match(css, /@supports not \(color: light-dark\(#000, #fff\)\)/);
    assert.match(css, /`jen web:palette --primary=#5b5bd6 --secondary=330`/);
    assert.doesNotMatch(css, PX);
  });

  it('relaxes roles to shades 3 apart with --contrast=aa', () => {
    const css = paletteCss({ primary: '#5b5bd6', contrast: 'aa' });
    assert.match(css, /--color-primary: light-dark\(var\(--color-primary-4\), var\(--color-primary-3\)\);/);
    assert.match(css, /--color-primary-large: light-dark\(var\(--color-primary-3\), var\(--color-primary-4\)\);/);
    assert.match(css, /--contrast=aa`/);
    assert.throws(() => paletteCss({ primary: '#5b5bd6', contrast: 'aaaa' }), /use aa or aaa/);
  });

  it('wires itself into the nearest entry point, relative to it', () => {
    const files = { 'src/css/styles.css': '@import url("base.css");\n/* jen:imports */\n', 'styles.css': '/* jen:imports */\n' };
    assert.deepEqual(inserts(run('palette', { primary: '#00f' }, context(files, 'src/css/tokens'))), [
      { insert: '/src/css/styles.css', before: 'jen:imports', line: '@import "./tokens/palette.css";' },
    ]);
    assert.deepEqual(inserts(run('palette', { primary: '#00f' }, context(files, 'lib'))), [
      { insert: '/styles.css', before: 'jen:imports', line: '@import "./lib/palette.css";' },
    ]);
  });

  it('leaves the wiring to a Find target (shown as skipped) without an entry point', () => {
    const [insert] = inserts(run('palette', { primary: '#00f' }, context({})));
    assert.equal(typeof insert.insert, 'object');
  });
});

describe('web:base', () => {
  it('creates the entry point with the CUBE CSS layer order', () => {
    const actions = run('base', {}, context({}));
    assert.deepEqual(added(actions), ['styles.css', 'reset.css', 'base.css']);
    const entry = template(actions, 'styles.css');
    assert.match(entry, new RegExp(`@layer ${LAYERS.join(', ')};`));
    assert.match(entry, /@import "\.\/base.css";\n\/\* jen:imports \*\/\n$/);
    assert.equal(entry.split('jen:imports').length, 2, 'the marker appears once, so inserts land below the comment');
  });

  it('wires into an existing entry point instead of creating one', () => {
    const actions = run('base', {}, context({ 'main.css': '/* jen:imports */' }, 'css'));
    assert.deepEqual(added(actions), ['reset.css', 'base.css']);
    assert.deepEqual(
      inserts(actions).map((a) => 'line' in a && a.line),
      ['@import "./css/reset.css";', '@import "./css/base.css";'],
    );
  });

  it('keeps scroll gutters stable and uses no px', () => {
    assert.match(BASE, /scrollbar-gutter: stable;/);
    assert.match(RESET, /@layer reset/);
    assert.doesNotMatch(BASE + RESET, PX);
  });
});

describe('web:button', () => {
  it('fails clearly without a palette', () => {
    assert.throws(() => run('button', {}, context({})), /run `jen web:palette --primary=<color>` first/);
  });

  it('adds a modifier per brand color the palette has, plus danger', () => {
    const palette = paletteCss({ primary: '#5b5bd6', tertiary: '120', contrast: 'aa' });
    const actions = run('button', {}, context({ 'css/palette.css': palette, 'css/styles.css': '/* jen:imports */' }, 'css'));
    const css = template(actions, 'button.css');
    assert.match(css, /\.button--tertiary \{/);
    assert.match(css, /\.button--danger \{/);
    assert.doesNotMatch(css, /\.button--secondary/);
    assert.match(css, /@layer blocks/);
    assert.deepEqual(inserts(actions), [{ insert: '/css/styles.css', before: 'jen:imports', line: '@import "./button.css";' }]);
  });

  it('only uses role tokens the palette defines, and no px', () => {
    const colors = ['primary', 'secondary', 'tertiary', 'neutral', 'success', 'warning', 'danger', 'info'];
    const palette = paletteCss({ primary: '#5b5bd6', secondary: '330', tertiary: '120', contrast: 'aa' });
    const css = buttonCss(colors);
    for (const [, token] of css.matchAll(/var\((--color-[a-z0-9-]+)\)/g)) assert.match(palette, new RegExp(`${token}:`), token);
    assert.doesNotMatch(css, PX);
    assert.match(css, /border-radius: 100vmax;/);
  });
});

describe('web:fluid', () => {
  const css = (answers: Answers = {}) => template(run('fluid', answers, context({})), 'fluid.css');

  it('matches Utopia for its default scale', () => {
    assert.match(css(), /--step-0: clamp\(1\.125rem, 1\.0815rem \+ 0\.2174vi, 1\.25rem\);/);
    assert.match(css(), /--step--2: clamp\(/);
    assert.match(css(), /--space-s-m: clamp\(1\.125rem, /);
    assert.match(css(), /--space-s-l: /);
    assert.doesNotMatch(css(), PX);
  });

  it('handles shrinking sizes and flat ones', () => {
    assert.equal(fluid(20, 80, 2, 1), 'clamp(1rem, 2.3333rem - 1.6667vi, 2rem)');
    assert.equal(fluid(20, 80, 1, 1), 'clamp(1rem, 1rem, 1rem)');
  });

  it('refuses px, inverted ranges and growth that breaks zoom', () => {
    assert.throws(() => css({ minWidth: '320px' }), /use rem/);
    assert.throws(() => css({ minWidth: '80', maxWidth: '20' }), /must be below/);
    assert.throws(() => css({ maxSize: '4' }), /WCAG 1\.4\.4/);
    assert.doesNotThrow(() => css({ minWidth: '20rem', maxWidth: '90rem' }));
  });
});

describe('web:compositions', () => {
  it('writes all compositions, or those --only names', () => {
    const all = template(run('compositions', {}, context({})), 'compositions.css');
    for (const name of Object.keys(COMPOSITIONS)) assert.match(all, new RegExp(`\\.${name}\\b`));
    assert.match(all, /@layer compositions/);
    assert.doesNotMatch(all, PX);
    const some = template(run('compositions', { only: 'cluster, flow' }, context({})), 'compositions.css');
    assert.match(some, /\.flow > \* \+ \*/);
    assert.doesNotMatch(some, /\.sidebar/);
    assert.throws(() => run('compositions', { only: 'stack' }, context({})), /unknown "stack"/);
  });
});

describe('web:utilities', () => {
  const palette = paletteCss({ primary: '#5b5bd6', contrast: 'aaa' });
  const fluidCss = template(run('fluid', {}, context({})), 'fluid.css');

  it('builds classes from the tokens the project has', () => {
    const css = template(run('utilities', {}, context({ 'css/palette.css': palette, 'css/fluid.css': fluidCss })), 'utilities.css');
    assert.match(css, /\.color-text-muted \{\n {4}color: var\(--color-text-muted\);/);
    assert.match(css, /\.bg-primary-subtle \{/);
    assert.doesNotMatch(css, /--color-primary-3\b/, 'no utilities for raw shades');
    assert.match(css, /\.step--1 \{\n {4}font-size: var\(--step--1\);/);
    assert.match(css, /\.flow-space-s-m \{\n {4}--flow-space: var\(--space-s-m\);/);
    assert.match(css, /\.visually-hidden/);
    assert.doesNotMatch(css, PX);
    const colorsOnly = template(run('utilities', {}, context({ 'palette.css': palette })), 'utilities.css');
    assert.doesNotMatch(colorsOnly, /\.step-/);
  });

  it('needs tokens, and steps aside for Tailwind', () => {
    assert.throws(() => run('utilities', {}, context({})), /run `jen web:palette/);
    assert.throws(() => run('utilities', {}, context({ 'app.css': '@import "tailwindcss";', 'palette.css': palette })), /Tailwind/);
  });

  it('finds tokens after comments, and stays fast on hostile input', () => {
    const tokens = tokensFrom(':root {\n  /* brand */\n  --color-primary: light-dark(#06c, #6af);\n}', '/* x */ --space-s: 1rem; --step-0: 1rem;');
    assert.deepEqual(tokens, { roles: ['primary'], steps: ['0'], space: ['s'] });
    const start = performance.now();
    tokensFrom('--color-'.repeat(50_000), '--space-'.repeat(50_000));
    assert.ok(performance.now() - start < 1000, 'no quadratic backtracking');
  });
});

describe('web:cube', () => {
  it('sets up the whole starter with one entry point', () => {
    const actions = run('cube', {}, context({}));
    assert.deepEqual(added(actions), ['styles.css', 'reset.css', 'base.css', 'fluid.css', 'compositions.css', 'utilities.css']);
    const entry = template(actions, 'styles.css');
    for (const f of added(actions).slice(1)) assert.match(entry, new RegExp(`@import "\\./${f}";`));
  });

  it('adds the palette and buttons with --primary, and their utilities', () => {
    const actions = run('cube', { primary: '#5b5bd6', secondary: '330' }, context({}));
    assert.deepEqual(added(actions), ['styles.css', 'reset.css', 'base.css', 'palette.css', 'fluid.css', 'compositions.css', 'utilities.css', 'button.css']);
    assert.match(template(actions, 'utilities.css'), /\.bg-secondary \{/);
    assert.match(template(actions, 'button.css'), /\.button--secondary \{/);
  });

  it('wires into an existing entry point', () => {
    const actions = run('cube', {}, context({ 'main.css': '/* jen:imports */' }));
    assert.ok(!added(actions).includes('styles.css'));
    assert.equal(inserts(actions).length, 5);
  });
});

describe('Tailwind v4', () => {
  const twEntry = { 'css/styles.css': `@layer ${LAYERS.join(', ')};\n\n@import "./base.css";\n/* jen:imports */\n` };

  it('web:tailwind creates an entry point with Tailwind fitted into the CUBE CSS layers', () => {
    const entry = template(run('tailwind', {}, context({})), 'styles.css');
    assert.match(entry, /^@layer theme, reset, tokens, base, compositions, components, utilities, blocks, exceptions;$/m);
    assert.match(entry, /@import "tailwindcss";\n\/\* jen:imports \*\//);
  });

  it('web:tailwind converts an existing entry point', () => {
    const actions = run('tailwind', {}, context(twEntry, 'css'));
    const [modify, insert] = actions;
    assert.ok('modify' in modify && modify.pattern.test(twEntry['css/styles.css']));
    assert.deepEqual(insert, { insert: '/css/styles.css', before: 'jen:imports', line: '@import "tailwindcss";' });
  });

  it('web:palette writes @theme in a Tailwind project, dropping Tailwind\'s colors', () => {
    const css = template(run('palette', { primary: '#5b5bd6' }, context({ 'app.css': '@import "tailwindcss";' })), 'palette.css');
    assert.match(css, /@theme \{\n {2}--color-\*: initial;\n\}/);
    assert.match(css, /@theme static \{\n {2}--color-primary-1: #[0-9a-f]{6};/);
    assert.match(css, /^ {2}--color-surface: light-dark\(/m);
    assert.doesNotMatch(css, /@layer tokens/);
    assert.match(css, /^@supports not \(color: light-dark/m, 'the fallback stays unlayered to beat @theme');
    assert.match(paletteCss({ primary: '#5b5bd6', contrast: 'aaa' }, true), /--tailwind`/);
  });

  it('web:fluid maps its scales into Tailwind\'s namespaces', () => {
    const css = template(run('fluid', { tailwind: true }, context({})), 'fluid.css');
    assert.match(css, /@theme inline \{\n {2}--text-step--2: var\(--step--2\);/);
    assert.match(css, /--spacing-s-m: var\(--space-s-m\);/);
    assert.doesNotMatch(template(run('fluid', {}, context({})), 'fluid.css'), /@theme/);
  });

  it('web:cube --tailwind leaves utilities to Tailwind', () => {
    const actions = run('cube', { primary: '#5b5bd6', tailwind: true }, context({}));
    assert.ok(!added(actions).includes('utilities.css'));
    assert.match(template(actions, 'styles.css'), /@import "tailwindcss";/);
    assert.match(template(actions, 'palette.css'), /@theme static/);
  });
});

describe('SmolCSS techniques', () => {
  const palette = { 'css/palette.css': paletteCss({ primary: '#5b5bd6', contrast: 'aaa' }), 'css/styles.css': '/* jen:imports */' };

  it('web:compositions has the intrinsic grid and container, breakout, overlay, reel and gallery', () => {
    const css = template(run('compositions', {}, context({})), 'compositions.css');
    assert.match(css, /repeat\(var\(--grid-placement, auto-fit\), minmax\(min\(/);
    assert.match(css, /\.wrapper \{\n {4}inline-size: min\(100% - 2 \* /);
    assert.match(css, /\.breakout > \[data-breakout="full"\]/);
    assert.match(css, /grid-template-areas: "overlay";/);
    assert.match(css, /scroll-snap-type: inline mandatory;/);
    assert.match(css, /\.gallery :is\(img, video\)/);
  });

  it('web:base has transition tokens that respect reduced motion, :visited and marker icons', () => {
    assert.match(BASE, /--transition-duration: 0s;/);
    assert.match(BASE, /a:visited \{/);
    assert.match(BASE, /content: attr\(data-icon\) "\\00a0";/);
  });

  it('web:card and web:avatars need a palette and wire themselves in', () => {
    for (const name of ['card', 'avatars']) {
      assert.throws(() => run(name, {}, context({})), /run `jen web:palette/);
      const actions = run(name, {}, context(palette, 'css'));
      const css = template(actions, `${name}.css`);
      assert.match(css, /@layer blocks/);
      assert.doesNotMatch(css, PX);
      assert.deepEqual(inserts(actions), [{ insert: '/css/styles.css', before: 'jen:imports', line: `@import "./${name}.css";` }]);
    }
  });

  it('web:card and web:avatars only use role tokens the palette checks', () => {
    for (const name of ['card', 'avatars']) {
      const css = template(run(name, {}, context(palette, 'css')), `${name}.css`);
      for (const [, token] of css.matchAll(/var\((--color-[a-z0-9-]+)\)/g)) assert.match(palette['css/palette.css'], new RegExp(`${token}:`), token);
    }
  });

  it('web:utilities adds .pad-fluid and .unbreakable', () => {
    const css = template(run('utilities', {}, context(palette)), 'utilities.css');
    assert.match(css, /\.pad-fluid \{\n {4}padding: clamp\(/);
    assert.match(css, /\.unbreakable \{/);
  });
});

describe('platform features', () => {
  const page = { 'index.html': '<!doctype html>\n<html>\n  <body>\n    <main></main>\n  </body>\n</html>\n', 'css/styles.css': '/* jen:imports */' };

  it('web:dialog writes the block, and with --into the markup plus the command fallback', () => {
    const actions = run('dialog', { name: 'confirmDelete', into: '/index.html' }, context(page, 'css'));
    assert.deepEqual(added(actions), ['dialog.css', '/commands.js']);
    const [markup, script] = inserts(actions).filter((a) => a.insert === '/index.html');
    assert.ok('line' in markup && markup.line.includes('<button class="button" commandfor="confirm-delete" command="show-modal">Confirm delete</button>'));
    assert.ok('line' in markup && markup.line.includes('<dialog id="confirm-delete" class="dialog" aria-labelledby="confirm-delete-title" closedby="any">'));
    assert.deepEqual(markup.before, /<\/body>/);
    assert.ok('line' in script && script.line === '<script type="module" src="./commands.js"></script>');
    const css = template(actions, 'dialog.css');
    assert.match(css, /@starting-style/);
    assert.match(css, /margin: auto;/);
    assert.doesNotMatch(css, PX);
    assert.deepEqual(added(run('dialog', { name: 'x' }, context(page, 'css'))), ['dialog.css'], 'no markup without --into');
  });

  it('commands.js runs the commands in browsers without the command API', () => {
    const calls: string[] = [];
    const target = { showModal: () => calls.push('showModal'), close: (v: string) => calls.push(`close:${v}`), togglePopover: () => calls.push('togglePopover') };
    let onClick: (e: unknown) => void = () => assert.fail('no listener');
    class Element {
      attrs: Record<string, string>;
      constructor(attrs: Record<string, string>) {
        this.attrs = attrs;
      }
      value = 'ok';
      getAttribute(name: string) {
        return this.attrs[name];
      }
      closest() {
        return this;
      }
    }
    const sandbox = {
      Element,
      HTMLButtonElement: { prototype: {} },
      document: { addEventListener: (_: string, fn: (e: unknown) => void) => (onClick = fn), getElementById: () => target },
    };
    new Script(COMMANDS_JS).runInNewContext(sandbox);
    for (const command of ['show-modal', 'close', 'toggle-popover']) onClick({ target: new Element({ commandfor: 'x', command }) });
    assert.deepEqual(calls, ['showModal', 'close:ok', 'togglePopover']);
  });

  it('web:popover anchors to its trigger where supported', () => {
    const actions = run('popover', { name: 'menu', into: '/index.html' }, context(page, 'css'));
    const css = template(actions, 'popover.css');
    assert.match(css, /@supports \(position-area: block-end\) \{\n {4}\.popover \{\n {6}inset: auto;/);
    assert.match(css, /position-try-fallbacks: flip-block, flip-inline;/);
    assert.doesNotMatch(css, PX);
    const [markup] = inserts(actions).filter((a) => a.insert === '/index.html');
    assert.ok('line' in markup && markup.line.includes('popovertarget="menu" style="anchor-name: --menu"'));
    assert.ok('line' in markup && markup.line.includes('<div id="menu" class="popover" popover style="position-anchor: --menu">'));
  });

  it('web:scroll hides and moves nothing without support or with reduced motion', () => {
    const css = template(run('scroll', {}, context(page, 'css')), 'scroll.css');
    assert.match(css, /^@supports \(animation-timeline: view\(\)\) \{\n {2}@media \(prefers-reduced-motion: no-preference\) \{/m);
    assert.match(css, /animation-timeline: scroll\(root\);/);
    assert.doesNotMatch(css, PX);
    const withPage = run('scroll', { into: '/index.html' }, context(page, 'css'));
    assert.ok(inserts(withPage).some((a) => 'line' in a && a.line === '<div class="reading-progress" aria-hidden="true"></div>'));
  });

  it('web:transitions turns on cross-document transitions, sliding with --style=slide', () => {
    const fade = template(run('transitions', {}, context(page, 'css')), 'transitions.css');
    assert.match(fade, /@media \(prefers-reduced-motion: no-preference\) \{\n {2}@view-transition \{\n {4}navigation: auto;\n {2}\}\n\}\n$/);
    const slide = run('transitions', { style: 'slide', spa: true }, context(page, 'css'));
    assert.match(template(slide, 'transitions.css'), /::view-transition-new\(root\) \{\n {4}animation: view-slide-in/);
    assert.match(template(slide, 'view-transition.js'), /document\.startViewTransition\(update\)/);
    assert.throws(() => run('transitions', { style: 'zoom' }, context(page, 'css')), /use fade or slide/);
  });

  it('the reset keeps the margins dialogs and popovers center with', () => {
    assert.match(RESET, /dialog,\n {2}\[popover\] \{\n {4}margin: auto;/);
  });
});

describe('web:page', () => {
  const project = {
    'css/styles.css': '/* jen:imports */',
    'css/palette.css': paletteCss({ primary: '#5b5bd6', contrast: 'aaa' }),
    'public/favicon.svg': '<svg/>',
  };

  it('links the entry point, palette colors and existing icons, relative to the page', () => {
    const html = template(run('page', { name: 'About', site: 'My Site', script: '/src/main.js' }, context(project, 'pages')), 'about.html');
    assert.match(html, /^<!doctype html>\n<!-- After the HTML boilerplate by Manuel Matuzović, https:\/\/matuzo\.at\/blog\/html-boilerplate\/ -->\n<html lang="en" class="no-js">/);
    assert.match(html, /<title>About – My Site<\/title>/);
    assert.match(html, /classList\.replace\('no-js', 'js'\)/);
    assert.match(html, /<link rel="stylesheet" href="\.\.\/css\/styles\.css">/);
    assert.match(html, /<link rel="icon" href="\.\.\/favicon\.svg" type="image\/svg\+xml">/);
    assert.doesNotMatch(html, /favicon\.ico|apple-touch-icon|manifest/, 'only icons that exist');
    assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: dark\)">/);
    assert.match(html, /<script type="module" src="\.\.\/src\/main\.js"><\/script>\n {2}<\/body>/);
    assert.doesNotMatch(html, /canonical|og:url|og:image/, 'no address-bound tags without --url');
  });

  it('adds canonical, og:url, og:image and og:locale when it knows them', () => {
    const html = template(run('page', { name: 'index', lang: 'en-GB', url: 'https://example.com/', image: 'og.png', imageAlt: 'A "mountain"' }, context({})), 'index.html');
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/example\.com\/og\.png">/);
    assert.match(html, /<meta property="og:image:alt" content="A &quot;mountain&quot;">/);
    assert.match(html, /<meta property="og:locale" content="en_GB">/);
    assert.doesNotMatch(html, /stylesheet|theme-color/, 'nothing to link without an entry point or palette');
  });
});

describe('templates', () => {
  it('fill() drops lines with a null value and indents multi-line values', () => {
    const text = 'a {\n  {{body}}\n}\n<x y="{{y}}">\n<meta z="{{z}}">\n';
    assert.equal(fill(text, { body: 'b: 1;\n\nc: 2;', y: '1', z: null }), 'a {\n  b: 1;\n\n  c: 2;\n}\n<x y="1">\n');
  });

  it('fill() tidies the blank lines dropped lines leave behind', () => {
    assert.equal(fill('a\n\n{{x}}\n\nb\n', { x: null }), 'a\n\nb\n');
    assert.equal(fill('<head>\n  <a>\n\n  {{x}}\n</head>\n', { x: null }), '<head>\n  <a>\n</head>\n');
  });

  it('fill() refuses a placeholder without a value', () => {
    assert.throws(() => fill('{{missing}}', {}), /\{\{missing\}\} has no value/);
  });
});

describe('--line', () => {
  const page = { 'index.html': '<body>\n  <header></header>\n</body>\n', 'css/styles.css': '/* jen:imports */' };

  it('puts the markup before that line, and scripts still before </body>', () => {
    const actions = run('dialog', { name: 'confirm', into: '/index.html', line: '2' }, context(page, 'css'));
    const [markup, script] = inserts(actions).filter((a) => a.insert === '/index.html');
    assert.equal(markup.before, 2);
    assert.deepEqual(script.before, /<\/body>/);
    assert.equal(inserts(run('popover', { name: 'menu', into: '/index.html', line: '2' }, context(page, 'css')))[1].before, 2);
    assert.equal(inserts(run('scroll', { into: '/index.html', line: '3' }, context(page, 'css')))[1].before, 3);
  });

  it('defaults to before </body>, and refuses lines that make no sense', () => {
    assert.deepEqual(inserts(run('popover', { name: 'menu', into: '/index.html' }, context(page, 'css')))[1].before, /<\/body>/);
    assert.throws(() => run('popover', { name: 'menu', line: '2' }, context(page, 'css')), /--line: needs --into/);
    assert.throws(() => run('popover', { name: 'menu', into: '/index.html', line: 'top' }, context(page, 'css')), /"top" is not a line number/);
    assert.throws(() => run('scroll', { into: '/index.html', line: '0' }, context(page, 'css')), /"0" is not a line number/);
    assert.throws(() => run('dialog', { name: 'x', into: '/index.html', line: '40' }, context(page, 'css')), /index\.html has 3 lines, there is no line 40/);
    assert.equal(inserts(run('scroll', { into: '/index.html', line: '4' }, context(page, 'css')))[1].before, 4, 'one past the end appends');
  });
});
