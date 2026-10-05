/**
 * `cpp:class`: a plain or move-only RAII (Rule of Five) header/source class, written
 * where jen puts files and wired into the nearest CMakeLists.txt's sources list at a
 * `# jen:sources` marker (see the app-starter generators for where that marker comes from).
 */
import type { Generator } from '@codejen/jen';
import { includeBlock, nsWrap, qualified, stdIncludes, testActions } from './util.ts';

/** Plain default-constructible class: declared ctor/dtor, defined empty in the source. */
function plainClass(className: string, guard: string, indent: string, open: string, close: string) {
  const header = `#ifndef ${guard}
#define ${guard}

${open}${indent}class ${className} {
${indent} public:
${indent}  ${className}();
${indent}  ~${className}();
${indent}};${close}
#endif  // ${guard}
`;

  const source = `#include "${className}.h"

${open}${indent}${className}::${className}() {}

${indent}${className}::~${className}() {}${close}`;

  return { header, source };
}

/** Move-only RAII class wrapping a resource handle (Rule of Five): see my-cpp-snippets' `raii`. */
function moveOnlyClass(
  className: string,
  guard: string,
  resourceType: string,
  nullVal: string,
  destroyFn: string,
  indent: string,
  open: string,
  close: string,
) {
  const header = `#ifndef ${guard}
#define ${guard}

${includeBlock(['<utility>'], stdIncludes(resourceType))}${open}${indent}class ${className} {
${indent} public:
${indent}  ${className}() noexcept = default;
${indent}  explicit ${className}(${resourceType} handle) noexcept : handle_{handle} {}
${indent}  ~${className}();

${indent}  ${className}(const ${className}&) = delete;
${indent}  ${className}& operator=(const ${className}&) = delete;

${indent}  ${className}(${className}&& other) noexcept : handle_{other.release()} {}
${indent}  ${className}& operator=(${className}&& other) noexcept {
${indent}    reset(other.release());
${indent}    return *this;
${indent}  }

${indent}  [[nodiscard]] ${resourceType} get() const noexcept { return handle_; }
${indent}  [[nodiscard]] explicit operator bool() const noexcept { return handle_ != ${nullVal}; }

${indent}  [[nodiscard]] ${resourceType} release() noexcept { return std::exchange(handle_, ${nullVal}); }
${indent}  void reset(${resourceType} handle = ${nullVal});

${indent} private:
${indent}  ${resourceType} handle_{${nullVal}};
${indent}};${close}
#endif  // ${guard}
`;

  const source = `#include "${className}.h"

${open}${indent}${className}::~${className}() { reset(); }

${indent}void ${className}::reset(${resourceType} handle) {
${indent}  if (handle_ != ${nullVal}) ${destroyFn}(handle_);
${indent}  handle_ = handle;
${indent}}${close}`;

  return { header, source };
}

const classGenerator: Generator = {
  description:
    'create a C++ class (header + source), wired into the CMakeLists.txt with # jen:sources; --moveOnly for a Rule-of-Five RAII wrapper, --withTest for a doctest case',
  params: {
    name: {},
    namespace: { default: '' },
    moveOnly: { default: false },
    resource: { default: 'Resource*' },
    nullValue: { default: 'nullptr' },
    destroy: { default: 'destroy' },
    withTest: { default: false },
  },
  actions: ({ name, namespace, moveOnly, resource, nullValue, destroy, withTest }, { pascal, constant }) => {
    const className = pascal(String(name));
    const guard = `${constant(String(name))}_H`;
    const { indent, open, close } = nsWrap(String(namespace));

    const { header, source } = moveOnly
      ? moveOnlyClass(className, guard, String(resource), String(nullValue), String(destroy), indent, open, close)
      : plainClass(className, guard, indent, open, close);

    const q = qualified(String(namespace), className);
    const checks = moveOnly
      ? [`CHECK(!std::is_copy_constructible_v<${q}>);`, `CHECK(std::is_nothrow_move_constructible_v<${q}>);`]
      : [`CHECK(std::is_default_constructible_v<${q}>);`];

    return [
      { add: `${className}.h`, template: header },
      { add: `${className}.cpp`, template: source },
      { insert: { find: 'CMakeLists.txt' }, before: '# jen:sources', path: `${className}.cpp` },
      ...testActions(withTest, className, `${className}.h`, checks, ['type_traits']),
    ];
  },
};

export default classGenerator;
