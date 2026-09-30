/** `cpp:r0`: a Rule of Zero class with members generated from constructor params (header-only). */
import type { Generator } from '@codejen/jen';
import { fail, nsWrap, parseMembers } from './util.ts';

const r0Generator: Generator = {
  description: 'create a Rule of Zero class: members generated from constructor params, no special member functions (header-only)',
  params: {
    name: {},
    members: {},
    namespace: { default: '' },
  },
  actions: ({ name, members, namespace }, { pascal, constant }) => {
    const className = pascal(String(name));
    const guard = `${constant(String(name))}_H`;
    const fields = parseMembers(String(members));
    if (fields.length === 0) fail('cpp:r0 --members: at least one "Type name" pair is required');
    const { indent, open, close } = nsWrap(String(namespace));

    const ctorParams = fields.map((f) => `${f.type} ${f.ident}`).join(', ');
    const initList = fields.map((f) => `${f.ident}_{std::move(${f.ident})}`).join(', ');
    const memberDecls = fields.map((f) => `${indent}  ${f.type} ${f.ident}_;`).join('\n');

    const header = `#ifndef ${guard}
#define ${guard}

#include <utility>

${open}${indent}class ${className} {
${indent} public:
${indent}  explicit ${className}(${ctorParams})
${indent}      : ${initList} {}

${indent} private:
${memberDecls}
${indent}};${close}
#endif  // ${guard}
`;

    return [{ add: `src/${className}.h`, template: header }];
  },
};

export default r0Generator;
