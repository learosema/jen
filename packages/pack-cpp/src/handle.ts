/** `cpp:handle`: a generic Handle<T, Deleter, Null> RAII template for non-pointer handles (header-only). */
import type { Generator } from '@codejen/jen';
import { nsWrap } from './util.ts';

const handleGenerator: Generator = {
  description: 'create a generic Handle<T, Deleter, Null> RAII template for non-pointer handles (header-only)',
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
#include <utility>

${open}${indent}template <std::regular T, auto Deleter, T Null = T{}>
${indent}  requires std::invocable<decltype(Deleter), T>
${indent}class ${className} {
${indent} public:
${indent}  ${className}() noexcept = default;
${indent}  explicit ${className}(T handle) noexcept : handle_{handle} {}
${indent}  ~${className}() { reset(); }

${indent}  ${className}(const ${className}&) = delete;
${indent}  ${className}& operator=(const ${className}&) = delete;

${indent}  ${className}(${className}&& other) noexcept : handle_{other.release()} {}
${indent}  ${className}& operator=(${className}&& other) noexcept {
${indent}    reset(other.release());
${indent}    return *this;
${indent}  }

${indent}  [[nodiscard]] T get() const noexcept { return handle_; }
${indent}  [[nodiscard]] explicit operator bool() const noexcept { return handle_ != Null; }

${indent}  [[nodiscard]] T release() noexcept { return std::exchange(handle_, Null); }
${indent}  void reset(T handle = Null) noexcept {
${indent}    if (handle_ != Null) Deleter(handle_);
${indent}    handle_ = handle;
${indent}  }

${indent} private:
${indent}  T handle_{Null};
${indent}};${close}
#endif  // ${guard}
`;

    return [{ add: `src/${className}.h`, template: header }];
  },
};

export default handleGenerator;
