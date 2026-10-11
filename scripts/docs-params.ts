/**
 * Writes docs/_data/params.json (gitignored) for the docs' Params cards
 * (docs/_includes/params.html): every generator's params, straight from the
 * packs, so the cards can't drift from `jen <generator> --help`. Run by
 * `npm run docs` and the Pages workflow:
 *
 *   node scripts/docs-params.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pack } from '@codejen/jen';
import cpp from '../packages/pack-cpp/src/index.ts';
import glsl from '../packages/pack-glsl/src/index.ts';
import js from '../packages/pack-js/src/index.ts';
import web from '../packages/pack-web/src/index.ts';

const docs = join(import.meta.dirname, '../docs');
const packs: Record<string, Pack> = { cpp, glsl, js, web };

const data: Record<string, Array<{ name: string; required: boolean; default?: string; description?: string }>> = {};
for (const [prefix, pack] of Object.entries(packs)) {
  for (const [gen, g] of Object.entries(pack)) {
    data[`${prefix}:${gen}`] = Object.entries(g.params ?? {}).map(([name, spec]) => ({
      name,
      required: spec.default === undefined,
      ...(spec.default !== undefined && spec.default !== '' && { default: String(spec.default) }),
      ...(spec.description && { description: spec.description }),
    }));
  }
}

// a misspelled generator would otherwise just render no cards
const unknown = readdirSync(docs)
  .filter((f) => f.endsWith('.md'))
  .flatMap((f) => [...readFileSync(join(docs, f), 'utf8').matchAll(/include params\.html generator="([^"]+)"/g)].map((m) => [f, m[1]]))
  .filter(([, gen]) => !(gen in data));
if (unknown.length) {
  console.error(unknown.map(([f, gen]) => `docs-params: ${f} asks for unknown generator "${gen}"`).join('\n'));
  process.exit(1);
}

writeFileSync(join(docs, '_data/params.json'), `${JSON.stringify(data, null, 2)}\n`);
console.log(`docs-params: ${Object.keys(data).length} generators → docs/_data/params.json`);
