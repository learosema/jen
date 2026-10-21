export function fail(message: string): never {
  throw new Error(message);
}

/** `usage` lines for custom properties, the descriptions lined up: `['--gutter: 1rem', 'the gap']`. */
export const props = (list: [string, string][]): string[] => {
  const width = Math.max(...list.map(([name]) => name.length));
  return list.map(([name, what]) => `${name.padEnd(width)}  ${what}`);
};
