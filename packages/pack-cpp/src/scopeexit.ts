/** `cpp:scopeexit`: a ScopeExit scope-guard template, nothrow-enforced (header-only). */
import type { Generator } from '@codejen/jen';
import { nsWrap } from './util.ts';

const scopeExitGenerator: Generator = {
  description: 'create a ScopeExit scope-guard template (nothrow-enforced, header-only)',
  params: {
    name: {},
    namespace: { default: '' },
  },
  actions: ({ name, namespace }, { pascal, constant }) => {
    const className = pascal(String(name));
    const guard = `${constant(String(name))}_H`;
    const { indent, open, close } = nsWrap(String(namespace));

    const header = `#ifndef ${guard}
#define ${guard}

#include <concepts>
#include <type_traits>
#include <utility>

${open}${indent}template <std::invocable F>
${indent}  requires std::is_nothrow_invocable_v<F>
${indent}class [[nodiscard]] ${className} {
${indent} public:
${indent}  [[nodiscard]] explicit ${className}(F f) noexcept(std::is_nothrow_move_constructible_v<F>)
${indent}      : f_{std::move(f)} {}

${indent}  ~${className}() {
${indent}    if (active_) f_();
${indent}  }

${indent}  ${className}(const ${className}&) = delete;
${indent}  ${className}& operator=(const ${className}&) = delete;

${indent}  void release() noexcept { active_ = false; }

${indent} private:
${indent}  F f_;
${indent}  bool active_{true};
${indent}};${close}
#endif  // ${guard}
`;

    return [{ add: `${className}.h`, template: header }];
  },
};

export default scopeExitGenerator;
