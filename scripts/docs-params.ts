/**
 * Writes docs/_data/params.json and docs/_data/usage.json (gitignored) for the
 * docs' Params cards and usage blocks (docs/_includes/params.html, usage.html):
 * every generator's params and usage, straight from the packs, so the docs can't
 * drift from `jen <generator> --help`. Run by `npm run docs` and the Pages workflow:
 *
 *   node scripts/docs-params.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnyGenerator } from '@codejen/jen';
import cpp from '../packages/pack-cpp/src/index.ts';
import glsl from '../packages/pack-glsl/src/index.ts';
import js from '../packages/pack-js/src/index.ts';
import web from '../packages/pack-web/src/index.ts';

const docs = join(import.meta.dirname, '../docs');
const packs: Record<string, Record<string, AnyGenerator>> = { cpp, glsl, js, web };

const data: Record<string, Array<{ name: string; required: boolean; default?: string; choices?: readonly string[]; description?: string }>> = {};
const usage: Record<string, string[]> = {};
for (const [prefix, pack] of Object.entries(packs)) {
  for (const [gen, g] of Object.entries(pack)) {
    if (g.usage?.length) usage[`${prefix}:${gen}`] = g.usage;
    data[`${prefix}:${gen}`] = Object.entries(g.params ?? {}).map(([name, spec]) => ({
      name,
      required: spec.default === undefined,
      ...(spec.default !== undefined && spec.default !== '' && { default: String(spec.default) }),
      ...(spec.choices && { choices: spec.choices }),
      ...(spec.description && { description: spec.description }),
    }));
  }
}

// a misspelled generator would otherwise just render no cards
const unknown = readdirSync(docs)
  .filter((f) => f.endsWith('.md'))
  .flatMap((f) => [...readFileSync(join(docs, f), 'utf8').matchAll(/include (params|usage)\.html generator="([^"]+)"/g)].map((m) => [f, m[2], m[1]]))
  .filter(([, gen, kind]) => !(gen in (kind === 'usage' ? usage : data)));
if (unknown.length) {
  console.error(unknown.map(([f, gen, kind]) => `docs-params: ${f} asks for the ${kind} of unknown generator "${gen}" (or one without ${kind})`).join('\n'));
  process.exit(1);
}

writeFileSync(join(docs, '_data/params.json'), `${JSON.stringify(data, null, 2)}\n`);
writeFileSync(join(docs, '_data/usage.json'), `${JSON.stringify(usage, null, 2)}\n`);
console.log(`docs-params: ${Object.keys(data).length} generators → docs/_data/params.json, ${Object.keys(usage).length} with usage → docs/_data/usage.json`);
