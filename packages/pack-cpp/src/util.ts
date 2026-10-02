import type { Action } from '@codejen/jen';

export function fail(message: string): never {
  throw new Error(message);
}

/** Wraps a class body in `namespace ${ns} { … }` when a namespace is given, indenting the body one level. */
export function nsWrap(namespace: string) {
  const ns = namespace;
  const indent = ns ? '  ' : '';
  const open = ns ? `namespace ${ns} {\n\n` : '';
  const close = ns ? `\n\n}  // namespace ${ns}\n` : '\n';
  return { indent, open, close };
}

export interface Member {
  type: string;
  ident: string;
}

/** "std::string name, int age" -> [{type: "std::string", ident: "name"}, {type: "int", ident: "age"}] */
export function parseMembers(spec: string): Member[] {
  return spec.split(',').map((part) => {
    const trimmed = part.trim();
    const i = trimmed.lastIndexOf(' ');
    if (i < 0) fail(`cpp:r0 --members: expected comma-separated "Type name" pairs, got "${trimmed}"`);
    return { type: trimmed.slice(0, i).trim(), ident: trimmed.slice(i + 1).trim() };
  });
}

/**
 * Where an app starter lands: a new folder named after the app (kebab-case by
 * default, or `--folderCase=pascal`). `--dir` overrides it; `--dir=.` writes
 * into the current directory.
 */
export function appFolder(
  name: string,
  dir: string,
  folderCase: string,
  { kebab, pascal }: { kebab(s: string): string; pascal(s: string): string },
): string {
  if (folderCase !== 'kebab' && folderCase !== 'pascal') {
    fail(`--folderCase: expected "kebab" or "pascal", got "${folderCase}"`);
  }
  const folder = dir || (folderCase === 'pascal' ? pascal(name) : kebab(name));
  return stripTrailingSlashes(folder);
}

/** Removes trailing slashes in linear time (a `/\/+$/` regex backtracks quadratically). */
export function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s[end - 1] === '/') end--;
  return s.slice(0, end);
}

/** Joins a folder and a relative path; `.` or empty means no prefix. */
export function inFolder(folder: string, path: string): string {
  return !folder || folder === '.' ? path : `${folder}/${path}`;
}

/** Splits at top-level commas only, so `void f(int a, int b), std::map<int, int> m` yields two parts. */
export function splitTopLevel(spec: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of spec) {
    if ('(<[{'.includes(ch)) depth++;
    else if (')>]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}

/** A comma-separated list of identifiers ("idle, running") -> pascal-cased, validated C++ identifiers. */
export function parseIdentifiers(spec: string, flag: string, pascal: (s: string) => string): string[] {
  const items = splitTopLevel(spec).map(pascal);
  if (items.length === 0) fail(`${flag}: at least one name is required`);
  for (const item of items) {
    if (!/^[A-Za-z_]\w*$/.test(item)) fail(`${flag}: "${item}" is not a valid C++ identifier`);
  }
  return items;
}

/** Wraps already-formatted, unindented code in `namespace ${ns} { … }`, indenting it one level. */
export function inNamespace(namespace: string, body: string): string {
  if (!namespace) return body;
  const indented = body
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
  return `namespace ${namespace} {\n\n${indented}\n}  // namespace ${namespace}\n`;
}

/** `Foo` or `ns::Foo`. */
export function qualified(namespace: string, type: string): string {
  return namespace ? `${namespace}::${type}` : type;
}

/**
 * The `--withTest` bundle shared by the type generators: `tests/<Name>_test.cpp`
 * wired into tests/CMakeLists.txt at the `# jen:tests` marker (set up by
 * `cpp:doctest`; skipped with a note if that marker isn't there yet).
 */
export function testActions(
  enabled: unknown,
  name: string,
  header: string,
  checks: string[],
  extraIncludes: string[] = [],
): Action[] {
  if (!enabled) return [];
  const includes = ['<doctest/doctest.h>', ...extraIncludes.map((i) => `<${i}>`), `"${header}"`];
  const body = `${includes.map((i) => `#include ${i}`).join('\n')}

TEST_CASE("${name}") {
${checks.map((c) => `  ${c}`).join('\n')}
}
`;
  return [
    { add: `tests/${name}_test.cpp`, template: body },
    { insert: 'tests/CMakeLists.txt', before: '# jen:tests', line: `  ${name}_test.cpp` },
  ];
}
