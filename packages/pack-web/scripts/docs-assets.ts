/**
 * Generates the live previews for the docs (docs/web/, gitignored): the CSS a
 * `web:cube` + `web:card` + `web:avatars` run produces, and small preview
 * pages using it – so the docs always show what the pack currently produces.
 * A page opened with `?theme=dark` forces dark mode, so the docs can show
 * both side by side. Run by `npm run docs` and the Pages workflow:
 *
 *   node packages/pack-web/scripts/docs-assets.ts [outDir]
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Action, Context, Helpers } from '@codejen/jen';
import pack from '../src/index.ts';
import { groupsFor } from '../src/palette.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(process.argv[2] ?? join(here, '../../../docs/web'));

const COLORS = { primary: '#5b5bd6', secondary: '330' };

const files = new Map<string, string>();

/** jen's Context over the in-memory files, with everything going to css/. */
const ctx: Context = {
  root: '/',
  cwd: 'css',
  destDir: 'css',
  exists: (p) => files.has(p),
  isDir: (p) => [...files.keys()].some((f) => f.startsWith(`${p}/`)),
  read: (p) => files.get(p) ?? null,
  readdir: (dir) => [...files.keys()].filter((f) => posix.dirname(f) === dir).map((f) => posix.basename(f)),
  findUp: () => null,
  grep: (name, text) =>
    [...files.keys()].filter((f) => (typeof name === 'string' ? posix.basename(f) === name : name.test(f)) && (!text || files.get(f)!.includes(text))),
};

const place = (path: string) => (path.startsWith('/') ? path.slice(1) : posix.join(ctx.destDir, path));

function apply(actions: Action[]): void {
  for (const a of actions) {
    if ('add' in a) {
      if (!files.has(place(a.add))) files.set(place(a.add), a.template);
    } else if ('insert' in a) {
      if (typeof a.insert !== 'string' || !('line' in a)) throw new Error('docs-assets: only plain inserts are supported');
      const file = place(a.insert);
      const lines = (files.get(file) ?? '').split('\n');
      if (lines.includes(a.line)) continue;
      const i = lines.findIndex((l) => l.includes(String(a.before)));
      if (i < 0) throw new Error(`docs-assets: marker ${String(a.before)} not found in ${file}`);
      lines.splice(i, 0, a.line);
      files.set(file, lines.join('\n'));
    }
  }
}

function run(generator: string, answers: Record<string, string | boolean> = {}): void {
  const g = pack[generator];
  const defaults = Object.fromEntries(Object.entries(g.params ?? {}).map(([k, p]) => [k, p.default]));
  apply(g.actions({ ...defaults, ...answers }, {} as Helpers, ctx));
}

run('cube', COLORS);
run('card');
run('avatars');

// ─── Preview pages ──────────────────────────────────────────────────────────

const page = (title: string, body: string, style = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script>
  const theme = new URLSearchParams(location.search).get('theme');
  if (theme) document.documentElement.dataset.theme = theme;
</script>
<link rel="stylesheet" href="css/styles.css">
<style>
  /* In the base layer, so the pack's utilities still win over the demo boxes. */
  @layer base {
    body { padding: 1rem; }
    .box { padding: 0.75rem 1rem; border: thin solid var(--color-border); border-radius: 0.5rem; background: var(--color-surface-2); }
    .tint { background: var(--color-primary-subtle); }
${style}
  }
</style>
</head>
<body>
${body}
</body>
</html>
`;

const boxes = (n: number, cls = 'box', label = (i: number) => `Item ${i}`) =>
  Array.from({ length: n }, (_, i) => `<div class="${cls}">${label(i + 1)}</div>`).join('\n');

const groups = groupsFor({ ...COLORS });
const hex = (group: string, n: number) => groups.find((g) => g.name === group)!.shades[n - 1];

/** A small landscape picture in the palette's colors, as an SVG data URI. */
const picture = (group: string, seed: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="${hex(group, 2)}"/>` +
      `<circle cx="${40 + seed * 25}" cy="38" r="16" fill="${hex(group, 1)}"/>` +
      `<path d="M0 120 L${30 + seed * 10} 60 L90 120Z" fill="${hex(group, 4)}"/><path d="M50 120 L${100 + seed * 8} 50 L160 120Z" fill="${hex(group, 5)}"/></svg>`,
  )}`;

const avatar = (letter: string, group: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${hex(group, 3)}"/>` +
      `<text x="32" y="42" font-family="system-ui,sans-serif" font-size="28" font-weight="700" text-anchor="middle" fill="${hex(group, 6)}">${letter}</text></svg>`,
  )}`;

const pages: Record<string, string> = {
  'palette.html': page(
    'Palette',
    groups
      .map(
        (g) =>
          `<div class="row"><span class="name">${g.name}</span>${g.shades
            .map((h, i) => `<span class="swatch" style="background: var(--color-${g.name}-${i + 1}); color: var(--color-${g.name}-${i < 3 ? 6 : 1})"><b>${i + 1}</b>${h}</span>`)
            .join('')}</div>`,
      )
      .join('\n'),
    `    .row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.25rem; margin-block-end: 0.5rem; }
    .name { grid-column: 1 / -1; font-size: 0.8rem; color: var(--color-text-muted); }
    .swatch { display: grid; padding: 0.3rem 0.4rem; border-radius: 0.375rem; font: 0.65rem/1.3 ui-monospace, monospace; overflow: hidden; }`,
  ),
  'roles.html': page(
    'Role tokens',
    `<div class="flow">
