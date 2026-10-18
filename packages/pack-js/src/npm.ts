/** The npm registry, through the user's own npm: `npm create vite@latest` and the latest versions of packages. */
import { execFileSync } from 'node:child_process';
import { fail } from './common.ts';

/** Runs npm with fixed arguments (never a package name from the command line) and returns what it prints. */
export function npm(generator: string, args: string[], cwd: string): string {
  if (process.env.JEN_NO_FETCH) fail(`${generator} needs the npm registry, and JEN_NO_FETCH is set`);
  try {
    // npm is npm.cmd on Windows, which only runs in a shell; the arguments are checked names, nothing to escape.
    return execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  } catch (error) {
    const { stderr } = error as { stderr?: string };
    fail(`${generator}: npm ${args.join(' ')} failed${stderr?.trim() ? `:\n${stderr.trim()}` : ''}`);
  }
}

/** `^` and the latest version, as `npm install` would write it. */
export const latest = (generator: string, pkg: string, cwd: string): string => `^${npm(generator, ['view', pkg, 'version'], cwd).trim()}`;
