/**
 * GLSL has no #include, so the pack ships its functions as plain .glsl files
 * under glsl/<area>/<name>.glsl ("chunks", id `<area>/<name>`), kept as-is
 * apart from a few directive comments at the top:
 *
 *   // @requires util/consts      another chunk this one calls (repeatable)
 *   // @license MIT-0             the pack's own code: no notice to carry along
 *   // @license webgl-noise       third-party code: glsl/licenses/<id>.glsl holds
 *                                 the full notice its license requires
 *   // @license inline            third-party code whose authors accept the
 *                                 chunk's own short header as the notice
 *   // @base value                written against valueNoise, but works on any
 *                                 base noise (see rebase())
 *
 * Every chunk needs at least one @license.
 * Directives are stripped on output; everything else, including the chunk's
 * own attribution line, is emitted verbatim.
 *
 * With `--into=<file>`, every chunk and its dependencies are inserted in
 * dependency order above a `// jen:functions` marker line, each license
 * notice right before the first chunk needing one. jen's insert skips blocks
 * that are already present, so dependencies and notices land once per
 * shader – that's the stand-in for #include. Without `--into`, each chunk
 * becomes its own file under `<dir>/lib/`, carrying its notices, for hosts
 * with an include system.
 */
import type { Action } from '@codejen/jen';
import { fail, inFolder, listGlsl, readPackFile } from './common.ts';

export interface Chunk {
  id: string;
  requires: string[];
  licenses: string[];
  /** The base noise a fractal chunk is written against (`@base`), if it can be rebased. */
  base?: string;
  code: string;
}

/** Base noises: `noise/<base><dim>.glsl`, each defining `<base>Noise(p)` and `<base>Noise(p, period)`. */
export const NOISE_BASES = ['value', 'perlin', 'simplex', 'worley'];

const DIRECTIVE = /^\/\/\s*@(requires|license|base)\s+(\S+)\s*$/;
const cache = new Map<string, Chunk>();

/**
 * Loads a chunk by id. `<id>@<base>` loads a rebased copy of a chunk with an
 * `@base` directive, e.g. `fractal/fbm2@perlin`.
 */
export function loadChunk(id: string): Chunk {
  const cached = cache.get(id);
  if (cached) return cached;
  if (!/^[a-z0-9-]+\/[a-z0-9-]+(?:@[a-z]+)?$/.test(id) || id.startsWith('licenses/')) fail(`unknown GLSL chunk "${id}"`);

  const at = id.indexOf('@');
  if (at >= 0) {
    const rebased = rebase(loadChunk(id.slice(0, at)), id.slice(at + 1));
    cache.set(id, rebased);
    return rebased;
  }

  let text: string;
  try {
    text = readPackFile(`glsl/${id}.glsl`);
  } catch {
    fail(`unknown GLSL chunk "${id}"`);
  }

  const lines = text.replace(/\r\n/g, '\n').trimEnd().split('\n');
  const requires: string[] = [];
  const licenses: string[] = [];
  let base: string | undefined;
  let i = 0;
  for (; i < lines.length; i++) {
    const m = DIRECTIVE.exec(lines[i]);
    if (!m) break;
    if (m[1] === 'requires') requires.push(m[2]);
    else if (m[1] === 'license') licenses.push(m[2]);
    else base = m[2];
  }
  if (licenses.length === 0) fail(`GLSL chunk "${id}" has no // @license directive`);

  const chunk: Chunk = { id, requires, licenses, base, code: lines.slice(i).join('\n') };
  cache.set(id, chunk);
  return chunk;
}

/**
 * GLSL has no function pointers, so a fractal that works on "any noise" is
 * written against one (`// @base value`: calls valueNoise, defines valueFbm)
 * and rebased by renaming: every identifier starting with the base name
 * followed by an uppercase letter gets the new base (valueNoise →
 * perlinNoise, valueFbm → perlinFbm). Requirements follow along: the base
 * noise chunk is swapped, rebasable chunks (warp needs fbm) are rebased too.
 * Each base thus gets its own function names and can share a shader.
 */
function rebase(chunk: Chunk, base: string): Chunk {
  if (!chunk.base) fail(`GLSL chunk "${chunk.id}" has no // @base directive, so it can't use "${base}"`);
  if (!NOISE_BASES.includes(base)) fail(`unknown base noise "${base}" – valid: ${NOISE_BASES.join(', ')}`);
  if (base === chunk.base) return chunk;
  const from = chunk.base;
  const requires = chunk.requires.map((r) => {
    const m = /^noise\/([a-z]+)(\d)$/.exec(r);
    if (m && m[1] === from) return `noise/${base}${m[2]}`;
    return loadChunk(r).base ? `${r}@${base}` : r;
  });
  const code = chunk.code.replace(new RegExp(`\\b${from}(?=[A-Z])`, 'g'), base);
  return { ...chunk, id: `${chunk.id}@${base}`, requires, base: undefined, code };
}

/**
 * The pack's own license: MIT No Attribution. Used instead of the Unlicense
 * or CC0 because German copyright can't be waived into the public domain
 * (§ 29 UrhG) – MIT-0 grants every right without giving copyright up.
 */
