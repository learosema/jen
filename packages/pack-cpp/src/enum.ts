/**
 * `cpp:enum`: an `enum class` with `to_string()` and a `std::formatter`
 * specialization (Enum.3), so `std::print("{}", GameState::Running)` just
 * works. The switch has no `default` on purpose: -Wswitch then warns when a
 * value is added but `to_string` isn't updated.
 */
import type { Generator } from '@codejen/jen';
import { fail, inNamespace, parseIdentifiers, qualified, testActions } from './util.ts';

const enumGenerator: Generator = {
  description: 'create an enum class with to_string() and a std::formatter specialization (header-only)',
  params: {
    name: {},
    values: {},
    namespace: { default: '' },
    std: { default: '23' },
    withTest: { default: false },
  },
  actions: ({ name, values, namespace, std, withTest }, { pascal, constant }) => {
    const ns = String(namespace);
    const stdVal = String(std);
    if (stdVal !== '20' && stdVal !== '23') fail(`cpp:enum --std: expected "20" or "23", got "${stdVal}"`);

    const type = pascal(String(name));
    const guard = `${constant(String(name))}_H`;
    const items = parseIdentifiers(String(values), 'cpp:enum --values', pascal);
    const q = qualified(ns, type);
    const unreachable = stdVal === '23' ? 'std::unreachable();' : 'std::abort();  // std::unreachable() needs C++23';

    const body = `enum class ${type} {
${items.map((i) => `  ${i},`).join('\n')}
};

[[nodiscard]] constexpr std::string_view to_string(${type} value) noexcept {
  switch (value) {
${items.map((i) => `    case ${type}::${i}:\n      return "${i}";`).join('\n')}
  }
  ${unreachable}
}
`;

    const header = `#ifndef ${guard}
#define ${guard}

${[stdVal === '23' ? '<utility>' : '<cstdlib>', '<format>', '<string_view>'].sort().map((i) => `#include ${i}`).join('\n')}

${inNamespace(ns, body)}
template <>
struct std::formatter<${q}> : std::formatter<std::string_view> {
  auto format(${q} value, std::format_context& ctx) const {
    return std::formatter<std::string_view>::format(${ns ? `${ns}::` : '::'}to_string(value), ctx);
  }
};

#endif  // ${guard}
`;

    const checks = [
      `CHECK(to_string(${q}::${items[0]}) == "${items[0]}");`,
      `CHECK(std::format("{}", ${q}::${items[0]}) == "${items[0]}");`,
    ];
    return [
      { add: `src/${type}.h`, template: header },
      ...testActions(withTest, type, `${type}.h`, checks, ['format']),
    ];
  },
};

export default enumGenerator;
