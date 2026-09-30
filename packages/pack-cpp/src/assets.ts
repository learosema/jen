import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Reads a file from pack-cpp's assets/ directory (vendored, unmodified third-party sources). */
export function readAsset(relPath: string): string {
  return readFileSync(fileURLToPath(new URL(`../assets/${relPath}`, import.meta.url)), 'utf8');
}