export const OWN_LICENSE = 'MIT-0';

/** A license whose notice is the chunk's own header (e.g. psrdnoise's permitted short form). */
export const INLINE_LICENSE = 'inline';

/** The notices a chunk must carry along: one per third-party license, none for MIT-0 or inline ones. */
export function noticesFor(chunk: Chunk): string[] {
  return chunk.licenses.filter((l) => l !== OWN_LICENSE && l !== INLINE_LICENSE);
}

/** The full notice for a third-party license id (glsl/licenses/<id>.glsl). */
export function licenseText(id: string): string {
  if (!/^[a-z0-9-]+$/.test(id)) fail(`invalid license id "${id}"`);
  try {
    return readPackFile(`glsl/licenses/${id}.glsl`).replace(/\r\n/g, '\n').trimEnd();
  } catch {
    fail(`missing license notice glsl/licenses/${id}.glsl`);
  }
}

/** Chunk ids in one area folder, e.g. `chunkIds('util')` → ['util/consts', …]. */
export function chunkIds(area: string): string[] {
  return listGlsl(`glsl/${area}`).map((name) => `${area}/${name}`);
}

/** The chunks for `ids` plus everything they require, dependencies first, each once. */
export function resolveChunks(ids: string[]): Chunk[] {
  const ordered: Chunk[] = [];
  const done = new Set<string>();
  const visiting: string[] = [];

  const visit = (id: string) => {
    if (done.has(id)) return;
    if (visiting.includes(id)) fail(`GLSL chunk dependency cycle: ${[...visiting, id].join(' → ')}`);
    visiting.push(id);
    const chunk = loadChunk(id);
    for (const dep of chunk.requires) visit(dep);
    visiting.pop();
    done.add(id);
    ordered.push(chunk);
  };

  for (const id of ids) visit(id);
  return ordered;
}

/**
 * Picks chunks from an area by a comma-list flag. `all` selects the whole
 * area; nothing or an unknown name fails with the valid names (jen never
 * prompts).
 */
export function pickChunks(area: string, selection: string[], flag: string, generator: string): string[] {
  const available = chunkIds(area).map((id) => id.slice(area.length + 1));
  const valid = `valid: ${available.join(', ')} (or "all")`;
  if (selection.length === 0) fail(`${generator} ${flag}: pick at least one – ${valid}`);
  if (selection.includes('all')) return chunkIds(area);
  const unknown = selection.filter((name) => !available.includes(name));
  if (unknown.length > 0) fail(`${generator} ${flag}: unknown ${unknown.map((u) => `"${u}"`).join(', ')} – ${valid}`);
  return selection.map((name) => `${area}/${name}`);
}

/** The local file name a chunk gets under `<dir>/lib/`: util/rot2 → util-rot2.glsl, fractal/fbm2@perlin → fractal-fbm2-perlin.glsl. */
export function chunkFileName(id: string): string {
  return `${id.replace('/', '-').replace('@', '-')}.glsl`;
}

/**
 * Where --into puts functions: above this marker line. If the shader has
 * none yet, it's inserted before the first function definition, so the
 * pack's functions come before any of your own that call them (a scene's
 * scene(), say). Chunks then pile up above the marker in order, also across
 * runs – inserting each before "the first function" instead would reverse
 * them, and put new ones above helpers they need.
 */
export const INTO_MARKER = '// jen:functions';
const MARKER_LINE = `${INTO_MARKER} – jen glsl:* adds functions above this line`;

/** A function definition (or prototype) starting at column 0: `float scene(`, `vec3 shade(`, `Material pick(`, `void main(`. */
export const FIRST_FUNCTION =
  /^(?:(?:highp|mediump|lowp|precise)\s+)*(?:void|float|double|int|uint|bool|[biud]?vec[234]|d?mat[234](?:x[234])?|[A-Z]\w*)\s+\w+\s*\(/;

/**
 * Actions that put `ids` (plus dependencies and license notices) into a
 * shader (`into`), or into one file each under `<dir>/lib/`.
 */
export function chunkActions(ids: string[], { into, dir }: { into: string; dir: string }): Action[] {
  const chunks = resolveChunks(ids);

  if (into) {
    const actions: Action[] = [{ insert: into, before: FIRST_FUNCTION, line: MARKER_LINE }];
    const noticed = new Set<string>();
    for (const chunk of chunks) {
      for (const license of noticesFor(chunk)) {
        if (noticed.has(license)) continue;
        noticed.add(license);
        actions.push({ insert: into, before: INTO_MARKER, line: `${licenseText(license)}\n` });
      }
      // The trailing empty line keeps one blank line between chunks.
      actions.push({ insert: into, before: INTO_MARKER, line: `${chunk.code}\n` });
    }
    return actions;
  }

  return chunks.map((chunk) => {
    const notices = noticesFor(chunk).map((l) => `${licenseText(l)}\n\n`).join('');
    const needs = chunk.requires.length
      ? `// Needs (include first): ${chunk.requires.map(chunkFileName).join(', ')}\n\n`
      : '';
    return {
      add: inFolder(dir, `lib/${chunkFileName(chunk.id)}`),
      template: `${notices}${needs}${chunk.code}\n`,
    };
  });
}
