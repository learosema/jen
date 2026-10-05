/**
 * `cpp:pimpl`: a pimpl class (I.27) – `std::unique_ptr<Impl>`, with the
 * destructor and move operations defaulted in the .cpp so `Impl` can stay
 * incomplete in the header. Easy to get wrong by hand.
 */
import type { Generator } from '@codejen/jen';
import { inNamespace, qualified, testActions } from './util.ts';

const pimplGenerator: Generator = {
  description: 'create a pimpl class: unique_ptr<Impl>, special members defaulted in the .cpp; wired into the CMakeLists.txt with # jen:sources',
  params: {
    name: {},
    namespace: { default: '' },
    withTest: { default: false },
  },
  actions: ({ name, namespace, withTest }, { pascal, constant }) => {
    const ns = String(namespace);
    const type = pascal(String(name));
    const guard = `${constant(String(name))}_H`;

    const headerBody = `class ${type} {
 public:
  ${type}();
  ~${type}();

  ${type}(const ${type}&) = delete;
  ${type}& operator=(const ${type}&) = delete;
  ${type}(${type}&&) noexcept;
  ${type}& operator=(${type}&&) noexcept;

 private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};
`;
    const header = `#ifndef ${guard}
#define ${guard}

#include <memory>

${inNamespace(ns, headerBody)}
#endif  // ${guard}
`;

    // Impl must be complete where the special members are defined, hence everything below lives in the .cpp.
    const sourceBody = `struct ${type}::Impl {};

${type}::${type}() : impl_{std::make_unique<Impl>()} {}

${type}::~${type}() = default;

${type}::${type}(${type}&&) noexcept = default;

${type}& ${type}::operator=(${type}&&) noexcept = default;
`;
    const source = `#include "${type}.h"

${inNamespace(ns, sourceBody)}`;

    const q = qualified(ns, type);
    const checks = [
      `CHECK(std::is_default_constructible_v<${q}>);`,
      `CHECK(!std::is_copy_constructible_v<${q}>);`,
      `CHECK(std::is_nothrow_move_constructible_v<${q}>);`,
    ];
    return [
      { add: `${type}.h`, template: header },
      { add: `${type}.cpp`, template: source },
      { insert: { find: 'CMakeLists.txt' }, before: '# jen:sources', path: `${type}.cpp` },
      ...testActions(withTest, type, `${type}.h`, checks, ['type_traits']),
    ];
  },
};

export default pimplGenerator;
