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
