/**
 * `cpp:strong`: a strong typedef (I.4) – an explicit constructor, `<=>`,
 * optional arithmetic and std::hash. Keeps pixels, texels and world units
 * from mixing in graphics code.
 */
import type { Generator } from '@codejen/jen';
import { fail, inNamespace, qualified, splitTopLevel, testActions } from './util.ts';

const OPS = ['compare', 'arith', 'hash'];

const strongGenerator: Generator = {
  description: 'create a strong typedef: explicit constructor, optional <=> / arithmetic / std::hash (header-only)',
  params: {
    name: {},
    underlying: {},
    ops: { default: 'compare' },
    namespace: { default: '' },
    withTest: { default: false },
  },
  actions: ({ name, underlying, ops, namespace, withTest }, { pascal, constant }) => {
    const ns = String(namespace);
    const type = pascal(String(name));
    const under = String(underlying);
    const guard = `${constant(String(name))}_H`;
    const enabled = splitTopLevel(String(ops));
    for (const op of enabled) {
      if (!OPS.includes(op)) fail(`cpp:strong --ops: expected a comma-separated list of ${OPS.join(', ')}, got "${op}"`);
    }
    const has = (op: string): boolean => enabled.includes(op);

    const compare = has('compare') ? `\n  auto operator<=>(const ${type}&) const = default;\n` : '';
    const arith = has('arith')
      ? `
  constexpr ${type}& operator+=(${type} rhs) noexcept { value_ += rhs.value_; return *this; }
  constexpr ${type}& operator-=(${type} rhs) noexcept { value_ -= rhs.value_; return *this; }
  constexpr ${type}& operator*=(${under} scalar) noexcept { value_ *= scalar; return *this; }
  constexpr ${type}& operator/=(${under} scalar) noexcept { value_ /= scalar; return *this; }

  [[nodiscard]] friend constexpr ${type} operator+(${type} lhs, ${type} rhs) noexcept { return lhs += rhs; }
  [[nodiscard]] friend constexpr ${type} operator-(${type} lhs, ${type} rhs) noexcept { return lhs -= rhs; }
  [[nodiscard]] friend constexpr ${type} operator*(${type} lhs, ${under} scalar) noexcept { return lhs *= scalar; }
  [[nodiscard]] friend constexpr ${type} operator/(${type} lhs, ${under} scalar) noexcept { return lhs /= scalar; }
`
      : '';

    const body = `class ${type} {
 public:
  using underlying_type = ${under};

  constexpr ${type}() noexcept = default;
  constexpr explicit ${type}(${under} value) noexcept : value_{value} {}

  [[nodiscard]] constexpr ${under} value() const noexcept { return value_; }
${compare}${arith}
 private:
  ${under} value_{};
};
`;
    const hash = has('hash')
      ? `
template <>
struct std::hash<${qualified(ns, type)}> {
  std::size_t operator()(const ${qualified(ns, type)}& v) const noexcept { return std::hash<${under}>{}(v.value()); }
};
`
      : '';
    const includes = [has('compare') ? '<compare>' : '', has('hash') ? '<functional>' : ''].filter(Boolean);

    const header = `#ifndef ${guard}
#define ${guard}

${includes.map((i) => `#include ${i}`).join('\n')}${includes.length ? '\n\n' : ''}${inNamespace(ns, body)}${hash}
#endif  // ${guard}
`;

    const q = qualified(ns, type);
    const checks = [
      `CHECK(!std::is_convertible_v<${under}, ${q}>);  // construction is explicit`,
      `CHECK(${q}{}.value() == ${under}{});`,
      ...(has('compare') ? [`CHECK(${q}{1} < ${q}{2});`] : []),
      ...(has('arith') ? [`CHECK((${q}{1} + ${q}{2}).value() == 3);`] : []),
    ];
    return [
      { add: `src/${type}.h`, template: header },
      ...testActions(withTest, type, `${type}.h`, checks, ['type_traits']),
    ];
  },
};

export default strongGenerator;
