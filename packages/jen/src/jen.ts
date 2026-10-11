#!/usr/bin/env node
/**
 * jen – the code jen(erator)
 *
 * Zero-dependency scaffolding CLI. Runs directly as TypeScript in
 * development (Node >= 24, type stripping); published as a built .js
 * (Node doesn't strip types from files inside node_modules).
 *
 * The public surface for generators and packs – types and helpers – lives
 * here too, e.g. `@type {import('@codejen/jen').Generator}`. See core.ts,
 * cli.ts and editorconfig.ts for the implementation.
 */
import { realpathSync } from 'node:fs';
import { styleText } from 'node:util';
import { main } from './cli.ts';

export type { Action, AnyGenerator, Answers, Args, Context, Find, Generator, Helpers, Pack, PackEnv, PackFactory, Params, Probe } from './core.ts';
export { helpers } from './core.ts';
export type { Types } from './style.ts';
export { TYPES_PARAM, detectTypes, ext, importExt, pick, source, stripTypes, typesFor } from './style.ts';

// Only run as a program, not when jen.ts is imported (e.g. for its types).
const isMain = (() => {
  try {
    return realpathSync(process.argv[1] ?? '') === import.meta.filename;
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((e: unknown) => {
    console.error(styleText('red', e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  });
}
