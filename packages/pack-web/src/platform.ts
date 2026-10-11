/** Where web:manifest and web:sw put what the site serves: public/ in a project that has one or builds with Vite, else the destination. */
import { posix } from 'node:path';
import type { Context } from '@codejen/jen';

/** The folder served at the site's root (root-relative), or null if the files go to the destination. */
export const publicDir = (ctx: Context): string | null => (ctx.isDir('public') || usesVite(ctx) ? 'public' : null);

/** A served file's place: the action path, and the path from the project root. */
export function served(ctx: Context, file: string): { add: string; path: string } {
  const pub = publicDir(ctx);
  return pub ? { add: `/${pub}/${file}`, path: `${pub}/${file}` } : { add: file, path: posix.join(ctx.destDir, file) };
}

/** A project path as the browser sees it: files in public/ are served from the root. */
export const servedPath = (ctx: Context, path: string): string => {
  const pub = publicDir(ctx);
  return pub && path.startsWith(`${pub}/`) ? path.slice(pub.length + 1) : path;
};

/** Whether the project builds with Vite: its package.json lists vite, or there's a Vite config. */
export function usesVite(ctx: Context): boolean {
  const pkg = ctx.findUp('package.json', undefined, ctx.destDir);
  if (pkg && /"vite"\s*:/.test(ctx.read(pkg) ?? '')) return true;
  return ctx.grep(/^vite\.config\.[cm]?[jt]s$/).length > 0;
}

/** The project's name from its package.json (without a scope), or null. */
export function packageName(ctx: Context): string | null {
  const pkg = ctx.findUp('package.json', undefined, ctx.destDir);
  const name = pkg && /"name"\s*:\s*"([^"]+)"/.exec(ctx.read(pkg) ?? '')?.[1];
  return name ? name.replace(/^@[^/]+\//, '') : null;
}
