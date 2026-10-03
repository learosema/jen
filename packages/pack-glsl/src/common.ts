import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function fail(message: string): never {
  throw new Error(message);
}

/** Absolute path of a file or folder shipped with the pack (glsl/, starters/), from src/ or dist/ alike. */
export function packPath(relPath: string): string {
  return fileURLToPath(new URL(`../${relPath}`, import.meta.url));
}

/** Reads a file shipped with the pack, e.g. `starters/frag.glsl`. */
export function readPackFile(relPath: string): string {
  return readFileSync(packPath(relPath), 'utf8');
}

/** File names (without `.glsl`) in a pack folder, sorted. */
export function listGlsl(relDir: string): string[] {
  return readdirSync(packPath(relDir))
    .filter((f) => f.endsWith('.glsl'))
    .map((f) => f.slice(0, -'.glsl'.length))
    .sort();
}

/** Joins a folder and a relative path; `.` or empty means no prefix. */
export function inFolder(folder: string, path: string): string {
  // Trailing slashes stripped in a loop: `/\/+$/` backtracks quadratically.
  let end = folder.length;
  while (end > 0 && folder[end - 1] === '/') end--;
  const dir = folder.slice(0, end);
  return !dir || dir === '.' ? path : `${dir}/${path}`;
}

/** Parses a comma-separated list flag ("box, torus") into trimmed, non-empty items. */
export function parseList(spec: string): string[] {
  return spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
