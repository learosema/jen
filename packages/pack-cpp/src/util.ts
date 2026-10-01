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
  return folder.replace(/\/+$/, '');
}

/** Joins a folder and a relative path; `.` or empty means no prefix. */
export function inFolder(folder: string, path: string): string {
  return !folder || folder === '.' ? path : `${folder}/${path}`;
}
