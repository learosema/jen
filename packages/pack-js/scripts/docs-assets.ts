/**
 * Generates the live previews for the docs (docs/js/, gitignored): the modules
 * the pack's generators write (in the JSDoc style, which browsers run as is) and
 * small pages using them – so the docs always run what the pack currently
 * produces. A page opened with `?theme=dark` forces dark mode. Run by `npm run docs`
 * and the Pages workflow:
 *
 *   node packages/pack-js/scripts/docs-assets.ts [outDir]
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context, Helpers } from '@codejen/jen';
import pack from '../src/index.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.argv[2] ?? join(here, '../../../docs/js');

const files = new Map<string, string>();

const ctx: Context = {
  root: '/',
  cwd: '.',
  destDir: '.',
  exists: (p) => files.has(p),
  isDir: () => false,
  read: (p) => files.get(p.replace(/^\//, '')) ?? null,
  readdir: () => [...files.keys()],
  findUp: () => null,
  grep: (name, text) => [...files.keys()].filter((f) => (typeof name === 'string' ? posix.basename(f) === name : name.test(f)) && (!text || files.get(f)!.includes(text))),
};

/** The jen helpers the pack's generators use. */
const words = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_\-./]+/).filter(Boolean);
const pascal = (s: string) => words(s).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
const helpers = {
  pascal,
  camel: (s: string) => pascal(s).charAt(0).toLowerCase() + pascal(s).slice(1),
  kebab: (s: string) => words(s).map((w) => w.toLowerCase()).join('-'),
} as Helpers;

function run(generator: string, answers: Record<string, string | boolean> = {}): void {
  const g = pack[generator];
  const defaults = Object.fromEntries(Object.entries(g.params ?? {}).map(([k, p]) => [k, p.default]));
  for (const a of g.actions({ ...defaults, ...answers, types: 'jsdoc' }, helpers, ctx)) if ('add' in a) files.set(a.add, a.template);
}

run('element', { name: 'my-counter', attrs: 'count:number,label,open:boolean', events: 'change:{value:number}' });
run('roving');
run('menu');
run('grid');
run('hotkeys');
files.delete('elements.d.ts');

// ─── Preview pages ──────────────────────────────────────────────────────────

const DEMO_CSS = `:root { color-scheme: light dark; --accent: light-dark(#4b4bc4, #a9a9ff); --line: light-dark(#d4d4dc, #44444f); --surface: light-dark(#f4f4f8, #24242c); }
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; padding: 1rem; font: 1rem/1.5 system-ui, sans-serif; background: Canvas; color: CanvasText; }
.stack > * + * { margin-block-start: 1rem; }
.row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.label { margin-block-end: 0; font-size: 0.8rem; color: GrayText; }
.stack > .label + * { margin-block-start: 0.35rem; }
button, [role="radio"], [role="tab"], [role="menuitem"] { font: inherit; color: inherit; padding: 0.35em 0.8em; border: thin solid var(--line); border-radius: 0.4em; background: var(--surface); cursor: pointer; }
:focus-visible { outline: 0.15em solid var(--accent); outline-offset: 0.1em; }
[aria-selected="true"], [aria-checked="true"] { border-color: var(--accent); color: var(--accent); font-weight: 600; }
[role="radio"]::before { content: "○ "; }
[role="radio"][aria-checked="true"]::before { content: "● "; }
[role="tabpanel"] { padding: 0.75rem 1rem; border: thin solid var(--line); border-radius: 0.4em; }
output, pre { display: block; margin: 0; padding: 0.5rem 0.75rem; border-radius: 0.4em; background: var(--surface); font: 0.85rem/1.5 ui-monospace, monospace; white-space: pre-wrap; }
kbd { padding: 0.05em 0.4em; border: thin solid var(--line); border-block-end-width: 0.15em; border-radius: 0.3em; font: 0.85em ui-monospace, monospace; }
`;

