/** Runs JHipster in its own real yeoman-environment, keeping what it writes in memory for jen's plan. */
// Runs JHipster by the JHipster team through its own EnvironmentBuilder and deferCommit: https://www.jhipster.tech
import type { AnyGenerator, Context, PackEnv } from '@codejen/jen';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MemFsFile, Question } from './common.ts';
import { answerPrompt, argsOf, camel, locate, offline, destination, toActions } from './common.ts';

interface SharedFs {
  all(): MemFsFile[];
  get(path: string): MemFsFile & { cwd: string; base: string };
  on(event: 'change', listener: (path: string) => void): void;
  removeListener(event: 'change', listener: (path: string) => void): void;
}

interface Environment {
  adapter: { prompt(questions: Question | Question[]): Promise<Record<string, unknown>> };
  sharedFs: SharedFs;
  composedStore: { customCommitTask?: unknown };
  runLoop: { queueNames: string[] };
  queueTask(queueName: string, fn: () => unknown, options?: unknown): void;
  queueCommit(): void;
  getGeneratorMeta(namespace: string): unknown;
  run(args: string[], options: Record<string, unknown>): Promise<void>;
}

interface Builder {
  prepare(options: { disableBlueprints: boolean }): Promise<{ getEnvironment(): Environment }>;
}

interface JHipsterCli {
  EnvironmentBuilder: { create(options: Record<string, unknown>): Builder };
}

const PRETTIER_CONFIG = /(?:^|[/\\])(?:\.prettierrc[^/\\]*|\.editorconfig)$/;

/**
 * JHipster's own commit applies prettier and eslint; with deferCommit it
 * leaves the results pending instead of writing them. Without a custom
 * commit task, nothing is committed at all.
 */
function deferCommits(env: Environment): void {
  env.queueCommit = function queueCommit(this: Environment) {
    this.queueTask(
      'environment:conflicts',
      async () => {
        const requeue = (path: string) => {
          const state = this.sharedFs.get(path).state;
          if (state === 'modified' || state === 'deleted') {
            this.sharedFs.removeListener('change', requeue);
            this.queueCommit();
          }
        };
        this.sharedFs.on('change', requeue);
        const task = this.composedStore.customCommitTask;
        if (typeof task === 'function') await (task as () => Promise<void>)();
      },
      { once: 'write memory fs to disk' },
    );
  };
}

/** Drops install, end and every custom priority after install – they assume the files are on disk. */
function skipFromInstall(env: Environment): void {
  const queueTask = env.queueTask.bind(env);
  env.queueTask = (queueName, fn, options) => {
    const names = env.runLoop.queueNames;
    const install = names.indexOf('install');
    if (install >= 0 && names.indexOf(queueName) >= install) return;
    queueTask(queueName, fn, options);
  };
}

/**
 * Prettier finds its config on disk, relative to the working directory. jen
 * runs JHipster from a scratch directory that mirrors only the config files
 * it generates, so nothing lands in the project before the plan is applied.
 */
function mirrorPrettierConfig(env: Environment, cwd: string, scratch: string): void {
  for (const name of existsSync(cwd) ? readdirSync(cwd) : []) {
    if (PRETTIER_CONFIG.test(name)) copyFileSync(join(cwd, name), join(scratch, name));
  }
  env.sharedFs.on('change', (path) => {
    const file = env.sharedFs.get(path);
    // mem-fs takes a new file's base from the working directory: keep it the destination
    file.cwd = cwd;
    file.base = cwd;
    const rel = relative(cwd, path);
    if (!PRETTIER_CONFIG.test(path) || rel.startsWith('..') || !file.contents) return;
    mkdirSync(dirname(join(scratch, rel)), { recursive: true });
    writeFileSync(join(scratch, rel), file.contents);
  });
}

/** JHipster asks npm for its latest version, for an update notice: skipped, without turning off its other checks (skipChecks). */
async function skipVersionCheck(baseCoreFile: string): Promise<() => void> {
  const { default: BaseCore } = (await import(pathToFileURL(baseCoreFile).href)) as { default: { prototype: { checkForNewVersion(): Promise<void> } } };
  const { checkForNewVersion } = BaseCore.prototype;
  BaseCore.prototype.checkForNewVersion = async () => undefined;
  return () => {
    BaseCore.prototype.checkForNewVersion = checkForNewVersion;
  };
}

async function run(cliFile: string, baseCoreFile: string, ctx: Context) {
  const args = argsOf(ctx);
  const here = process.cwd();
  const cwd = destination(ctx);
  const { EnvironmentBuilder } = (await import(pathToFileURL(cliFile).href)) as JHipsterCli;
  // blueprints that aren't installed would be fetched by name from the generator's config, outside jen's plan
  const builder = await EnvironmentBuilder.create({ cwd, skipInstall: true }).prepare({ disableBlueprints: true });
  const env = builder.getEnvironment();
  env.adapter.prompt = async (questions) => answerPrompt(questions, args.flags);
  deferCommits(env);
  skipFromInstall(env);

  // "jen yeoman:jhipster entity Foo" is "jhipster entity Foo"; files given are relative to where jen runs
  const [first, ...rest] = args.positionals;
  const command = first && env.getGeneratorMeta(`jhipster:${first}`) ? first : 'app';
  const positionals = (command === first ? rest : args.positionals).map((p) => (existsSync(resolve(here, p)) ? resolve(here, p) : p));

  const scratch = mkdtempSync(join(tmpdir(), 'jen-jhipster-'));
  mirrorPrettierConfig(env, cwd, scratch);
  const restore = await skipVersionCheck(baseCoreFile);
  process.chdir(scratch);
  try {
    // like JHipster's own CLI: options as an object, camelCased
    await env.run([`jhipster:${command}`, ...positionals], {
      ...Object.fromEntries(Object.entries(args.flags).map(([k, v]) => [camel(k), v])),
      skipInstall: true,
      skipGit: true,
      deferCommit: true,
    });
  } finally {
    restore();
    process.chdir(here);
    rmSync(scratch, { recursive: true, force: true });
  }
  return toActions(env.sharedFs.all(), ctx.root);
}

/** JHipster's generators, by the same commands as its own CLI. */
export function jhipsterGenerator(env: PackEnv, description: string): AnyGenerator {
  return {
    description,
    passthrough: true,
    actions: async (_answers, _helpers, ctx) => {
      const cliFile = await locate(env, 'generator-jhipster', ['generator-jhipster/cli']);
      const baseCoreFile = await locate(env, 'generator-jhipster', ['generator-jhipster/generators/base-core']);
      return offline(() => run(cliFile, baseCoreFile, ctx));
    },
  };
}
