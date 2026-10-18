/** What every Yeoman runner shares: jen's flags as Yeoman sees them, prompts answered without prompting, mem-fs files as jen actions. */
import type { Action, Args, Context, PackEnv } from '@codejen/jen';
import { Socket } from 'node:net';
import { join, relative, sep } from 'node:path';

export interface Question {
  name: string;
  default?: unknown;
  when?: unknown;
  [key: string]: unknown;
}

export interface MemFsFile {
  path: string;
  contents: Buffer | null;
  state?: string;
}

/** Generators jen may fetch on the fly: a fixed list, so a typo (yeoman:jhispter) can never install someone else's package. */
export const FETCHABLE: readonly string[] = ['generator-code', 'generator-jhipster'];

/** Whether `name` is installed – by its package.json, since a generator package's main may not resolve. */
export const isInstalled = (env: PackEnv, name: string): boolean => env.resolve(`${name}/package.json`) !== null;

/** The first of `paths` (in package `name`) that resolves – after fetching `name` for this run if it's on the list and not installed. */
export async function locate(env: PackEnv, name: string, paths: string[] = [name]): Promise<string> {
  const first = () => paths.map((p) => env.resolve(p)).find((f) => f !== null) ?? null;
  const installed = isInstalled(env, name);
  if (!installed && !FETCHABLE.includes(name)) throw new Error(`${name} is listed but not installed – run npm install.`);
  if (!installed && (await env.fetch(name)) === null && !isInstalled(env, name)) {
    throw new Error(`${name} isn't installed, and fetching is off (JEN_NO_FETCH).`);
  }
  return first() ?? fail(`${name} has no generator at ${paths.join(', ')}.`);
}

const fail = (message: string): never => {
  throw new Error(message);
};

/** The raw flags and positionals – jen fills them in since 3.0. */
export function argsOf(ctx: Context): Args {
  if (!ctx.args) throw new Error('@codejen/pack-yeoman needs @codejen/jen 3 or later.');
  return ctx.args;
}

/** Absolute directory the files go to: the current directory, or --dir. */
export const destination = (ctx: Context): string => join(ctx.root, ctx.destDir);

export const camel = (s: string): string => s.replace(/-+([a-z0-9])/g, (_, c: string) => c.toUpperCase());

type Choice = string | { value?: unknown; name?: string; type?: string };

/** What pressing enter would answer: the default – for a list, the choice it points to or the first one; for a confirm, yes. */
function defaultOf(q: Question): unknown {
  const choices = Array.isArray(q.choices) ? (q.choices as Choice[]).filter((c) => typeof c === 'string' || c.type !== 'separator') : [];
  const value = (c: Choice | undefined) => (typeof c === 'object' ? (c.value ?? c.name) : c);
  const list = ['list', 'rawlist', 'select', 'expand'].includes(String(q.type));
  if (list && typeof q.default === 'number') return value(choices[q.default]);
  if (q.default !== undefined) return q.default;
  if (list) return value(choices[0]);
  if (q.type === 'confirm') return true;
  return undefined;
}

/** Answers questions from CLI flags (as typed, or camelCased) or the question's own default. Never prompts. */
export async function answerPrompt(questions: Question | Question[], flags: Record<string, unknown>): Promise<Record<string, unknown>> {
  const given = new Map(Object.entries(flags).map(([k, v]) => [camel(k), v]));
  const answers: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const q of Array.isArray(questions) ? questions : [questions]) {
    const when = typeof q.when === 'function' ? await (q.when as (a: Record<string, unknown>) => unknown)(answers) : (q.when ?? true);
    if (!when) continue;
    if (given.has(camel(q.name))) {
      answers[q.name] = given.get(camel(q.name));
    } else if (typeof q.default === 'function') {
      answers[q.name] = await (q.default as (a: Record<string, unknown>) => unknown)(answers);
    } else if (defaultOf(q) !== undefined) {
      answers[q.name] = defaultOf(q);
    } else {
      missing.push(q.name);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing: ${missing.map((n) => `--${n}`).join(', ')} (asked by the generator's prompting step; jen never prompts).`);
  }
  return answers;
}

/** jen's flags back as a command line, for a generator's own option parser. */
export const toArgv = ({ flags, positionals }: Args): string[] => [
  ...Object.entries(flags).flatMap(([name, value]) => (typeof value === 'boolean' ? (value ? [`--${name}`] : []) : [`--${name}=${value}`])),
  ...positionals,
];

/**
 * Runs a generator with the network cut off – fetch() and every TCP connection
 * fail – and fails the run if it tried, even when the generator swallowed the
 * error: whatever a generator downloads or sends would bypass jen's plan.
 */
export async function offline<T>(run: () => Promise<T>): Promise<T> {
  const tried: string[] = [];
  const { fetch } = globalThis;
  const { connect } = Socket.prototype;
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    tried.push(url);
    throw new Error(`${url}: Yeoman generators run offline under jen.`);
  };
  Socket.prototype.connect = function (this: Socket, ...args: unknown[]) {
    const [target] = args as [{ host?: string; port?: number; path?: string } | number | string];
    const where = typeof target === 'object' ? (target.path ?? `${target.host ?? 'localhost'}:${target.port}`) : String(target);
    tried.push(where);
    process.nextTick(() => this.destroy(new Error(`${where}: Yeoman generators run offline under jen.`)));
    return this;
  } as typeof connect;
  try {
    const result = await run();
    if (tried.length > 0) throw new Error(`The generator tried to reach ${[...new Set(tried)].join(', ')} – Yeoman generators run offline under jen.`);
    return result;
  } finally {
    globalThis.fetch = fetch;
    Socket.prototype.connect = connect;
  }
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

/** Text if it's valid UTF-8 without NUL bytes, else the bytes as they are. */
function decode(contents: Buffer): string | Uint8Array {
  try {
    const text = utf8.decode(contents);
    return text.includes('\0') ? contents : text;
  } catch {
    return contents;
  }
}

/** The files a generator left pending in mem-fs, as jen actions with paths from the project root. */
export function toActions(files: MemFsFile[], root: string): Action[] {
  const fromRoot = (path: string): string => `/${relative(root, path).split(sep).join('/')}`;
  return files.flatMap((file): Action[] => {
    if (file.state === 'modified') {
      const contents = decode(file.contents ?? Buffer.alloc(0));
      return [typeof contents === 'string' ? { add: fromRoot(file.path), template: contents } : { add: fromRoot(file.path), bytes: contents }];
    }
    if (file.state === 'deleted') return [{ delete: fromRoot(file.path) }];
    return [];
  });
}