const page = (title: string, body: string, script: string, style = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script>
  const theme = new URLSearchParams(location.search).get('theme');
  if (theme) document.documentElement.dataset.theme = theme;
</script>
<link rel="stylesheet" href="demo.css">${style ? `\n<style>\n${style}</style>` : ''}
</head>
<body class="stack">
${body}
<script type="module">
${script}
</script>
</body>
</html>
`;

const pages: Record<string, string> = {
  'element.html': page(
    'A custom element',
    `<my-counter count="0" label="Clicks">Light DOM content of &lt;my-counter&gt;</my-counter>
<div class="row"><button id="increment" type="button">count++</button><button id="toggle" type="button">open = !open</button></div>
<output id="out"></output>`,
    `import './my-counter.js';
const counter = document.querySelector('my-counter');
const out = document.querySelector('#out');
const show = (note) => {
  const tag = counter.outerHTML.slice(0, counter.outerHTML.indexOf('>') + 1);
  out.textContent = \`\${tag}\\ncount: \${counter.count} (\${typeof counter.count}), open: \${counter.open}\${note ? \`\\n\${note}\` : ''}\`;
};
counter.addEventListener('change', (event) => show(\`change event, detail.value = \${event.detail.value}\`));
document.querySelector('#increment').addEventListener('click', () => {
  counter.count++;
  counter.emit('change', { value: counter.count });
});
document.querySelector('#toggle').addEventListener('click', () => {
  counter.open = !counter.open;
  show('');
});
show('');`,
    `my-counter { padding: 0.75rem 1rem; border: thin dashed var(--line); border-radius: 0.4em; }
my-counter[open] { border-style: solid; border-color: var(--accent); }
`,
  ),
  'roving.html': page(
    'Roving tabindex',
    `<p class="label">Toolbar – Tab in, then arrow keys</p>
<div role="toolbar" aria-label="Format" class="row"><button type="button">Bold</button><button type="button">Italic</button><button type="button">Underline</button><button type="button">Link</button></div>
<p class="label">Tabs – selection follows focus</p>
<div role="tablist" aria-label="Views" class="row">
<button role="tab" id="tab-1" aria-controls="panel-1" aria-selected="true" type="button">Day</button><button role="tab" id="tab-2" aria-controls="panel-2" type="button">Week</button><button role="tab" id="tab-3" aria-controls="panel-3" type="button">Month</button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">Today's events.</div>
<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>This week's events.</div>
<div role="tabpanel" id="panel-3" aria-labelledby="tab-3" hidden>This month's events.</div>
<p class="label">Radio group – any arrow key</p>
<div role="radiogroup" aria-label="Size" class="row"><span role="radio">Small</span><span role="radio" aria-checked="true">Medium</span><span role="radio">Large</span></div>`,
    `import { rovingTabindex } from './roving-tabindex.js';
for (const root of document.querySelectorAll('[role="toolbar"], [role="tablist"], [role="radiogroup"]')) rovingTabindex(root);`,
  ),
  'menu.html': page(
    'Menus',
    `<p class="label">Menu button – Enter, or Arrow Down/Up to open; type to jump</p>
<button popovertarget="file-menu" type="button" style="anchor-name: --file-menu">File ▾</button>
<div id="file-menu" popover role="menu" aria-label="File" class="menu" style="position-anchor: --file-menu">
<button role="menuitem" type="button">New</button><button role="menuitem" type="button">Open…</button><button role="menuitem" type="button">Save</button><button role="menuitem" type="button">Save as…</button><button role="menuitem" type="button">Close</button>
</div>
<p class="label">Menubar – Tab in, then Left/Right</p>
<div role="menubar" aria-label="Edit" class="row"><button role="menuitem" type="button">Undo</button><button role="menuitem" type="button">Redo</button><button role="menuitem" type="button">Cut</button><button role="menuitem" type="button">Copy</button><button role="menuitem" type="button">Paste</button></div>
<output id="out">Pick something.</output>`,
    `import { menu } from './menu.js';
for (const root of document.querySelectorAll('[role="menu"], [role="menubar"]')) menu(root);
document.addEventListener('click', (event) => {
  const item = event.target instanceof Element && event.target.closest('[role="menuitem"]');
  if (item) document.querySelector('#out').textContent = \`Chose “\${item.textContent}”\`;
});`,
    `.menu { margin: 0; padding: 0.25rem; border: thin solid var(--line); border-radius: 0.4em; flex-direction: column; gap: 0.15rem; }
.menu:popover-open { display: flex; }
.menu [role="menuitem"] { border-color: transparent; text-align: start; }
@supports (position-area: block-end) {
  .menu { inset: auto; position-area: block-end span-inline-end; margin-block-start: 0.25rem; }
}
`,
  ),
  'grid.html': page(
    'Grid navigation',
    `<table role="grid" aria-label="October" class="grid">
<thead><tr role="row">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => `<th role="columnheader">${d}</th>`).join('')}</tr></thead>
<tbody>${Array.from({ length: 5 }, (_, w) => `<tr role="row">${Array.from({ length: 7 }, (_, d) => `<td role="gridcell">${w * 7 + d + 1 <= 31 ? w * 7 + d + 1 : ''}</td>`).join('')}</tr>`).join('')}</tbody>
</table>
<output id="out">Tab into the grid, then arrow keys, Home/End, Ctrl+Home/End.</output>`,
    `import { gridNavigation } from './grid-navigation.js';
const out = document.querySelector('#out');
gridNavigation(document.querySelector('[role="grid"]'), {
  onMove: (cell, row, column) => (out.textContent = \`Row \${row + 1}, column \${column + 1}: \${cell.textContent || '(empty)'}\`),
});`,
    `.grid { border-collapse: collapse; }
.grid th, .grid td { inline-size: 2.5rem; block-size: 2rem; text-align: center; border: thin solid var(--line); }
.grid th { font-size: 0.8rem; color: GrayText; font-weight: 500; }
.grid :focus-visible { outline-offset: -0.15em; }
`,
  ),
  'hotkeys.html': page(
    'Hotkeys',
    `<p>Click into this frame, then press <kbd>?</kbd> for the list.</p>
<div class="row"><input id="search" type="search" placeholder="Search (Ctrl/⌘+K)" aria-label="Search"></div>
<output id="out">No shortcut pressed yet.</output>`,
    `import { createHotkeys } from './hotkeys.js';
const out = document.querySelector('#out');
const search = document.querySelector('#search');
const keys = createHotkeys({ help: true });
keys.bind('mod+k', () => search.focus(), { description: 'Search' });
keys.bind('escape', () => search.blur(), { description: 'Leave the search', scope: search, inputs: true });
keys.bind('g', () => (out.textContent = 'g – ignored while typing in the search field'), { description: 'Say g' });
keys.bind('shift+d', () => (out.textContent = 'Shift+D'), { description: 'Say Shift+D' });`,
    `.hotkeys-help { padding: 1rem 1.25rem; border: thin solid var(--line); border-radius: 0.5em; }
.hotkeys-help::backdrop { background: rgb(0 0 0 / 0.35); }
.hotkeys-help h2 { margin-block: 0 0.5rem; font-size: 1.1rem; }
.hotkeys-help dl { display: grid; grid-template-columns: auto 1fr; gap: 0.35rem 1rem; margin: 0 0 1rem; }
.hotkeys-help dt { display: flex; gap: 0.2rem; }
.hotkeys-help dd { margin: 0; }
input { font: inherit; padding: 0.35em 0.6em; border: thin solid var(--line); border-radius: 0.4em; }
`,
  ),
};

rmSync(outDir, { recursive: true, force: true });
for (const [file, text] of [...files, ['demo.css', DEMO_CSS], ...Object.entries(pages)]) {
  const path = join(outDir, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
console.log(`docs-assets: ${files.size} generated modules + ${Object.keys(pages).length} preview pages → ${outDir}`);
