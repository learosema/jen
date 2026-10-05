/**
 * Generates the live previews for the docs (docs/glsl/, gitignored): the
 * <shader-canvas> element and every shader the GLSL recipes page shows, made
 * by the pack's own generators – so the docs always show what the pack
 * currently produces. Run by `npm run docs` and the Pages workflow:
 *
 *   node packages/pack-glsl/scripts/docs-assets.ts [outDir]
 *
 * Inserts are applied like jen does (at the marker, skipping blocks already
 * present); indentation isn't re-rendered, which only matters for looks.
 */
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Action, Helpers } from '@codejen/jen';
import pack from '../src/index.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(process.argv[2] ?? join(here, '../../../docs/glsl'));

const words = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_\-./]+/).filter(Boolean);
const helpers: Helpers = {
  pascal: (s) => words(s).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(''),
  camel: (s) => {
    const p = helpers.pascal(s);
    return p.charAt(0).toLowerCase() + p.slice(1);
  },
  snake: (s) => words(s).map((w) => w.toLowerCase()).join('_'),
  kebab: (s) => words(s).map((w) => w.toLowerCase()).join('-'),
  constant: (s) => words(s).map((w) => w.toUpperCase()).join('_'),
};

function apply(actions: Action[], files: Map<string, string>): void {
  for (const a of actions) {
    if ('add' in a) {
      if (!files.has(a.add)) files.set(a.add, a.template);
    } else if ('insert' in a) {
      // the GLSL generators insert into a shader they name, with a plain line
      if (typeof a.insert !== 'string' || !('line' in a)) throw new Error('docs-assets: only plain inserts are supported');
      const lines = (files.get(a.insert) ?? '').split('\n');
      const block = a.line.split('\n');
      if (lines.some((_, k) => block.every((b, j) => lines[k + j]?.trim() === b.trim()))) continue;
      const marker = a.before;
      const i = lines.findIndex((l) => (typeof marker === 'string' ? l.includes(marker) : marker.test(l)));
      if (i < 0) throw new Error(`docs-assets: marker ${String(marker)} not found in ${a.insert}`);
      lines.splice(i, 0, ...block);
      files.set(a.insert, lines.join('\n'));
    }
  }
}

/** Runs a generator with its defaults plus `answers`, writing into the in-memory `files`. */
function run(files: Map<string, string>, generator: string, answers: Record<string, string | boolean>): void {
  const g = pack[generator];
  const defaults = Object.fromEntries(Object.entries(g.params ?? {}).map(([k, p]) => [k, p.default]));
  apply(g.actions({ ...defaults, ...answers }, helpers, {} as never), files); // they don't look at the project
}

const files = new Map<string, string>();
run(files, 'frag', { name: 'starter' });
for (const kind of ['value', 'perlin', 'simplex', 'worley', 'fbm', 'turbulence', 'ridged', 'warp', 'curl']) {
  run(files, 'noise', { kind, name: `noise-${kind}`, tile: true });
}
run(files, 'sdf', { shapes: 'all', name: 'sdf-2d' });
run(files, 'sdf', { dim: '3', shapes: 'all', name: 'sdf-3d' });
for (const lighting of ['lambert', 'blinn', 'toon', 'pbr']) run(files, 'raymarch', { name: `raymarch-${lighting}`, lighting });
run(files, 'raymarch', { name: 'raymarch-materials', lighting: 'pbr', materials: true });
run(files, 'displace', { kind: 'noise', name: 'displace-noise' });
run(files, 'displace', { kind: 'waves', name: 'displace-waves' });

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [file, text] of files) writeFileSync(join(outDir, basename(file)), text);
copyFileSync(join(here, '../web/shader-canvas/shader-canvas.js'), join(outDir, 'shader-canvas.js'));
console.log(`docs-assets: ${files.size} shaders + shader-canvas.js → ${outDir}`);
