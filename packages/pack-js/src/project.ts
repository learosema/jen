/** What `js:vite` and `js:esbuild` share: the new directory, named by `--name`. */
import type { Answers, Context, Helpers } from '@codejen/jen';
import { posix } from 'node:path';
import { fail } from './common.ts';

export const NAME_PARAM = { name: { description: 'the project and its new directory, e.g. shop' } };

/** The new directory, relative to where the files go – and the package name. Fails if it's taken. */
export function projectName(generator: string, answers: Answers, { kebab }: Helpers, ctx: Context): string {
  const name = kebab(String(answers.name ?? ''));
  if (!name) fail(`${generator} --name: needs a name for the project and its directory, e.g. --name=shop`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) fail(`${generator} --name: "${answers.name}" makes no directory or package name; use letters, digits and dashes, e.g. --name=shop`);
  const path = posix.join(ctx.destDir, name);
  if (ctx.exists(path) && !ctx.isDir(path)) fail(`${generator}: ${path} already exists and isn't a directory – pick another --name`);
  if (ctx.readdir(path).length > 0) fail(`${generator}: ${path}/ already exists and isn't empty – pick another --name or --dir`);
  return name;
}
