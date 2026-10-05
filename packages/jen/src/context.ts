/**
 * Where a generator's files go, and what it may know about the project: a
 * read-only probe of the file system below the project root. jen places the
 * actions (paths relative to the destination, `Find` targets) – generators stay
 * pure functions of (answers, helpers, ctx), so packs can unit-test them with a plain object.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import type { Action, Context, Find, Params, Placed, Probe } from './core.ts';

const toPosix = (p: string): string => p.split(sep).join('/') || '.';

/** Directories grep() never descends into. */
const SKIP = /^(node_modules|\.git|build|dist|out|\.cache|_deps|cmake-build.*)$/;
const GREP_DEPTH = 4;
const GREP_FILES = 5000;

/** Read-only file system probe; every path is relative to `root`, results use `/`. */
export function probe(root: string): Probe {
  const abs = (p: string): string => resolve(root, p.replace(/^\/+/, ''));
  const read = (p: string): string | null => {
    try {
      return readFileSync(abs(p), 'utf8');
    } catch {
      return null;
    }
  };
  const has = (file: string, text?: string): boolean => text === undefined || (read(file) ?? '').includes(text);
  return {
    exists: (p) => existsSync(abs(p)),
    isDir: (p) => {
      try {
        return statSync(abs(p)).isDirectory();
      } catch {
        return false;
      }
    },
    read,
    readdir: (p) => {
      try {
        return readdirSync(abs(p)).sort();
      } catch {
        return [];
      }
    },
    findUp(name, text, from = '.') {
      for (let dir = posix.normalize(from); ; dir = posix.dirname(dir)) {
        const file = posix.join(dir, name);
        if (existsSync(abs(file)) && has(file, text)) return file;
        if (dir === '.' || dir === '/' || dir.startsWith('..')) return null;
      }
    },
    grep(name, text) {
      const found: string[] = [];
      let seen = 0;
      const walk = (dir: string, depth: number): void => {
        let entries;
        try {
          entries = readdirSync(abs(dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
        } catch {
          return;
        }
        for (const e of entries) {
          if (++seen > GREP_FILES) return;
          const path = dir === '.' ? e.name : `${dir}/${e.name}`;
          if (e.isDirectory()) {
            if (depth < GREP_DEPTH && !SKIP.test(e.name)) walk(path, depth + 1);
          } else if ((typeof name === 'string' ? e.name === name : name.test(e.name)) && has(path, text)) {
            found.push(path);
          }
        }
      };
      walk('.', 0);
      // shallowest first
      return found.sort((a, b) => a.split('/').length - b.split('/').length);
    },
  };
}

/** `path` relative to `base` (both relative to the root) as a root-relative path; null if it leaves the root. */
function within(base: string, path: string): string | null {
  const p = posix.normalize(posix.join(base, path));
  return p === '..' || p.startsWith('../') ? null : p;
}

/**
 * The Context handed to a generator: the probe plus where its files go – the
 * `--dir` flag (relative to the cwd), else the cwd.
 */
export function buildContext(flag: string, root: string, cwd: string): Context {
  const here = toPosix(relative(root, cwd));
  const destDir = flag ? within(here, toPosix(flag)) : here;
  if (destDir === null || isAbsolute(flag)) throw new Error(`--dir=${flag} is outside the project root (${root}).`);
  return { ...probe(root), root, cwd: here, destDir };
}

/**
 * Turns the `path: true` params the user gave (relative to the cwd) into action
 * paths from the project root (`/src/app.cpp`); fails for one outside the project.
 */
export function resolvePathParams(params: Params, answers: Record<string, unknown>, ctx: Context): void {
  for (const [name, spec] of Object.entries(params)) {
    const value = answers[name];
    if (!spec.path || typeof value !== 'string' || value === '') continue;
    const p = isAbsolute(value) ? null : within(ctx.cwd, toPosix(value));
    if (p === null) throw new Error(`--${name}=${value} is outside the project root (${ctx.root}).`);
    answers[name] = `/${p}`;
  }
}

/** The file a `Find` names: the nearest at or above `from`, else the shallowest in the project. */
export function locate(ctx: Context, { find, containing }: Find, from: string): string | null {
  const matches = (name: string): boolean => {
    if (typeof find === 'string') return name === find;
    find.lastIndex = 0; // a /g RegExp would otherwise carry state between names
    return find.test(name);
  };
  const has = (file: string): boolean => containing === undefined || (ctx.read(file) ?? '').includes(containing);
  for (let dir = from; ; dir = posix.dirname(dir)) {
    for (const name of ctx.readdir(dir)) {
      const file = dir === '.' ? name : `${dir}/${name}`;
      if (matches(name) && !ctx.isDir(file) && has(file)) return file;
    }
    if (dir === '.') break;
  }
  return ctx.grep(find, containing)[0] ?? null;
}

/**
 * Places a generator's actions: paths become relative to the project root (from
 * the destination, or from the root for `/…`), `Find` targets are looked up, and
 * an insert's `path` becomes its line. What can't be found is skipped with a note.
 */
export function placeActions(actions: Action[], ctx: Context): Placed[] {
  const place = (path: string): string =>
    path.startsWith('/') ? posix.normalize(path.slice(1)) || '.' : posix.normalize(posix.join(ctx.destDir, path));
  const target = (t: string | Find, marker?: string | RegExp): string | { skip: string; note: string } => {
    if (typeof t === 'string') return place(t);
    const find = { containing: typeof marker === 'string' ? marker : undefined, ...t };
    const file = locate(ctx, find, ctx.destDir);
    if (file) return file;
    const what = typeof find.find === 'string' ? find.find : String(find.find);
    return {
      skip: posix.join(ctx.destDir, what),
      note: `no ${what}${find.containing ? ` containing "${find.containing}"` : ''} found, skipped`,
    };
  };
  return actions.map((a): Placed => {
    if ('add' in a) return { ...a, add: place(a.add) };
    if ('delete' in a) return { ...a, delete: place(a.delete) };
    if ('modify' in a) {
      const file = target(a.modify);
      return typeof file === 'string' ? { ...a, modify: file } : file;
    }
    const file = target(a.insert, a.before);
    if (typeof file !== 'string') return file;
    const line = 'path' in a ? posix.relative(posix.dirname(file), place(a.path)) : a.line;
    return { insert: file, before: a.before, line };
  });
}