<p>Text on <code>--color-surface</code>, <span class="color-text-muted">muted text</span> and a <a href="#">link</a>.</p>
<div class="box flow"><p>On <code>--color-surface-2</code>: text, <span class="color-text-muted">muted text</span>, <a href="#" class="color-primary-strong">a strong link</a>.</p></div>
<div class="cluster">
<span class="box bg-primary color-on-primary">on-primary</span>
<span class="box tint color-primary-strong">primary-strong on subtle</span>
<span class="box bg-secondary color-on-secondary">on-secondary</span>
<span class="box bg-danger color-on-danger">on-danger</span>
<span class="box bg-success-subtle color-success-strong">success</span>
<span class="box bg-warning-subtle color-warning-strong">warning</span>
</div>
<p class="step-4 color-primary-large"><b>Large text in -large</b></p>
</div>`,
  ),
  'buttons.html': page(
    'Buttons',
    `<div class="cluster">
<button class="button">Primary</button>
<button class="button button--secondary">Secondary</button>
<button class="button button--danger">Delete</button>
<button class="button button--outline">Outline</button>
<button class="button button--ghost">Ghost</button>
<button class="button button--pill">Pill</button>
<button class="button button--small">Small</button>
<button class="button" disabled>Disabled</button>
</div>`,
  ),
  'fluid.html': page(
    'Fluid scales',
    `<div class="flow" style="--flow-space: 0.25em">
${[5, 4, 3, 2, 1, 0, -1, -2].map((n) => `<p class="step-${n}">step ${n}</p>`).join('\n')}
</div>`,
  ),
  'base.html': page(
    'Base styles',
    `<div class="flow">
<h2 id="base">A heading with an anchor <a href="#base" aria-label="Link to this section">#</a></h2>
<p>Body text in <code>--step-0</code> with a <a href="#">link</a>. Paragraphs wrap with <code>text-wrap: pretty</code>.</p>
<ul><li data-icon="✅">List items with</li><li data-icon="🎨">icons from data-icon</li></ul>
<hr>
<p><button class="button">Focus me with Tab</button></p>
</div>`,
  ),
  'compositions-flow.html': page('.flow', `<div class="flow">${boxes(3)}</div>`),
  'compositions-cluster.html': page('.cluster', `<div class="cluster">${boxes(9, 'box', (i) => ['tags', 'wrap', 'as', 'a', 'group', 'with', 'even', 'gaps', '✓'][i - 1])}</div>`),
  'compositions-repel.html': page('.repel', `<div class="repel"><strong class="step-1">Logo</strong><nav class="cluster"><a href="#">Docs</a><a href="#">Blog</a><a href="#">About</a></nav></div>`),
  'compositions-sidebar.html': page('.sidebar', `<div class="sidebar"><aside class="box">Sidebar</aside><div class="box tint">Content – stacks below the sidebar when it would get narrower than half the width.</div></div>`),
  'compositions-switcher.html': page('.switcher', `<div class="switcher">${boxes(3)}</div>`),
  'compositions-grid.html': page('.grid', `<div class="grid" style="--grid-min-item-size: 10rem">${boxes(5)}</div>`),
  'compositions-wrapper.html': page('.wrapper', `<div class="wrapper box tint" style="--wrapper-max-width: 30rem">Centered up to --wrapper-max-width, never touching the edges.</div>`),
  'compositions-center.html': page('.center', `<div class="center box" style="min-block-size: 8rem">Centered</div>`),
  'compositions-overlay.html': page(
    '.overlay',
    `<div class="overlay" style="max-inline-size: 24rem"><img src="${picture('primary', 1)}" alt=""><p class="center step-2" style="color: var(--color-primary-6)"><b>Text over a picture</b></p></div>`,
  ),
  'compositions-breakout.html': page(
    '.breakout',
    `<div class="breakout flow" style="--breakout-max-width: 24rem; --breakout-wide: 6rem">
<p class="box">The text column.</p>
<p class="box tint" data-breakout="wide">data-breakout="wide"</p>
<p class="box" data-breakout="full">data-breakout="full"</p>
<p class="box">Back in the column.</p>
</div>`,
    '  body { padding-inline: 0; }',
  ),
  'compositions-reel.html': page('.reel', `<div class="reel" style="--reel-item-size: 12rem">${boxes(8, 'box tint', (i) => `Slide ${i}`)}</div>`),
  'compositions-gallery.html': page(
    '.gallery',
    `<ul class="gallery" role="list" style="--gallery-min-item-size: 9rem">${[1, 2, 3, 4].map((i) => `<li><img src="${picture(i % 2 ? 'primary' : 'secondary', i)}" alt=""></li>`).join('')}</ul>`,
  ),
  'card.html': page(
    'Cards',
    `<div class="grid" style="--grid-min-item-size: 10rem">
<article class="card"><img src="${picture('primary', 1)}" alt=""><h3>With media</h3><p>Text with a <a href="#">link</a>.</p><footer><button class="button button--small">Open</button></footer></article>
<article class="card"><h3>Text only</h3><p>Longer text, so the footers have to line up across the row.</p><footer><button class="button button--small">Open</button></footer></article>
<article class="card"><img src="${picture('secondary', 3)}" alt=""><h3>Short</h3><footer><button class="button button--small button--outline">Open</button></footer></article>
</div>`,
  ),
  'avatars.html': page(
    'Avatars',
    `<ul class="avatars">${['A', 'B', 'C', 'D', 'E'].map((l, i) => `<li><a href="#"><img src="${avatar(l, i % 2 ? 'secondary' : 'primary')}" alt="${l}"></a></li>`).join('')}</ul>`,
  ),
};

rmSync(outDir, { recursive: true, force: true });
for (const [file, text] of [...files, ...Object.entries(pages)]) {
  const path = join(outDir, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
console.log(`docs-assets: ${files.size} stylesheets + ${Object.keys(pages).length} preview pages → ${outDir}`);
