/** Whole-file boilerplate from templates/, with `{{placeholders}}` filled by `fill()`. */
import { readFileSync } from 'node:fs';

/** A file from the pack's templates/ folder (from src/ or dist/ alike). */
export const template = (name: string): string => readFileSync(new URL(`../templates/${name}`, import.meta.url), 'utf8');

/**
 * Fills `{{name}}` placeholders. A null value drops its whole line (optional
 * lines, like a `<meta>` tag without content); a placeholder alone on its line
 * takes multi-line values, each line at the placeholder's indent. Blank lines
 * left doubled, or right before a closing `}` or `</…>`, are removed.
 */
export function fill(text: string, values: Record<string, string | null>): string {
  const lines: string[] = [];
  for (const line of text.split('\n')) {
    const keys = [...line.matchAll(/\{\{([a-z-]+)\}\}/g)].map((m) => m[1]);
    for (const key of keys) if (!(key in values)) throw new Error(`template placeholder {{${key}}} has no value`);
    if (keys.some((key) => values[key] === null)) continue;
    const alone = /^(\s*)\{\{([a-z-]+)\}\}$/.exec(line);
    if (alone) {
      lines.push(...values[alone[2]]!.split('\n').map((l) => (l ? alone[1] + l : l)));
    } else {
      lines.push(line.replace(/\{\{([a-z-]+)\}\}/g, (_, key: string) => values[key]!));
    }
  }
  return lines
    .filter((line, i) => line !== '' || (lines[i - 1] !== '' && !/^\s*(\}|<\/)/.test(lines[i + 1] ?? '')))
    .join('\n');
}
