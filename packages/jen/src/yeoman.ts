/**
 * Runs real Yeoman generators (npm packages named `generator-*`) through
 * jen's own plan/apply engine.
 *
 * jen adds no dependency for this: a generator package brings
 * yeoman-generator, mem-fs and mem-fs-editor along as its own transitive
 * dependencies, so this module resolves and reuses those at runtime –
 * exactly as cli.ts already resolves jen packs from the project's own
 * node_modules – instead of reimplementing the Generator base class or
 * copyTpl's EJS templating.
 *
 * What's faked is only the small slice of `yeoman-environment` that
 * yeoman-generator's constructor and run loop require: a shared mem-fs
 * store, an adapter (log/prompt), and the priority queue that schedules
 * initializing/prompting/configuring/default/writing/transform/conflicts.
 *
 * Deliberately out of scope, by design:
 *  - Real interactive prompting. jen never prompts (see CLAUDE.md):
 *    `this.prompt()` is answered from CLI flags or the question's own
 *    default, or jen fails with a clear message – same as a missing param
 *    on a native jen generator.
 *  - composeWith / blueprints (sub-generator composition) – throws if used.
 *  - The `install` and `end` priorities. They run shell commands (git
 *    init, npm install, opening an editor) against files that, in jen's
 *    plan-then-apply model, haven't been written to disk yet when the
 *    generator runs. Only file changes make it into the plan.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { Placed } from './core.ts';
import { fail } from './core.ts';

/** The priorities jen actually drains, in order. install/end are never run – see module doc. */
const PRIORITIES = ['initializing', 'prompting', 'configuring', 'default', 'writing', 'transform', 'conflicts'] as const;

interface Question {
  name: string;
  default?: unknown;
  [key: string]: unknown;
}

interface MemFsFile {
  path: string;
  contents: Buffer | null;
  state?: 'modified' | 'deleted';
}

interface MemFsStore {
  all(): MemFsFile[];
}

interface YeomanGeneratorInstance {
  run(): Promise<void>;
}

export type YeomanGeneratorClass = new (args: string[], options: Record<string, unknown>) => YeomanGeneratorInstance;

export interface YeomanRunContext {
  /** CLI-given values (as jen's own resolveParams sees them), used to answer this.prompt(). */
  given: Record<string, unknown>;
  /** Positionals after the generator name, forwarded as the generator's own positional arguments. */
  positionals: string[];
  /** Project root, used as the generator's destinationRoot/cwd. */
  root: string;
  /** Generator namespace, e.g. "code:app" – yeoman-generator requires one. */
  namespace: string;
}

/** Resolves prompt answers from CLI-given values or the question's own default. Never prompts. */
function answerPrompt(questions: Question | Question[], given: Record<string, unknown>): Record<string, unknown> {
  const list = Array.isArray(questions) ? questions : [questions];
  const answers: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const q of list) {
    if (q.name in given) {
      answers[q.name] = given[q.name];
    } else if (typeof q.default === 'function') {
      answers[q.name] = (q.default as (a: Record<string, unknown>) => unknown)(answers);
    } else if (q.default !== undefined) {
      answers[q.name] = q.default;
    } else {
      missing.push(q.name);
    }
  }
  if (missing.length > 0) {
    fail(`Missing: ${missing.map((n) => `--${n}`).join(', ')} (asked by the generator's prompting step; jen never prompts).`);
  }
  return answers;
}

type Log = ((...args: unknown[]) => Log) & Record<'error' | 'warn' | 'info' | 'ok', (...args: unknown[]) => Log>;

function makeLog(): Log {
  const log = ((...args: unknown[]) => {
    console.log(...args);
    return log;
  }) as Log;
  for (const level of ['error', 'warn', 'info', 'ok'] as const) {
    log[level] = (...args: unknown[]) => {
      console.log(...args);
      return log;
    };
  }
  return log;
}

/** Builds the CLI-style argv jen forwards to the generator's own option/argument parser. */
function toArgv(given: Record<string, unknown>, positionals: string[]): string[] {
  const flags = Object.entries(given).flatMap(([name, value]) =>
    typeof value === 'boolean' ? (value ? [`--${name}`] : []) : [`--${name}=${String(value)}`],
  );
  return [...flags, ...positionals];
}

/**
 * Instantiates and runs a real Yeoman generator class, faking just enough
 * of a yeoman-environment for it to run, and returns the files it would
 * write as jen actions – ready for jen's own plan()/apply().
 */
export async function runYeoman(GeneratorClass: YeomanGeneratorClass, resolved: string, ctx: YeomanRunContext): Promise<Placed[]> {
  const require = createRequire(resolved);
  const memFs = (await import(pathToFileURL(require.resolve('mem-fs')).href)) as { create(): MemFsStore };
  const sharedFs = memFs.create();

  const queues = new Map<string, Array<() => unknown>>(PRIORITIES.map((name) => [name, []]));

  const env = {
    cwd: ctx.root,
    logCwd: ctx.root,
    sharedFs,
    options: {},
    adapter: {
      log: makeLog(),
      prompt: async (questions: Question | Question[]) => answerPrompt(questions, ctx.given),
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- only used for progress messages we don't print
      progress: async (fn: (reporter: { step(): void }) => unknown) => fn({ step() {} }),
    },
    getVersion: () => '999.0.0',
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- custom priorities aren't supported, nothing to register
    addPriority() {},
    queueTask(queueName: string, fn: () => unknown) {
      // Unrecognized queues (install, end, custom priorities) are dropped, not
      // run late or folded into another queue – see module doc.
      queues.get(queueName)?.push(fn);
    },
    composeWith() {
      fail("This generator uses composeWith (sub-generator composition), which jen's Yeoman support doesn't cover.");
    },
    async runGenerator(generator: { queueTasks(): Promise<void> }) {
      await generator.queueTasks();
      for (const name of PRIORITIES) {
        for (const task of queues.get(name) ?? []) await task();
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- nothing listens on the env, so events are dropped
    emit() {},
  };

  const generator = new GeneratorClass(toArgv(ctx.given, ctx.positionals), {
    env,
    resolved,
    namespace: ctx.namespace,
    skipCache: true,
    skipLocalCache: true,
    skipInstall: true,
  });
  await generator.run();

  const actions: Placed[] = [];
  for (const file of sharedFs.all()) {
    if (file.state === 'modified') actions.push({ add: file.path, template: (file.contents ?? Buffer.alloc(0)).toString('utf8') });
    else if (file.state === 'deleted') actions.push({ delete: file.path });
  }
  return actions;
}
