/**
 * Search path locations: the project's .jen/ (found by walking up from cwd),
 * and the user config directory. ROOT is mutable – --where overrides it for
 * a single run, and every other module sees that change via this binding.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export function findUp(name: string, dir = process.cwd()): string | null {
  for (;;) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export const PROJECT_JEN = findUp('.jen');

export let ROOT = PROJECT_JEN ? dirname(PROJECT_JEN) : process.cwd();

export function setRoot(root: string): void {
  ROOT = root;
}

export const USER_DIR = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, 'jen')
  : process.platform === 'win32'
    ? join(process.env.APPDATA ?? homedir(), 'jen')
    : join(homedir(), '.config', 'jen');
