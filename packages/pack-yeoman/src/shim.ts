/** Runs a Yeoman generator with just enough of a yeoman-environment faked around it, borrowing yeoman-generator and mem-fs from the generator's own install. */
// Stands in for yeoman-environment from Yeoman by the Yeoman team: https://yeoman.io
import type { AnyGenerator, Context, PackEnv } from '@codejen/jen';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { MemFsFile, Question } from './common.ts';
import { answerPrompt, argsOf, locate, offline, destination, toActions, toArgv } from './common.ts';

/** The priorities that run, in order. install/end never do: their side effects assume files already on disk. */
const PRIORITIES = ['initializing', 'prompting', 'configuring', 'default', 'writing', 'transform', 'conflicts'] as const;

interface YeomanGeneratorInstance {
  run(): Promise<void>;
}

type YeomanGeneratorClass = new (args: string[], options: Record<string, unknown>) => YeomanGeneratorInstance;

type Log = ((...args: unknown[]) => Log) & Record<'error' | 'warn' | 'info' | 'ok' | 'debug', (...args: unknown[]) => Log>;

function makeLog(): Log {
  const log = ((...args: unknown[]) => {
    console.log(...args);
    return log;
  }) as Log;
  for (const level of ['error', 'warn', 'info', 'ok'] as const) log[level] = log;
  log.debug = () => log;
  return log;
}

async function run(resolved: string, namespace: string, ctx: Context) {
  const args = argsOf(ctx);
  const mod = (await import(pathToFileURL(resolved).href)) as { default?: unknown };
  const GeneratorClass = (mod.default ?? mod) as YeomanGeneratorClass;
  if (typeof GeneratorClass !== 'function') throw new Error(`${resolved}: the default export is not a Yeoman generator class.`);

  const require = createRequire(resolved);
  const memFs = (await import(pathToFileURL(require.resolve('mem-fs')).href)) as { create(): { all(): MemFsFile[] } };
  const sharedFs = memFs.create();
  const queues = new Map<string, Array<() => unknown>>(PRIORITIES.map((name) => [name, []]));
  const cwd = destination(ctx);

  const env = {
    cwd,
    logCwd: cwd,
    sharedFs,
    options: {},
    adapter: {
      log: makeLog(),
      prompt: async (questions: Question | Question[]) => answerPrompt(questions, args.flags),
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- only used for progress messages we don't print
      progress: async (fn: (reporter: { step(): void }) => unknown) => fn({ step() {} }),
    },
    getVersion: () => '999.0.0',
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- custom priorities aren't supported, nothing to register
    addPriority() {},
    queueTask(queueName: string, fn: () => unknown) {
      // install, end and custom priorities are dropped, not run late or folded into another queue
      queues.get(queueName)?.push(fn);
    },
    composeWith() {
      throw new Error('This generator composes other generators (composeWith), which only JHipster gets a real environment for.');
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

  const generator = new GeneratorClass(toArgv(args), {
    env,
    resolved,
    namespace,
    skipCache: true,
    skipLocalCache: true,
    skipInstall: true,
  });
  await generator.run();
  return toActions(sharedFs.all(), ctx.root);
}

/** A generator package's default generator – what `yo <name>` runs. */
export function shimGenerator(name: string, short: string, env: PackEnv, description: string): AnyGenerator {
  return {
    description,
    passthrough: true,
    actions: async (_answers, _helpers, ctx) => {
      // the package's main, else where yo looks: generators/app, then app
      const resolved = await locate(env, name, [name, `${name}/generators/app`, `${name}/app`]);
      return offline(() => run(resolved, `${short}:app`, ctx));
    },
  };
}
