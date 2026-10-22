export function fail(message: string): never {
  throw new Error(message);
}

/**
 * `usage` lines for custom properties, written as CSS so nobody takes them for flags, the descriptions lined up:
 * `props('.sidebar', [['--gutter: 1rem', 'the gap']])` → `.sidebar { --gutter: 1rem; }  the gap`.
 */
export const props = (selector: string, list: [string, string][]): string[] => rules(list.map(([decl, what]) => [selector, decl, what]));

/** The same with a selector each: `[['body', 'color: var(--color-text)', 'text']]`. */
export const rules = (list: [string, string, string][]): string[] => {
  const css = list.map(([selector, decl, what]): [string, string] => [`${selector} { ${decl}; }`, what]);
  const width = Math.max(...css.map(([rule]) => rule.length));
  return css.map(([rule, what]) => `${rule.padEnd(width)}  ${what}`);
};
