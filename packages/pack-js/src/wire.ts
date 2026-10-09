/** `--into`: loads a new module from a page (a script tag) or from an entry module (an import line). */
import { posix } from 'node:path';
import type { Action, Context } from '@codejen/jen';

const BODY_END = /<\/body>/;

/** The first line that isn't blank or a comment – so a new import lands above the code, below `// @ts-check`. */
const FIRST_CODE = /^(?!\s*(\/\/|\/\*|\*|$))/;

/** `./`-relative path from the `--into` file (`/…`, root-relative) to `file` (relative to the destination). */
export function relativeTo(into: string, file: string, ctx: Context): string {
  const rel = posix.relative(posix.dirname(into.slice(1)), posix.join(ctx.destDir, file));
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/**
 * Wires `file` into the `--into` file: a module script (and `markup`, if any)
 * before `</body>` of a page, else an import line in a module, with the
 * extension `importExt` (what the project's imports use).
 */
export function wireInto(into: string, file: string, ctx: Context, importExt: string, markup: string | null = null): Action[] {
  const path = relativeTo(into, file, ctx);
  if (into.endsWith('.html')) {
    return [
      ...(markup ? [{ insert: into, before: BODY_END, line: markup }] : []),
      { insert: into, before: BODY_END, line: `<script type="module" src="${path}"></script>` },
    ];
  }
  return [{ insert: into, before: FIRST_CODE, line: `import '${path.replace(/\.[jt]s$/, importExt)}';` }];
}
