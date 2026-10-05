/**
 * `cpp:struct`: an aggregate for plain data bundles without an invariant
 * (C.2, C.131) – public members with default member initializers (C.48), so
 * designated initializers work (`Config{.width = 800}`).
 */
import type { Generator } from '@codejen/jen';
import { fail, inNamespace, includeBlock, qualified, splitTopLevel, stdIncludes, testActions } from './util.ts';

/** A member without an initializer gets `{}`, so it is never left uninitialized (ES.20). */
function withInitializer(member: string): string {
  const declaration = member.split(/[={]/)[0].trim();
  if (!declaration.includes(' ')) {
    fail(`cpp:struct --members: expected comma-separated "Type name [= value]" entries, got "${member}"`);
  }
  return /=|\}\s*$/.test(member) ? member : `${member}{}`;
}

const structGenerator: Generator = {
  description: 'create an aggregate struct with default member initializers for plain data bundles (header-only)',
  params: {
    name: {},
    members: {},
    compare: { default: false },
    namespace: { default: '' },
    withTest: { default: false },
  },
  actions: ({ name, members, compare, namespace, withTest }, { pascal, constant }) => {
    const ns = String(namespace);
    const type = pascal(String(name));
    const guard = `${constant(String(name))}_H`;
    const fields = splitTopLevel(String(members)).map(withInitializer);
    if (fields.length === 0) fail('cpp:struct --members: at least one "Type name" entry is required');

    const body = `struct ${type} {
${fields.map((f) => `  ${f};`).join('\n')}
${compare ? `\n  auto operator<=>(const ${type}&) const = default;\n` : ''}};
`;
    const header = `#ifndef ${guard}
#define ${guard}

${includeBlock(compare ? ['<compare>'] : [], stdIncludes(String(members)))}${inNamespace(ns, body)}
#endif  // ${guard}
`;

    return [
      { add: `${type}.h`, template: header },
      ...testActions(withTest, type, `${type}.h`, [`CHECK(std::is_aggregate_v<${qualified(ns, type)}>);`], ['type_traits']),
    ];
  },
};

export default structGenerator;
