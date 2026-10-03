/**
 * GLSL has no #include, so the pack ships its functions as plain .glsl files
 * under glsl/<area>/<name>.glsl ("chunks", id `<area>/<name>`), kept as-is
 * apart from a few directive comments at the top:
 *
 *   // @requires util/consts      another chunk this one calls (repeatable)
 *   // @license MIT-0             the pack's own code: no notice to carry along
 *   // @license gustavson         third-party code: glsl/licenses/<id>.glsl holds
 *                                 the full notice its license requires
 *
 * Every chunk needs at least one @license.
 * Directives are stripped on output; everything else, including the chunk's
 * own attribution line, is emitted verbatim.
 *
 * With `--into=<file>`, every chunk and its dependencies are inserted before
 * `void main(` in dependency order, each license notice right before the
 * first chunk needing one. jen's insert skips blocks that are already
 * present, so dependencies and notices land once per shader – that's the
 * stand-in for #include. Without `--into`, each chunk becomes its own file
 * under `<dir>/lib/`, carrying its notices, for hosts with an include system.
 */
import type { Action } from '@codejen/jen';
import { fail, inFolder, listGlsl, readPackFile } from './common.ts';

export interface Chunk {
  id: string;
  requires: string[];
  licenses: string[];
  code: string;
}

const DIRECTIVE = /^\/\/\s*@(requires|license)\s+(\S+)\s*$/;
const cache = new Map<string, Chunk>();

export function loadChunk(id: string): Chunk {
  const cached = cache.get(id);
  if (cached) return cached;
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(id) || id.startsWith('licenses/')) fail(`unknown GLSL chunk "${id}"`);

  let text: string;
  try {
    text = readPackFile(`glsl/${id}.glsl`);
  } catch {
    fail(`unknown GLSL chunk "${id}"`);
  }

  const lines = text.replace(/\r\n/g, '\n').trimEnd().split('\n');
  const requires: string[] = [];
  const licenses: string[] = [];
  let i = 0;
  for (; i < lines.length; i++) {
    const m = DIRECTIVE.exec(lines[i]);
    if (!m) break;
    (m[1] === 'requires' ? requires : licenses).push(m[2]);
  }
  if (licenses.length === 0) fail(`GLSL chunk "${id}" has no // @license directive`);

  const chunk: Chunk = { id, requires, licenses, code: lines.slice(i).join('\n') };
  cache.set(id, chunk);
  return chunk;
}

/**
 * The pack's own license: MIT No Attribution. Used instead of the Unlicense
 * or CC0 because German copyright can't be waived into the public domain
 * (§ 29 UrhG) – MIT-0 grants every right without giving copyright up.
 */
export const OWN_LICENSE = 'MIT-0';

/** The notices a chunk must carry along: one per third-party license, none for MIT-0. */
export function noticesFor(chunk: Chunk): string[] {
  return chunk.licenses.filter((l) => l !== OWN_LICENSE);
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

/** The local file name a chunk gets under `<dir>/lib/`: util/rot2 → util-rot2.glsl. */
export function chunkFileName(id: string): string {
  return `${id.replace('/', '-')}.glsl`;
}

/** Marker for --into: functions go right above main(), so any shader works, no marker needed. */
export const INTO_MARKER = 'void main(';

/**
 * Actions that put `ids` (plus dependencies and license notices) into a
 * shader (`into`), or into one file each under `<dir>/lib/`.
 */
export function chunkActions(ids: string[], { into, dir }: { into: string; dir: string }): Action[] {
  const chunks = resolveChunks(ids);

  if (into) {
    const actions: Action[] = [];
    const noticed = new Set<string>();
    for (const chunk of chunks) {
      for (const license of noticesFor(chunk)) {
        if (noticed.has(license)) continue;
        noticed.add(license);
        actions.push({ insert: into, before: INTO_MARKER, line: `${licenseText(license)}\n` });
      }
      // The trailing empty line keeps one blank line between chunks and before main().
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
