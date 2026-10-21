export function fail(message: string): never {
  throw new Error(message);
}

/**
 * `usage` lines for custom properties, written as CSS so nobody takes them for flags, the descriptions lined up:
 * `props('.sidebar', [['--gutter: 1rem', 'the gap']])` → `.sidebar { --gutter: 1rem; }  the gap`.
 */
export const props = (selector: string, list: [string, string][]): string[] => {
  const rules = list.map(([decl, what]): [string, string] => [`${selector} { ${decl}; }`, what]);
  const width = Math.max(...rules.map(([rule]) => rule.length));
  return rules.map(([rule, what]) => `${rule.padEnd(width)}  ${what}`);
};
