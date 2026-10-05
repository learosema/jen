/**
 * `cpp:variant`: a `std::variant` of small case structs plus the `overloaded`
 * visitor helper – a modern alternative to a class hierarchy, e.g. for events
 * or render commands. `overloaded` lives in its own src/overloaded.h so several
 * variants can share it.
 */
import type { Generator } from '@codejen/jen';
import { inNamespace, parseIdentifiers, qualified, testActions } from './util.ts';

const OVERLOADED_H = `#ifndef OVERLOADED_H
#define OVERLOADED_H

// Lets std::visit take several lambdas: std::visit(overloaded{[](A) {}, [](B) {}}, value);
template <class... Ts>
struct overloaded : Ts... {
  using Ts::operator()...;
};

template <class... Ts>
overloaded(Ts...) -> overloaded<Ts...>;

#endif  // OVERLOADED_H
`;

const variantGenerator: Generator = {
  description: 'create a std::variant of case structs plus the overloaded visitor helper (header-only)',
  params: {
    name: {},
    cases: {},
    namespace: { default: '' },
    withTest: { default: false },
  },
  actions: ({ name, cases, namespace, withTest }, { pascal, constant }) => {
    const ns = String(namespace);
    const type = pascal(String(name));
    const guard = `${constant(String(name))}_H`;
    const items = parseIdentifiers(String(cases), 'cpp:variant --cases', pascal);

    const body = `${items.map((i) => `struct ${i} {};`).join('\n')}

using ${type} = std::variant<${items.join(', ')}>;
`;
    const header = `#ifndef ${guard}
#define ${guard}

#include <variant>

#include "overloaded.h"

${inNamespace(ns, body)}
#endif  // ${guard}
`;

    const q = qualified(ns, type);
    return [
      { add: 'overloaded.h', template: OVERLOADED_H },
      { add: `${type}.h`, template: header },
      ...testActions(withTest, type, `${type}.h`, [`CHECK(std::variant_size_v<${q}> == ${items.length});`], ['variant']),
    ];
  },
};

export default variantGenerator;
