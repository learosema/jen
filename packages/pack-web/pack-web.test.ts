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
import pack, { recipes } from './src/index.ts';
import { DASHBOARD_MARKUP } from './src/recipes.ts';
import { DISTANCE_RATIO, SHADES, contrast, hexToOklch, luminance, oklchToHex, parseColor, targetLuminance } from './src/color.ts';
import { groupsFor, paletteCss, rolesFor, verify } from './src/palette.ts';
import { buttonCss } from './src/button.ts';
import { BASE, RESET } from './src/base.ts';
import { LAYERS } from './src/entry.ts';
import { NAMES as COMPOSITIONS } from './src/compositions.ts';
import { fluid } from './src/fluid.ts';
import { tokensFrom } from './src/utilities.ts';
import { fill } from './src/templates.ts';
import { Script } from 'node:vm';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { hexColor, maskableSvg, paletteColor } from './src/manifest.ts';
import { findConverter, iconSvg } from './src/png.ts';

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
    findUp: (name, text, from = '.') => {
      for (let dir = from; ; dir = posix.dirname(dir)) {
        const file = dir === '.' ? name : `${dir}/${name}`;
        if (file in files && (!text || files[file].includes(text))) return file;
        if (dir === '.') return null;
      }
    },
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
/** The plan's `info:` lines: `file note`. */
const notes = (actions: Action[]) => actions.flatMap((a) => ('note' in a ? [`${a.file ?? ''} ${a.note}`.trim()] : []));
const lines = (actions: Action[]) => inserts(actions).map((a) => ('line' in a ? a.line : ''));
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

  it('parses any CSS color and bare hues', () => {
    assert.ok(Math.abs(hexToOklch('#ffffff').l - 1) < 1e-6);
    assert.deepEqual(parseColor('oklch(60% 0.15 264)', '--x'), { l: 0.6, c: 0.15, h: 264 });
    assert.deepEqual(parseColor('oklch(0.6 0.15 264deg)', '--x'), { l: 0.6, c: 0.15, h: 264 });
    assert.equal(parseColor('390', '--x').h, 30);
    const hex = (spec: string) => oklchToHex(parseColor(spec, '--x'));
    for (const spec of ['deeppink', 'DeepPink', '#ff1493', '#f19', '#ff149380', 'rgb(255, 20, 147)', 'rgba(255,20,147,.5)', 'rgb(255 20 147 / 50%)', 'rgb(100% 7.843% 57.647%)', 'color(srgb 1 0.07843 0.57647)']) {
      assert.equal(hex(spec), spec === '#f19' ? '#ff1199' : '#ff1493', spec);
    }
    for (const spec of ['hsl(340, 100%, 60%)', 'hsla(340deg 100% 60% / .3)', 'hsl(0.94444turn 100 60)', 'hwb(340 20% 0%)']) assert.equal(hex(spec), '#ff3377', spec);
    for (const spec of ['red', 'lab(54.29 80.8 69.89)', 'lch(54.29 106.84 40.85)', 'oklab(0.628 0.2249 0.1258)', 'oklch(62.8% 0.2577 29.23)', 'color(xyz-d65 0.4124 0.2126 0.0193)']) {
      assert.equal(hex(spec), '#ff0000', spec);
    }
    assert.equal(parseColor('264deg', '--x').h, 264);
    assert.throws(() => parseColor('bleu', '--primary'), /--primary: can't read "bleu" as a color\. Any CSS color works – deeppink, #f37/);
    assert.throws(() => parseColor('rgb(1, 2)', '--primary'), /can't read "rgb\(1, 2\)"/);
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
    const named = template(run('palette', { primary: 'deeppink', secondary: 'rgb(255 51 119)' }, context({})), 'palette.css');
    assert.match(named, /`jen web:palette --primary=deeppink --secondary='rgb\(255 51 119\)'`/, 'quoted so the command runs as written');
    const plain = run('palette', { primary: 'blue' }, context({})).find((a) => 'insert' in a);
    assert.match(JSON.stringify(plain), /palette\.css isn't imported anywhere yet: @import it yourself, or run jen web:base/);
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

describe('where new CSS lands', () => {
  const palette = paletteCss({ primary: '#5b5bd6', contrast: 'aa' });
  const project = { 'css/styles.css': '/* jen:imports */', 'css/palette.css': palette };

  it('says when the entry point is in another folder and --dir would put the file next to it', () => {
    const actions = run('card', {}, context(project));
    assert.deepEqual(lines(actions), ['@import "../card.css";']);
    assert.deepEqual(notes(actions), ['styles.css is in css/ – pass --dir=css to put card.css next to it']);
    assert.ok(notes(run('cube', {}, context(project))).includes('styles.css is in css/ – pass --dir=css to put the new files next to it'));
  });

  it('says nothing with --dir, below the entry, or for a file --into placed', () => {
    assert.deepEqual(notes(run('card', {}, { ...context(project, 'css'), cwd: '.' })), []);
    assert.deepEqual(notes(run('card', {}, context(project, 'css/blocks'))), []);
    assert.deepEqual(notes(run('flow', { into: '/layout.css' }, context(project))), []);
  });

  it('says when the entry already imports a file of that name from elsewhere', () => {
    const before = { ...project, 'css/styles.css': '@import "../card.css";\n/* jen:imports */' };
    const actions = run('card', {}, { ...context(before, 'css'), cwd: '.' });
    assert.deepEqual(lines(actions), ['@import "./card.css";']);
    assert.deepEqual(notes(actions), ['/css/styles.css also imports "../card.css" – drop that line if it\'s an old copy of card.css']);
  });

  it('names the generator that needs a palette', () => {
    assert.throws(() => run('card', {}, context({})), /^Error: web:card needs a palette/);
    assert.throws(() => run('avatars', {}, context({})), /^Error: web:avatars needs a palette/);
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
  it('has one generator per composition, each writing its own file and @import', () => {
    for (const name of COMPOSITIONS) {
      const actions = run(name, {}, context({ 'css/styles.css': '/* jen:imports */' }, 'css'));
      assert.deepEqual(added(actions), [`compositions/${name}.css`]);
      const css = template(actions, `compositions/${name}.css`);
      assert.match(css, new RegExp(`^@layer compositions \\{\\n {2}/\\* After .*\\n {2}\\.${name}\\b`));
      assert.doesNotMatch(css, PX);
      assert.deepEqual(lines(actions), [`@import "./compositions/${name}.css";`]);
    }
  });

  it('only notes one the project already has elsewhere, but lets jen skip or --force its own file', () => {
    const old = { 'css/compositions.css': '@layer compositions {\n  .flow > * + * {\n    margin: 0;\n  }\n}\n' };
    assert.deepEqual(run('flow', {}, context(old)), [{ note: '.flow is already here, nothing to add', file: '/css/compositions.css' }]);
    assert.doesNotThrow(() => run('flow', {}, context({ 'old.css': '.flow-space-s { --flow-space: 1rem; }' })), '.flow-space-s is no .flow');
    assert.deepEqual(added(run('flow', {}, context({ 'compositions/flow.css': template(run('flow', {}, context({})), 'compositions/flow.css') }))), ['compositions/flow.css']);
  });

  it('writes several at once: all, or those --only names, minus what the project has', () => {
    assert.deepEqual(added(run('compositions', {}, context({}))), ['styles.css', ...COMPOSITIONS.map((n) => `compositions/${n}.css`)]);
    const some = run('compositions', { only: 'cluster, flow' }, context({ 'styles.css': '/* jen:imports */' }));
    assert.deepEqual(added(some), ['compositions/flow.css', 'compositions/cluster.css']);
    assert.deepEqual(lines(some), ['@import "./compositions/flow.css";', '@import "./compositions/cluster.css";']);
    const mine = run('compositions', { only: 'flow,grid' }, context({ 'styles.css': '/* jen:imports */', 'mine.css': '.grid {}' }));
    assert.deepEqual(added(mine), ['compositions/flow.css']);
    assert.deepEqual(notes(mine), ['/mine.css .grid is already here, nothing to add']);
    assert.throws(() => run('compositions', { only: 'stack' }, context({})), /unknown "stack"/);
  });
});

describe('recipes', () => {
  it('call generators that exist, with flags they have', () => {
    for (const r of recipes) {
      for (const step of r.steps) {
        const [name, ...flags] = step.split(' ');
        const g = pack[name.replace(/^web:/, '')];
        assert.ok(g, `${r.name}: ${name}`);
        for (const flag of flags) assert.ok(/^--(\w+)/.exec(flag)![1] in (g.params ?? {}) || flag.startsWith('--dir='), `${r.name}: ${flag}`);
      }
    }
  });

  it('dashboard: the docs show the same markup', () => {
    const docs = readFileSync(new URL('../../docs/web.md', import.meta.url), 'utf8');
    assert.ok(docs.includes(`\`\`\`html\n${DASHBOARD_MARKUP}\n\`\`\``));
  });
});

describe('brand color notes', () => {
  it('say which shade the color is closest to, which roles use it, and what --contrast=aa changes', () => {
    assert.deepEqual(notes(run('palette', { primary: '#0d9488' }, context({}))), [
      '#0d9488 is closest to --color-primary-3 (--color-primary-large in dark mode); buttons and links use the darker -5 in light mode, -4 with --contrast=aa',
    ]);
    assert.ok(notes(run('cube', { primary: '#0d9488' }, context({}))).some((n) => n.startsWith('#0d9488 is closest to --color-primary-3')));
  });

  it('stay quiet when the color is the buttons\' shade, for a bare hue, and without a palette', () => {
    assert.deepEqual(notes(run('palette', { primary: '#5b5bd6', contrast: 'aa' }, context({}))), []);
    assert.deepEqual(notes(run('palette', { primary: '264' }, context({}))), []);
    assert.ok(!notes(run('cube', {}, context({}))).some((n) => n.includes('closest')));
  });

  it('only suggest --contrast=aa when it gets closer', () => {
    const [dark] = notes(run('palette', { primary: '#1a1a40' }, context({})));
    assert.match(dark, /use the lighter -5 in light mode$/);
  });
});

describe('usage', () => {
  const project = { 'css/styles.css': '/* jen:imports */', 'css/palette.css': paletteCss({ primary: '#5b5bd6', contrast: 'aaa' }) };

  it('names only custom properties the generated CSS reads or sets', () => {
    for (const name of [...COMPOSITIONS, 'card', 'avatars', 'button', 'dialog', 'popover']) {
      const g = pack[name];
      assert.ok(g.usage?.length, `${name} has usage`);
      const actions = run(name, { name: 'x' }, context(project, 'css'));
      const css = actions.flatMap((a) => ('add' in a && 'template' in a && a.add.endsWith('.css') ? [a.template] : [])).join('\n');
      const props = (g.usage ?? []).flatMap((line) => /^\S+ \{ (--[a-z-]+):/.exec(line)?.[1] ?? []);
      assert.ok(name === 'center' || name === 'overlay' || props.length, `${name} shows its custom properties`);
      for (const prop of props) assert.match(css, new RegExp(`(var\\(|^\\s*)${prop}\\b`, 'm'), `${name}: ${prop}`);
    }
  });

  it('says how the sidebar works', () => {
    assert.deepEqual(pack.sidebar.usage?.slice(0, 2), ['<div class="sidebar"><aside>…</aside><main>…</main></div>', 'the first child is the sidebar; data-direction="end" makes it the last']);
    assert.ok(pack.sidebar.usage?.some((l) => /^\.sidebar \{ --sidebar-content-min: 50%; \} +the content's narrowest width before both stack$/.test(l)));
  });

  it('shows every role token of the palette, with the pairs measured for it', () => {
    const css = paletteCss({ primary: '#5b5bd6', contrast: 'aaa' });
    const usage = pack.palette.usage ?? [];
    const named = usage.flatMap((l) => [...l.matchAll(/var\((--color-[a-z0-9-]+)\)/g)].map((m) => m[1]));
    for (const role of rolesFor(groupsFor({ primary: '#5b5bd6' }), 'aaa').filter((r) => r.group === 'neutral' || r.group === 'primary')) {
      assert.ok(named.includes(`--color-${role.name}`), `--color-${role.name}`);
    }
    for (const token of named) assert.match(css, new RegExp(`^\\s*${token}:`, 'm'), token);
    assert.ok(usage.some((l) => /^\.button \{ color: var\(--color-on-primary\); \} +text on the color – 7:1 on primary, primary-strong; 4\.5:1 on primary-large$/.test(l)));
    assert.ok(usage.some((l) => /--contrast=aa, 7:1 is 4\.5:1 and 4\.5:1 is 3:1$/.test(l)));
  });

  it('cube says what it writes, which blocks are separate, and the role tokens', () => {
    assert.match(pack.cube.description ?? '', /every composition and utility .* – blocks like web:card are separate$/);
    const usage = pack.cube.usage ?? [];
    assert.ok(usage.includes('blocks to add: jen web:card, web:avatars, web:dialog, web:popover'));
    for (const block of ['card', 'avatars', 'dialog', 'popover']) assert.ok(pack[block], block);
    assert.ok(usage.some((l) => l.includes(COMPOSITIONS.map((n) => `.${n}`).join(', '))));
    for (const line of pack.palette.usage ?? []) assert.ok(usage.includes(line), line);
  });

  it('page shows a layout, with generators that exist', () => {
    const usage = pack.page.usage ?? [];
    const named = usage.flatMap((l) => [...l.matchAll(/jen web:([a-z-]+) --help/g)].map((m) => m[1]));
    assert.deepEqual(named, ['repel', 'sidebar', 'grid', 'card', 'wrapper']);
    for (const name of named) assert.ok(pack[name], name);
    assert.ok(usage.some((l) => l.includes('https://learosema.github.io/jen/web.html#dashboard')));
  });

  it('says where the sidebar and grid properties go', () => {
    assert.ok(pack.sidebar.usage?.includes('set these on .sidebar itself, not on its children:'));
    assert.ok(pack.grid.usage?.some((l) => /^\.grid \{ --grid-min-item-size: 10rem; \} +four in a row next to a sidebar$/.test(l)));
  });

  it('writes custom properties as CSS, never like a flag', () => {
    for (const [name, g] of Object.entries(pack)) {
      for (const line of g.usage ?? []) assert.doesNotMatch(line, /^--/, `${name}: ${line}`);
    }
  });
});

describe('--into', () => {
  const appends = (actions: Action[]) => actions.flatMap((a) => ('append' in a ? [a] : []));
  const entry = { 'css/styles.css': '/* jen:imports */' };

  it('appends plain rules to a stylesheet it makes and imports', () => {
    const actions = run('flow', { into: '/css/layout.css' }, context(entry, 'css'));
    assert.deepEqual(added(actions), ['layout.css']);
    assert.equal(template(actions, 'layout.css'), '');
    const [append] = appends(actions);
    assert.equal(append.append, 'layout.css');
    assert.match(append.text, /^\/\* After the Stack .*\n\.flow > \* \+ \* \{\n {2}margin-block-start/);
    assert.doesNotMatch(append.text, /@layer/);
    assert.deepEqual(lines(actions), ['@import "./layout.css";']);
  });

  it('adds to an existing one after a blank line, relative to where you stand', () => {
    const actions = run('reel', { into: '/css/layout.css' }, context({ ...entry, 'css/layout.css': '.mine {}\n' }, 'css/sub'));
    assert.deepEqual(added(actions), []);
    assert.equal(appends(actions)[0].append, '../layout.css');
    assert.match(appends(actions)[0].text, /^\n\/\* After Smol Scroll Snap/);
  });

  it('writes several into one file, and leaves out what it has', () => {
    const actions = run('compositions', { only: 'flow,cluster,grid', into: '/layout.css' }, context({ 'styles.css': '/* jen:imports */', 'layout.css': '.grid {\n}\n' }));
    assert.deepEqual(appends(actions).map((a) => a.text.match(/^\n?\/\*.*\n(\.[a-z]+)/)?.[1]), ['.flow', '.cluster']);
    assert.deepEqual(notes(actions), ['/layout.css .grid is already here, nothing to add']);
    assert.deepEqual(run('compositions', { only: 'grid', into: '/layout.css' }, context({ 'layout.css': '.grid {}' })), [
      { note: '.grid is already here, nothing to add', file: '/layout.css' },
    ]);
    const fresh = run('compositions', { only: 'flow,cluster', into: '/layout.css' }, context({}));
    assert.deepEqual(added(fresh), ['layout.css', 'styles.css'], 'makes the entry point too, like web:compositions without --into');
    assert.match(template(fresh, 'styles.css'), /@import "\.\/layout\.css";/);
    assert.deepEqual(appends(fresh).map((a) => a.text.startsWith('\n')), [false, true]);
  });

  it('notes one that the --into file already has, and works for colors and utilities', () => {
    const again = run('reel', { into: '/css/layout.css' }, context({ 'css/layout.css': '.reel {\n}\n' }));
    assert.deepEqual(again, [{ note: '.reel is already here, nothing to add', file: '/css/layout.css' }]);
    const color = appends(run('color', { name: 'pink', color: 'deeppink', into: '/tokens.css' }, context({})))[0].text;
    assert.match(color, /^\/\*\n \* Generated by `jen web:color --name=pink --color=deeppink`[^]*\*\/\n:root \{\n {2}--color-pink-1: #[0-9a-f]{6};/);
    assert.doesNotMatch(color, /@layer/);
    const hidden = appends(run('visually-hidden', { into: '/u.css' }, context({})))[0].text;
    assert.match(hidden, /^\.visually-hidden:not\(:focus, :active\) \{\n {2}position: absolute;/);
  });
});

describe('web:color', () => {
  it('writes six checked shades and nothing else', () => {
    const actions = run('color', { name: 'pink', color: 'deeppink' }, context({ 'styles.css': '/* jen:imports */' }));
    const css = template(actions, 'colors/pink.css');
    const shades = [...css.matchAll(/--color-pink-(\d): (#[0-9a-f]{6});/g)];
    assert.deepEqual(shades.map((m) => m[1]), ['1', '2', '3', '4', '5', '6']);
    assert.ok(contrast(shades[0][2], shades[3][2]) >= 4.5 && contrast(shades[0][2], shades[4][2]) >= 7);
    assert.doesNotMatch(css, /light-dark|--color-pink:|on-pink|subtle/);
    assert.match(css, /^\/\*\n \* Generated by `jen web:color --name=pink --color=deeppink`/);
    assert.match(css, /@layer tokens \{\n {2}:root \{\n {4}--color-pink-1:/);
    assert.deepEqual(lines(actions), ['@import "./colors/pink.css";']);
  });

  it('goes into @theme for Tailwind, and quotes colors with spaces in its command', () => {
    const css = template(run('color', { name: 'pink', color: 'rgb(255 20 147)' }, context({ 'app.css': '@import "tailwindcss";' })), 'colors/pink.css');
    assert.match(css, /`jen web:color --name=pink --color='rgb\(255 20 147\)' --tailwind`/);
    assert.match(css, /\n@theme \{\n {2}--color-pink-1: #[0-9a-f]{6};/);
    assert.doesNotMatch(css, /initial/, "keeps Tailwind's own colors");
  });

  it('refuses bad names and unreadable colors, and notes a color the palette already has', () => {
    assert.throws(() => run('color', { name: 'Pink', color: 'pink' }, context({})), /--name: "Pink"/);
    assert.throws(() => run('color', { name: 'pink', color: 'pinky' }, context({})), /--color: can't read "pinky"/);
    const palette = { 'palette.css': paletteCss({ primary: '#5b5bd6', contrast: 'aaa' }) };
    assert.deepEqual(notes(run('color', { name: 'primary', color: 'red' }, context(palette))), ['/palette.css --color-primary-1 is already here, nothing to add']);
  });
});

describe('web:utilities', () => {
  const palette = paletteCss({ primary: '#5b5bd6', contrast: 'aaa' });
  const fluidCss = template(run('fluid', {}, context({})), 'fluid.css');
  const pink = template(run('color', { name: 'pink', color: 'deeppink' }, context({})), 'colors/pink.css');
  const project = { 'css/styles.css': '/* jen:imports */', 'css/palette.css': palette, 'css/fluid.css': fluidCss, 'css/colors/pink.css': pink };

  it('makes color classes for one color: its role tokens if it has some, else its shades', () => {
    const primary = template(run('color-classes', { name: 'primary' }, context(project, 'css')), 'utilities/color-primary.css');
    assert.match(primary, /^@layer utilities \{\n {2}\.color-primary \{\n {4}color: var\(--color-primary\);/);
    assert.match(primary, /\.bg-primary-subtle \{/);
    assert.match(primary, /\.color-on-primary \{/);
    assert.doesNotMatch(primary, /--color-primary-3\b/, 'no utilities for raw shades, to stay on checked pairs');
    const neutral = template(run('color-classes', { name: 'neutral' }, context(project, 'css')), 'utilities/color-neutral.css');
    assert.match(neutral, /\.color-text-muted \{\n {4}color: var\(--color-text-muted\);/);
    assert.doesNotMatch(neutral, /primary|success/);
    const shades = template(run('color-classes', { name: 'pink' }, context(project, 'css')), 'utilities/color-pink.css');
    assert.match(shades, /\.color-pink-1 \{\n {4}color: var\(--color-pink-1\);/);
    assert.match(shades, /\.bg-pink-6 \{\n {4}background-color: var\(--color-pink-6\);/);
    assert.throws(() => run('color-classes', { name: 'teal' }, context(project)), /no color "teal" in the project – run `jen web:color --name=teal --color=<color>` first \(it has primary, neutral, success, warning, danger, info, pink\)/);
  });

  it('makes step and space classes from the fluid scale, and needs one', () => {
    const steps = template(run('step-classes', {}, context(project)), 'utilities/steps.css');
    assert.match(steps, /\.step--1 \{\n {4}font-size: var\(--step--1\);/);
    const space = template(run('space-classes', {}, context(project)), 'utilities/space.css');
    assert.match(space, /\.flow-space-s-m \{\n {4}--flow-space: var\(--space-s-m\);/);
    assert.match(space, /\.gutter-xl \{/);
    assert.throws(() => run('step-classes', {}, context({})), /run `jen web:fluid` first/);
  });

  it('has the fixed ones on their own', () => {
    for (const name of ['visually-hidden', 'pad-fluid', 'unbreakable']) {
      const css = template(run(name, {}, context({})), `utilities/${name}.css`);
      assert.match(css, new RegExp(`^@layer utilities \\{\\n(?: {2}/\\*.*\\n)? {2}\\.${name}\\b`));
      assert.doesNotMatch(css, PX);
    }
  });

  it('writes everything that fits at once, minus what the project has', () => {
    const all = added(run('utilities', {}, context(project, 'css')));
    assert.deepEqual(all, [
      ...['primary', 'neutral', 'success', 'warning', 'danger', 'info', 'pink'].map((c) => `utilities/color-${c}.css`),
      'utilities/steps.css',
      'utilities/space.css',
      'utilities/visually-hidden.css',
      'utilities/pad-fluid.css',
      'utilities/unbreakable.css',
    ]);
    const bare = run('utilities', {}, context({ 'styles.css': '/* jen:imports */', 'a11y.css': '.visually-hidden { }' }));
    assert.deepEqual(added(bare), ['utilities/pad-fluid.css', 'utilities/unbreakable.css']);
    assert.deepEqual(notes(bare), ['/a11y.css .visually-hidden is already here, nothing to add']);
  });

  it('steps aside for Tailwind', () => {
    assert.throws(() => run('utilities', {}, context({ 'app.css': '@import "tailwindcss";', 'palette.css': palette })), /Tailwind/);
    assert.throws(() => run('color-classes', { name: 'primary' }, context({ 'app.css': '@import "tailwindcss";', 'palette.css': palette })), /web:color-classes: this project uses Tailwind/);
  });

  it('finds tokens after comments, and stays fast on hostile input', () => {
    const tokens = tokensFrom(':root {\n  /* brand */\n  --color-primary: light-dark(#06c, #6af);\n}', '/* x */ --space-s: 1rem; --step-0: 1rem; --color-pink-1: #fff;');
    assert.deepEqual(tokens, { colors: ['pink'], roles: ['primary'], steps: ['0'], space: ['s'] });
    const start = performance.now();
    tokensFrom('--color-'.repeat(50_000), '--space-'.repeat(50_000));
    assert.ok(performance.now() - start < 1000, 'no quadratic backtracking');
  });
});

describe('web:cube', () => {
  const compositions = COMPOSITIONS.map((n) => `compositions/${n}.css`);
  const fixed = ['utilities/visually-hidden.css', 'utilities/pad-fluid.css', 'utilities/unbreakable.css'];

  it('sets up the whole starter with one entry point', () => {
    const actions = run('cube', {}, context({}));
    assert.deepEqual(added(actions), ['styles.css', 'reset.css', 'base.css', 'fluid.css', ...compositions, 'utilities/steps.css', 'utilities/space.css', ...fixed]);
    const entry = template(actions, 'styles.css');
    for (const f of added(actions).slice(1)) assert.match(entry, new RegExp(`@import "\\./${f}";`));
  });

  it('adds the palette and buttons with --primary, and their utilities', () => {
    const actions = run('cube', { primary: '#5b5bd6', secondary: '330' }, context({}));
    assert.deepEqual(added(actions).slice(0, 5), ['styles.css', 'reset.css', 'base.css', 'palette.css', 'fluid.css']);
    assert.ok(added(actions).includes('utilities/color-secondary.css'));
    // a block before the utilities, like their layers
    assert.ok(added(actions).indexOf('button.css') < added(actions).indexOf('utilities/color-primary.css'));
    assert.match(template(actions, 'utilities/color-secondary.css'), /\.bg-secondary \{/);
    assert.match(template(actions, 'button.css'), /\.button--secondary \{/);
  });

  it('wires into an existing entry point, leaving out what the project has', () => {
    const actions = run('cube', {}, context({ 'main.css': '/* jen:imports */', 'layout.css': '.grid {}' }));
    assert.ok(!added(actions).includes('styles.css'));
    assert.ok(!added(actions).includes('compositions/grid.css'));
    assert.equal(inserts(actions).length, added(actions).length);
    assert.deepEqual(notes(actions), ['/layout.css .grid is already here, nothing to add']);
  });

  describe('--into', () => {
    const appends = (actions: Action[]) => actions.flatMap((a) => ('append' in a ? [a.text] : []));

    it('writes everything as plain rules into one new file, without an entry point', () => {
      const actions = run('cube', { primary: '#0d9488', into: '/css/styles.css' }, context({}));
      assert.deepEqual(added(actions), ['css/styles.css']);
      assert.equal(template(actions, 'css/styles.css'), '');
      assert.deepEqual(inserts(actions), []);
      const texts = appends(actions);
      assert.ok(texts.every((t) => !/@layer/.test(t)));
      const at = (re: RegExp) => texts.findIndex((t) => re.test(t));
      const order = [/^\*::before/m, /^li\[data-icon\]::marker/m, /^ {2}--color-surface:/m, /^ {2}--step-0:/m, /^\.flow\b/m, /^\.button \{/m, /^\.color-primary/m];
      const found = order.map(at);
      assert.ok(found.every((i) => i >= 0), String(found));
      assert.deepEqual([...found].sort((a, b) => a - b), found, 'reset, base, palette, fluid, compositions, button, utilities');
      // the palette keeps its fallback for browsers without light-dark()
      assert.match(texts[at(/--color-surface:/)], /@supports not \(color: light-dark/);
    });

    it('appends to the entry point itself without importing it into itself', () => {
      const entry = { 'css/styles.css': '@layer reset, tokens;\n/* jen:imports */\n' };
      const actions = run('cube', { into: '/css/styles.css' }, context(entry));
      assert.deepEqual(added(actions), []);
      assert.deepEqual(inserts(actions), []);
      assert.ok(appends(actions).length > 10);
    });

    it('imports into an existing entry point, and leaves out what the project has', () => {
      const actions = run('cube', { into: '/all.css' }, context({ 'styles.css': '/* jen:imports */', 'mine.css': '.grid {}' }));
      assert.deepEqual(added(actions), ['all.css']);
      assert.deepEqual(lines(actions), ['@import "./all.css";']);
      assert.deepEqual(notes(actions), ['/mine.css .grid is already here, nothing to add']);
    });

    it('refuses Tailwind projects', () => {
      assert.throws(() => run('cube', { into: '/css/styles.css', tailwind: true }, context({})), /web:cube --into isn't for Tailwind projects/);
    });
  });
});

describe('Tailwind v4', () => {
  const twEntry = { 'css/styles.css': `@layer ${LAYERS.join(', ')};\n\n@import "./base.css";\n/* jen:imports */\n` };

  it('web:tailwind creates an entry point with Tailwind fitted into the CUBE CSS layers', () => {
    const entry = template(run('tailwind', {}, context({})), 'styles.css');
    assert.match(entry, /^@layer theme, reset, tokens, base, compositions, components, blocks, utilities, exceptions;$/m);
    assert.match(entry, /@import "tailwindcss";\n\/\* jen:imports \*\//);
  });

  it('web:tailwind converts an existing entry point', () => {
    const actions = run('tailwind', {}, context(twEntry, 'css'));
    const [modify, insert] = actions;
    assert.ok('modify' in modify);
    assert.equal(
      twEntry['css/styles.css'].replace(modify.pattern, modify.replace).split('\n')[0],
      '@layer theme, reset, tokens, base, compositions, components, blocks, utilities, exceptions;',
    );
    // an entry from before utilities came last keeps its order
    const old = '@layer reset, tokens, base, compositions, utilities, blocks, exceptions;';
    assert.equal(old.replace(modify.pattern, modify.replace), '@layer theme, reset, tokens, base, compositions, components, utilities, blocks, exceptions;');
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
    const actions = run('compositions', {}, context({}));
    const css = COMPOSITIONS.map((n) => template(actions, `compositions/${n}.css`)).join('\n');
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

  it('web:pad-fluid and web:unbreakable', () => {
    const css = template(run('pad-fluid', {}, context(palette)), 'utilities/pad-fluid.css') + template(run('unbreakable', {}, context(palette)), 'utilities/unbreakable.css');
    assert.match(css, /\.pad-fluid \{\n {4}padding: clamp\(/);
    assert.match(css, /\.unbreakable \{/);
  });
});

describe('platform features', () => {
  const page = { 'index.html': '<!doctype html>\n<html>\n  <body>\n    <main></main>\n  </body>\n</html>\n', 'css/styles.css': '/* jen:imports */' };

  it('web:dialog writes the block, and with --into the button and the dialog – no polyfill', () => {
    const actions = run('dialog', { name: 'confirmDelete', into: '/index.html' }, context(page, 'css'));
    assert.deepEqual(added(actions), ['dialog.css']);
    const [button, dialog, ...rest] = inserts(actions).filter((a) => a.insert === '/index.html');
    assert.deepEqual(rest, []);
    assert.ok('line' in button && button.line === '<button type="button" class="button" commandfor="confirm-delete" command="show-modal">Confirm delete</button>');
    assert.ok('line' in dialog && dialog.line.startsWith('<dialog id="confirm-delete" class="dialog" aria-labelledby="confirm-delete-title" closedby="any">'));
    assert.ok('line' in dialog && dialog.line.split('<button').slice(1).every((b) => b.startsWith(' type="button"')), 'no button submits a form it is in');
    assert.deepEqual(button.before, /<\/body>/);
    assert.deepEqual(dialog.before, /<\/body>/);
    const css = template(actions, 'dialog.css');
    assert.match(css, /@starting-style/);
    assert.match(css, /margin: auto;/);
    assert.doesNotMatch(css, PX);
    assert.deepEqual(added(run('dialog', { name: 'x' }, context(page, 'css'))), ['dialog.css'], 'no markup without --into');
  });

  it('web:popover anchors to its trigger where supported', () => {
    const actions = run('popover', { name: 'menu', into: '/index.html' }, context(page, 'css'));
    const css = template(actions, 'popover.css');
    assert.match(css, /@supports \(position-area: block-end\) \{\n {4}\.popover \{\n {6}inset: auto;/);
    assert.match(css, /position-try-fallbacks: flip-block, flip-inline;/);
    assert.doesNotMatch(css, PX);
    const [button, popover] = inserts(actions).filter((a) => a.insert === '/index.html');
    assert.ok('line' in button && button.line === '<button type="button" class="button" popovertarget="menu" style="anchor-name: --menu">Menu</button>');
    assert.ok('line' in popover && popover.line.startsWith('<div id="menu" class="popover" popover style="position-anchor: --menu">'));
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

  it('says what it linked', () => {
    assert.deepEqual(notes(run('page', { name: 'About' }, context(project, 'pages'))), ['about.html links ../css/styles.css and ../public/favicon.svg']);
    assert.deepEqual(notes(run('page', { name: 'index' }, context({ 'css/styles.css': '/* jen:imports */' }))), ['index.html links css/styles.css']);
  });

  it('says when there is no stylesheet to link', () => {
    assert.deepEqual(notes(run('page', { name: 'index' }, context({ 'favicon.ico': '' }))), [
      'index.html links favicon.ico',
      'no stylesheet to link yet – run jen web:cube (or web:base) first, then make the page again with --force',
    ]);
  });

  it('leaves out the description tags without --description', () => {
    const html = template(run('page', { name: 'index' }, context({})), 'index.html');
    assert.doesNotMatch(html, /description/);
    assert.match(html, /<meta property="og:title" content="Index">/);
    const described = template(run('page', { name: 'index', description: 'All about "us"' }, context({})), 'index.html');
    assert.match(described, /<meta name="description" content="All about &quot;us&quot;">/);
    assert.match(described, /<meta property="og:description" content="All about &quot;us&quot;">/);
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

  it('puts the button before that line, and the dialog, popover or script still before </body>', () => {
    const actions = run('dialog', { name: 'confirm', into: '/index.html', line: '2' }, context(page, 'css'));
    const [button, dialog] = inserts(actions).filter((a) => a.insert === '/index.html');
    assert.equal(button.before, 2);
    assert.deepEqual(dialog.before, /<\/body>/);
    const [, trigger, popover] = inserts(run('popover', { name: 'menu', into: '/index.html', line: '2' }, context(page, 'css')));
    assert.equal(trigger.before, 2);
    assert.deepEqual(popover.before, /<\/body>/);
    assert.equal(inserts(run('scroll', { into: '/index.html', line: '3' }, context(page, 'css')))[1].before, 3);
  });

  it('defaults to before </body>, and refuses lines that make no sense', () => {
    assert.deepEqual(inserts(run('popover', { name: 'menu', into: '/index.html' }, context(page, 'css')))[1].before, /<\/body>/);
    assert.throws(() => run('popover', { name: 'menu', line: '2' }, context(page, 'css')), /--line: needs --into/);
    assert.throws(() => run('scroll', { into: '/index.html', line: '0' }, context(page, 'css')), /"0" is not a line number/);
    assert.throws(() => run('dialog', { name: 'x', into: '/index.html', line: '40' }, context(page, 'css')), /index\.html has 3 lines, there is no line 40/);
    assert.equal(inserts(run('scroll', { into: '/index.html', line: '4' }, context(page, 'css')))[1].before, 4, 'one past the end appends');
  });

  it('also takes text on the line, matched literally', () => {
    const nav = { 'index.html': '<body>\n  <nav class="a.b">\n  </nav>\n</body>\n', 'css/styles.css': '/* jen:imports */' };
    const [button, dialog] = inserts(run('dialog', { name: 'confirm', into: '/index.html', line: '</nav>' }, context(nav, 'css'))).filter(
      (a) => a.insert === '/index.html',
    );
    assert.equal(button.before, '</nav>');
    assert.deepEqual(dialog.before, /<\/body>/);
    assert.equal(inserts(run('popover', { name: 'menu', into: '/index.html', line: 'a.b' }, context(nav, 'css')))[1].before, 'a.b');
    assert.throws(() => run('popover', { name: 'menu', into: '/index.html', line: 'a*b' }, context(nav, 'css')), /no line in index\.html contains "a\*b"/);
  });

  it('refuses text no line contains, before anything is written', () => {
    assert.throws(() => run('dialog', { name: 'x', into: '/index.html', line: '</footer>' }, context(page, 'css')), /web:dialog --line: no line in index\.html contains "<\/footer>"/);
    assert.throws(() => run('scroll', { into: '/index.html', line: 'top' }, context(page, 'css')), /no line in index\.html contains "top"/);
  });
});

describe('web:manifest', () => {
  const json = (actions: Action[], file = 'manifest.webmanifest') => JSON.parse(template(actions, file));

  it('writes a manifest with neutral colors and no icons in a bare project', () => {
    const m = json(run('manifest', { name: 'My Site' }, context({})));
    assert.deepEqual(m, {
      name: 'My Site',
      short_name: 'My Site',
      start_url: './',
      scope: './',
      display: 'standalone',
      theme_color: '#ffffff',
      background_color: '#ffffff',
      icons: [],
      lang: 'en',
      dir: 'ltr',
    });
    assert.equal(json(run('manifest', { name: 'Codejen Notebook Pro' }, context({}))).short_name, 'Codejen');
    assert.equal(json(run('manifest', { name: 'x', lang: 'he-IL' }, context({}))).dir, 'rtl');
  });

  it('takes primary and surface from the palette, as hex', () => {
    const palette = paletteCss({ primary: '#5b5bd6', contrast: 'aaa' });
    const ctx = context({ 'css/palette.css': palette });
    const m = json(run('manifest', { name: 'x' }, ctx));
    assert.equal(m.theme_color, paletteColor(ctx, 'primary'));
    assert.equal(m.background_color, /--color-neutral-1: (#[0-9a-f]{6});/.exec(palette)![1]);
    assert.match(m.theme_color, /^#[0-9a-f]{6}$/);
  });

  it('converts color flags to hex, and refuses what it cannot read', () => {
    assert.equal(hexColor('#abc', '--x'), '#aabbcc');
    assert.equal(hexColor('oklch(1 0 0)', '--x'), '#ffffff');
    assert.match(hexColor('264', '--x'), /^#[0-9a-f]{6}$/);
    const m = json(run('manifest', { name: 'x', themeColor: '#123456', backgroundColor: 'oklch(0 0 0)' }, context({})));
    assert.deepEqual([m.theme_color, m.background_color], ['#123456', '#000000']);
    assert.equal(hexColor('teal', '--x'), '#008080');
    assert.throws(() => run('manifest', { name: 'x', themeColor: 'tael' }, context({})), /--themeColor: can't read "tael" as a color/);
    assert.throws(() => run('manifest', { name: 'x', display: 'window' }, context({})), /--display: expected fullscreen, standalone, minimal-ui, browser/);
  });

  it('lists the icons that exist, and makes a maskable one from favicon.svg', () => {
    const ctx = context({ 'package.json': '{ "devDependencies": { "vite": "^7" } }', 'public/favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>', 'public/icon-512.png': '' });
    const actions = run('manifest', { name: 'x' }, ctx);
    assert.deepEqual(added(actions), ['/public/manifest.webmanifest', '/public/icon-maskable.svg']);
    assert.deepEqual(
      json(actions, '/public/manifest.webmanifest').icons.map((i: Record<string, string>) => `${i.src} ${i.sizes} ${i.purpose}`),
      ['favicon.svg any any', 'icon-maskable.svg any maskable', 'icon-512.png 512x512 any'],
    );
  });

  it('fits favicon.svg into the safe zone of the maskable icon', () => {
    const svg = maskableSvg('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle r="1"/></svg>\n', '#eeeeee');
    assert.match(svg, /<rect width="100" height="100" fill="#eeeeee"\/>/);
    assert.match(svg, /<svg x="21\.7" y="21\.7" width="56\.6" height="56\.6" viewBox="0 0 32 32" xmlns="http:\/\/www\.w3\.org\/2000\/svg"><circle r="1"\/><\/svg>/);
    assert.doesNotMatch(svg, /<\?xml/);
    assert.match(maskableSvg('<svg viewBox="0 0 8 8" width="1em"></svg>', '#fff'), /<svg x="21\.7" y="21\.7" width="56\.6" height="56\.6" viewBox="0 0 8 8"><\/svg>/);
  });

  it('--png needs favicon.svg, and rsvg-convert or ImageMagick', () => {
    assert.throws(() => run('manifest', { name: 'x', png: true }, context({})), /--png: renders the PNGs from favicon\.svg, and there is none/);
    const path = process.env.PATH;
    process.env.PATH = '';
    try {
      assert.throws(() => run('manifest', { name: 'x', png: true }, context({ 'favicon.svg': '<svg/>' })), /--png: needs rsvg-convert \(librsvg\) or ImageMagick \(magick\) on the PATH/);
    } finally {
      process.env.PATH = path;
    }
  });

  it('frames the apple-touch-icon on the background, and leaves the others edge to edge', () => {
    const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle r="4"/></svg>';
    assert.equal(
      iconSvg(favicon, { file: 'a.png', size: 180, frame: { background: '#123456', inset: 20 / 180 } }),
      '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 100 100"><rect width="100" height="100" fill="#123456"/><svg x="11.1" y="11.1" width="77.8" height="77.8" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle r="4"/></svg></svg>\n',
    );
    assert.match(iconSvg(favicon, { file: 'b.png', size: 512, frame: null }), /^<svg [^>]*width="512" height="512"[^>]*><svg x="0" y="0" width="100" height="100"/);
  });

  it('--png renders the icons next to favicon.svg and lists them', { skip: !findConverter() && 'no rsvg-convert or ImageMagick' }, () => {
    const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#5b5bd6"/></svg>';
    const ctx = context({ 'public/favicon.svg': favicon, 'index.html': '<head>\n</head>\n' });
    const actions = run('manifest', { name: 'x', png: true, into: '/index.html' }, ctx);
    const pngs = actions.flatMap((a) => ('bytes' in a ? [a] : []));
    // A PNG's size sits in its IHDR chunk, as two big-endian 32-bit numbers from byte 16.
    const size = (bytes: Uint8Array) => {
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      return `${view.getUint32(16)}x${view.getUint32(20)}`;
    };
    assert.deepEqual(
      pngs.map((a) => `${a.add} ${size(a.bytes)}`),
      ['/public/icon-192.png 192x192', '/public/icon-512.png 512x512', '/public/apple-touch-icon.png 180x180'],
    );
    assert.ok(pngs.every((a) => Buffer.from(a.bytes.subarray(1, 4)).toString() === 'PNG'));
    const icons = JSON.parse(template(actions, '/public/manifest.webmanifest')).icons.map((i: Record<string, string>) => `${i.src} ${i.sizes}`);
    assert.deepEqual(icons.slice(2), ['icon-192.png 192x192', 'icon-512.png 512x512']);
    assert.equal(lines(actions)[0], '<link rel="apple-touch-icon" href="./apple-touch-icon.png">');
  });

  it('--into links the manifest and the theme colors in the head', () => {
    const page = { 'pages/about.html': '<head>\n</head>\n<body>\n</body>\n' };
    const plain = run('manifest', { name: 'x', into: '/pages/about.html' }, context(page));
    assert.deepEqual(lines(plain), ['<link rel="manifest" href="../manifest.webmanifest">', '<meta name="theme-color" content="#ffffff">']);
    assert.ok(inserts(plain).every((a) => String(a.before) === String(/<\/head>/)));
    const themed = lines(run('manifest', { name: 'x', into: '/pages/about.html' }, context({ ...page, 'palette.css': paletteCss({ primary: '#5b5bd6', contrast: 'aaa' }) })));
    assert.match(themed[1], /media="\(prefers-color-scheme: light\)"/);
    assert.match(themed[2], /media="\(prefers-color-scheme: dark\)"/);
  });
});

describe('web:sw', () => {
  const site = {
    'package.json': '{ "name": "@me/my-site" }',
    'styles.css': '@import "./reset.css";\n@import "./blocks/card.css";\n/* jen:imports */',
    'reset.css': '',
    'blocks/card.css': '@import "../reset.css";',
    'index.html': '<body>\n</body>\n',
    'about.html': '',
  };

  it('writes the service worker, precaching the pages and the stylesheets, and a module that registers it', () => {
    const actions = run('sw', {}, context(site));
    assert.deepEqual(added(actions), ['sw.js', 'register-sw.js']);
    const sw = template(actions, 'sw.js');
    assert.match(sw, /^\/\/ Caching strategies after Jake Archibald's Offline Cookbook: https:\/\/web\.dev\/articles\/offline-cookbook/);
    assert.match(sw, /const PREFIX = 'my-site-';/);
    assert.match(sw, /const PRECACHE = \[\n {2}'\.\/about\.html',\n {2}'\.\/',\n {2}'\.\/styles\.css',\n {2}'\.\/reset\.css',\n {2}'\.\/blocks\/card\.css',\n\];/);
    assert.match(sw, /const OFFLINE_PAGE = null;/);
    assert.match(sw, /async function fromCache\(\{ request \}\)/);
    assert.doesNotThrow(() => new Script(sw), 'sw.js is valid JavaScript');
    const register = template(actions, 'register-sw.js');
    assert.match(register, /const SW_URL = new URL\('\.\/sw\.js', import\.meta\.url\);/);
    assert.match(register, /if \('serviceWorker' in navigator\)/);
    assert.doesNotMatch(register, /@ts-check|@param|\{\{/);
  });

  it('--strategy=swr revalidates in the background; --precache lists the files', () => {
    const sw = template(run('sw', { strategy: 'swr', precache: 'app.css, /logo.svg,./a.js' }, context(site)), 'sw.js');
    assert.match(sw, /stale-while-revalidate/);
    assert.match(sw, /event\.waitUntil\(fresh\.catch/);
    assert.match(sw, /const PRECACHE = \[\n {2}'\.\/app\.css',\n {2}'\/logo\.svg',\n {2}'\.\/a\.js',\n\];/);
    assert.doesNotThrow(() => new Script(sw));
    assert.throws(() => run('sw', { strategy: 'network-only' }, context(site)), /--strategy: expected cache-first or swr, got "network-only"/);
  });

  it('--offline writes an offline page through web:page\'s template and precaches it', () => {
    const actions = run('sw', { offline: true }, context(site));
    assert.deepEqual(added(actions), ['sw.js', 'offline.html', 'register-sw.js']);
    assert.match(template(actions, 'offline.html'), /<title>Offline<\/title>[\s\S]*<link rel="stylesheet" href="\.\/styles\.css">/);
    const sw = template(actions, 'sw.js');
    assert.match(sw, /const OFFLINE_PAGE = '\.\/offline\.html';/);
    assert.match(sw, /'\.\/offline\.html',\n\];/);
  });

  it('writes valid JavaScript and TypeScript in every variant', (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'jen-sw-check-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const variants = [
      run('sw', { offline: true }, context(site)),
      run('sw', { strategy: 'swr', types: 'jsdoc' }, context(site)),
      run('sw', { types: 'ts' }, context(site)),
      run('sw', {}, context({ 'package.json': '{ "devDependencies": { "vite": "^7" } }' })),
    ];
    // Without the test runner's NODE_TEST_CONTEXT, which turns a child `node --check` into a no-op; TypeScript is stripped first.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT'));
    variants.flat().forEach((a, i) => {
      if (!('template' in a) || !/\.[jt]s$/.test(a.add)) return;
      const file = join(dir, `${i}.mjs`);
      writeFileSync(file, a.add.endsWith('.ts') ? stripTypeScriptTypes(a.template) : a.template);
      const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', env });
      assert.equal(check.status, 0, `${a.add}: ${check.stderr}`);
    });
  });

  it('writes the register module in the project\'s style', () => {
    const ts = template(run('sw', {}, context({ ...site, 'tsconfig.json': '{}' })), 'register-sw.ts');
    assert.match(ts, /'sw-update': CustomEvent<SwUpdate>;/);
    assert.match(ts, /async function register\(\): Promise<void>/);
    const jsdoc = template(run('sw', { types: 'jsdoc' }, context(site)), 'register-sw.js');
    assert.match(jsdoc, /^\/\/ @ts-check\n/);
    assert.match(jsdoc, /@param \{ServiceWorker\} worker/);
    assert.throws(() => run('sw', { types: 'flow' }, context(site)), /web:sw --types: expected ts, jsdoc or none, got "flow"/);
  });

  it('serves from public/ in a Vite project, registered only in production builds', () => {
    const vite = { 'package.json': '{ "devDependencies": { "vite": "^7" } }', 'index.html': '', 'src/style.css': '/* jen:imports */' };
    const actions = run('sw', {}, context(vite, 'src'));
    assert.deepEqual(added(actions), ['/public/sw.js', 'register-sw.js']);
    assert.match(template(actions, '/public/sw.js'), /const PRECACHE = \[\n {2}'\.\/',\n\];/, 'the bundler builds the stylesheets');
    const register = template(actions, 'register-sw.js');
    assert.match(register, /const SW_URL = `\$\{import\.meta\.env\.BASE_URL\}sw\.js`;/);
    assert.match(register, /if \(import\.meta\.env\.PROD && 'serviceWorker' in navigator\)/);
  });

  it('--into loads the register module from a page or a module', () => {
    assert.deepEqual(lines(run('sw', { into: '/index.html' }, context(site, 'js'))), ['<script type="module" src="./js/register-sw.js"></script>']);
    assert.deepEqual(lines(run('sw', { into: '/src/main.ts' }, context({ ...site, 'tsconfig.json': '{}', 'src/main.ts': '' }, 'src'))), ["import './register-sw.js';"]);
  });
});

/** Chromium for the browser test: $CHROME, else a usual install; the test is skipped without one. */
const CHROME = [process.env.CHROME, '/usr/bin/chromium', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(
  (p) => p && existsSync(p),
);

/** A minimal Chrome DevTools protocol client over the WebSocket Node has built in. */
function devtools(url: string) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }>();
  const waiting: { method: string; resolve: () => void }[] = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(String(e.data));
    const call = pending.get(msg.id);
    if (call) {
      pending.delete(msg.id);
      if (msg.error) call.reject(new Error(msg.error.message));
      else call.resolve(msg.result);
    }
    for (const w of waiting.filter((w) => w.method === msg.method)) {
      waiting.splice(waiting.indexOf(w), 1);
      w.resolve();
    }
  };
  return {
    open: new Promise((resolve) => (ws.onopen = resolve)),
    send: (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      }),
    next: (method: string) => new Promise<void>((resolve) => waiting.push({ method, resolve })),
    close: () => ws.close(),
  };
}

const MIME: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json' };

describe('web:sw in a browser', { skip: !CHROME && 'no Chromium found (set CHROME)' }, () => {
  it('serves cached pages, and the offline page for the rest, once offline', { timeout: 60_000 }, async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'jen-sw-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const files: Record<string, string> = { 'styles.css': '/* jen:imports */\nh1 { color: rebeccapurple; }\n' };
    files['index.html'] = template(run('page', { name: 'index', title: 'Home', script: '/register-sw.js' }, context(files)), 'index.html');
    for (const a of run('sw', { offline: true }, context(files))) if ('template' in a) files[a.add] = a.template;
    for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);

    const server = createServer((req, res) => {
      const path = join(dir, new URL(req.url ?? '/', 'http://localhost').pathname.replace(/\/$/, '/index.html'));
      if (!path.startsWith(dir) || !existsSync(path)) return void res.writeHead(404).end();
      res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'text/plain' }).end(readFileSync(path));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    t.after(() => server.close());

    const profile = join(dir, '.profile');
    mkdirSync(profile);
    const chrome = spawn(CHROME!, ['--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    t.after(() => chrome.kill());
    const url = await new Promise<string>((resolve, reject) => {
      let err = '';
      chrome.stderr.on('data', (d) => {
        err += d;
        const m = /DevTools listening on (ws:\S+)/.exec(err);
        if (m) resolve(m[1]);
      });
      chrome.on('exit', () => reject(new Error(`Chromium exited: ${err}`)));
    });

    const cdp = devtools(url);
    t.after(() => cdp.close());
    await cdp.open;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })) as { sessionId: string };
    const send = (method: string, params: Record<string, unknown> = {}) => cdp.send(method, params, sessionId);
    const evaluate = async (expression: string) =>
      ((await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })) as { result: { value: unknown } }).result.value;
    const go = async (method: string, params: Record<string, unknown> = {}) => {
      const loaded = cdp.next('Page.loadEventFired');
      await send(method, params);
      await loaded;
    };
    await send('Page.enable');
    await send('Network.enable');

    await go('Page.navigate', { url: `${origin}/` });
    const controlled = `navigator.serviceWorker.controller ? true : new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true)))`;
    assert.equal(await evaluate(controlled), true, 'the service worker takes over the page');

    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

    await go('Page.reload');
    assert.equal(await evaluate('document.querySelector("h1").textContent'), 'Home', 'a precached page comes from the cache');
    assert.equal(await evaluate('getComputedStyle(document.querySelector("h1")).color'), 'rgb(102, 51, 153)', 'and its stylesheet too');

    await go('Page.navigate', { url: `${origin}/elsewhere.html` });
    assert.equal(await evaluate('document.title'), 'Offline', 'any other page shows the offline page');
  });
});

// ─── Param descriptions ─────────────────────────────────────────────────────

/** Params that say what they're for by their name alone: the required name, and namespace. */
const selfExplanatory = (param: string, spec: { default?: unknown }): boolean =>
  (param === 'name' && spec.default === undefined) || param === 'namespace';

describe('param descriptions', () => {
  for (const [gen, g] of Object.entries(pack)) {
    it(`${gen}: every param says what it's for`, () => {
      const missing = Object.entries(g.params ?? {})
        .filter(([param, spec]) => !selfExplanatory(param, spec) && !spec.description?.trim())
        .map(([param]) => `--${param}`);
      assert.deepEqual(missing, []);
    });
  }
});

// ─── Examples ───────────────────────────────────────────────────────────────

/** The flags of an example call: `--name=Foo --moveOnly --members="int a, int b"` → { name: 'Foo', moveOnly: true, members: 'int a, int b' }. */
const exampleFlags = (args: string): Record<string, string | true> =>
  Object.fromEntries([...args.matchAll(/--([\w-]+)(?:=("[^"]*"|\S*))?/g)].map(([, k, v]) => [k, v === undefined ? true : v.replace(/^"(.*)"$/, '$1')]));

describe('examples', () => {
  for (const [gen, g] of Object.entries(pack)) {
    it(`${gen}: has examples that run as written`, () => {
      const params = g.params ?? {};
      assert.ok(g.examples?.length, 'no examples');
      for (const args of g.examples ?? []) {
        const flags = exampleFlags(args);
        for (const [flag, value] of Object.entries(flags)) {
          if (flag === 'dir' && !('dir' in params)) continue;
          assert.ok(flag in params, `${args}: no --${flag}`);
          const choices = params[flag].choices;
          if (choices) assert.ok(choices.includes(String(value)), `${args}: --${flag} takes ${choices.join(', ')}`);
        }
        const missing = Object.keys(params).filter((p) => params[p].default === undefined && !(p in flags));
        assert.deepEqual(missing, [], args);
      }
    });
  }
});
