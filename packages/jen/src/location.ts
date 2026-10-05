/**
 * Search path locations: the project's .jen/ (found by walking up from cwd),
 * and the user config directory.
 */
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

export interface ProjectRoot {
  root: string;
  /** What identified it: ".jen", "package.json" or ".git". */
  marker: string;
}

/**
 * Whether a .jen/ found on the way up may be loaded: generators in it are
 * imported and run, so it must belong to the current user and not be
 * world-writable – otherwise anyone who can create /tmp/.jen or /home/.jen
 * runs code as you (cf. git's safe.directory). No uid on Windows: trusted.
 */
function isTrusted(path: string): boolean {
  if (!process.getuid) return true;
  const { uid, mode } = statSync(path);
  return uid === process.getuid() && (mode & 0o002) === 0;
}

/**
 * The nearest .jen/ above `dir`, searched no further than the repository
 * (a directory holding .git) or, when starting inside it, the home directory.
 * Within those bounds it wins however far up it is, e.g. at a monorepo root.
 */
export function findJenDir(dir = process.cwd()): string | null {
  const home = homedir();
  dir = resolve(dir);
  const inHome = dir === home || dir.startsWith(home + sep);
  for (let d = dir; ; d = dirname(d)) {
    const candidate = join(d, '.jen');
    if (existsSync(candidate)) {
      if (isTrusted(candidate)) return candidate;
      process.stderr.write(`jen: ignoring ${candidate}: not owned by you, or writable by others\n`);
      return null;
    }
    if (existsSync(join(d, '.git')) || (inHome && d === home) || dirname(d) === d) return null;
  }
}

/**
 * The project root for `dir`: the parent of the nearest .jen/ (see
 * findJenDir), otherwise the nearest directory holding a package.json or
 * .git. Null if there is none.
 */
export function findProjectRoot(dir = process.cwd()): ProjectRoot | null {
  const jen = findJenDir(dir);
  if (jen) return { root: dirname(jen), marker: '.jen' };
  for (let d = resolve(dir); ; d = dirname(d)) {
    for (const marker of ['package.json', '.git']) if (existsSync(join(d, marker))) return { root: d, marker };
    if (dirname(d) === d) return null;
  }
}

export const PROJECT_JEN = findJenDir();

/** The project found from the cwd, if any – what additions are scaffolded into. */
export const PROJECT = findProjectRoot();

export const ROOT = PROJECT?.root ?? process.cwd();

export const USER_DIR = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, 'jen')
  : process.platform === 'win32'
    ? join(process.env.APPDATA ?? homedir(), 'jen')
    : join(homedir(), '.config', 'jen');
