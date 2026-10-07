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
import { BASE, LAYERS, RESET } from './src/base.ts';

const helpers = {} as Helpers;

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
      { insert: '/src/css/styles.css', before: 'jen:imports', line: '@import url("tokens/palette.css");' },
    ]);
    assert.deepEqual(inserts(run('palette', { primary: '#00f' }, context(files, 'lib'))), [
      { insert: '/styles.css', before: 'jen:imports', line: '@import url("lib/palette.css");' },
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
    assert.match(entry, /@import url\("base.css"\);\n\/\* jen:imports \*\/\n$/);
    assert.equal(entry.split('jen:imports').length, 2, 'the marker appears once, so inserts land below the comment');
  });

  it('wires into an existing entry point instead of creating one', () => {
    const actions = run('base', {}, context({ 'main.css': '/* jen:imports */' }, 'css'));
    assert.deepEqual(added(actions), ['reset.css', 'base.css']);
    assert.deepEqual(
      inserts(actions).map((a) => 'line' in a && a.line),
      ['@import url("css/reset.css");', '@import url("css/base.css");'],
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
    assert.deepEqual(inserts(actions), [{ insert: '/css/styles.css', before: 'jen:imports', line: '@import url("button.css");' }]);
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
