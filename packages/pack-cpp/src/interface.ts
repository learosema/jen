/**
 * `cpp:interface`: a polymorphic base class (C.35, C.67, C.128) – virtual
 * defaulted destructor, protected copy/move to prevent slicing, pure virtual
 * methods from --methods. --impl also scaffolds a `final` derived class.
 */
import type { Action, Generator } from '@codejen/jen';
import { fail, inNamespace, qualified, splitTopLevel, testActions } from './util.ts';

interface Method {
  /** Everything before the name: return type and attributes. */
  ret: string;
  name: string;
  /** From the opening parenthesis on: parameters and trailing qualifiers (`const`, `noexcept`). */
  rest: string;
}

/** "void resize(int w, int h)" -> {ret: "void", name: "resize", rest: "(int w, int h)"} */
function parseMethod(spec: string): Method {
  const m = /^(.*?)\b(\w+)\s*(\(.*)$/s.exec(spec);
  if (!m || !m[1].trim()) fail(`cpp:interface --methods: expected "ReturnType name(params)", got "${spec}"`);
  return { ret: m[1].trim(), name: m[2], rest: m[3].trim() };
}

/**
 * Parameters of an out-of-line stub definition: no repeated default arguments,
 * and `[[maybe_unused]]` since the stub body is empty.
 */
function stubParams(rest: string): string {
  const close = rest.lastIndexOf(')', rest.search(/\)\s*(const|noexcept|&|$)/) + 1);
  const end = close < 0 ? rest.length : close;
  const params = splitTopLevel(rest.slice(1, end));
  const rendered = params
    .filter((p) => p !== 'void')
    .map((p) => `[[maybe_unused]] ${p.replace(/\s*=\s*.+$/s, '')}`);
  return `(${rendered.join(', ')})${rest.slice(end + 1)}`;
}

const isVoid = (ret: string): boolean => /(^|\s)void$/.test(ret);

const interfaceGenerator: Generator = {
  description:
    'create a polymorphic interface class (virtual dtor, protected copy/move, pure virtual --methods); --impl scaffolds a final implementation',
  params: {
    name: {},
    methods: { default: '' },
    impl: { default: '' },
    namespace: { default: '' },
    withTest: { default: false },
  },
  actions: ({ name, methods, impl, namespace, withTest }, { pascal, constant }) => {
    const ns = String(namespace);
    const iface = pascal(String(name));
    const parsed = splitTopLevel(String(methods)).map(parseMethod);

    const guard = `${constant(String(name))}_H`;
    const pure = parsed.map((m) => `virtual ${m.ret} ${m.name}${m.rest} = 0;`);
    const ifaceBody = `class ${iface} {
 public:
  virtual ~${iface}() = default;
${pure.length ? '\n' + pure.map((l) => `  ${l}`).join('\n') + '\n' : ''}
 protected:
  // C.67: polymorphic classes suppress public copy/move to prevent slicing
  ${iface}() = default;
  ${iface}(const ${iface}&) = default;
  ${iface}& operator=(const ${iface}&) = default;
  ${iface}(${iface}&&) = default;
  ${iface}& operator=(${iface}&&) = default;
};
`;
    const header = `#ifndef ${guard}
#define ${guard}

${inNamespace(ns, ifaceBody)}
#endif  // ${guard}
`;

    const actions: Action[] = [{ add: `src/${iface}.h`, template: header }];
    const checks = [`CHECK(std::is_abstract_v<${qualified(ns, iface)}>);`];
    const testIncludes = ['type_traits'];

    const implName = String(impl) ? pascal(String(impl)) : '';
    if (implName) {
      const implGuard = `${constant(String(impl))}_H`;
      const overrides = parsed.map((m) => `${m.ret} ${m.name}${m.rest} override;`);
      const implBody = `class ${implName} final : public ${iface} {
 public:
${overrides.map((l) => `  ${l}`).join('\n')}
};
`;
      const implHeader = `#ifndef ${implGuard}
#define ${implGuard}

#include "${iface}.h"

${inNamespace(ns, implBody)}
#endif  // ${implGuard}
`;
      const definitions = parsed
        .map((m) => {
          const body = isVoid(m.ret) ? '{}' : '{ return {}; }';
          return `${m.ret} ${implName}::${m.name}${stubParams(m.rest)} ${body}`;
        })
        .join('\n\n');
      const implSource = `#include "${implName}.h"

${inNamespace(ns, definitions + '\n')}`;
      actions.push(
        { add: `src/${implName}.h`, template: implHeader },
        { add: `src/${implName}.cpp`, template: implSource },
        { insert: 'src/CMakeLists.txt', before: '# jen:sources', line: `  ${implName}.cpp` },
      );
      checks.push(`CHECK(std::is_base_of_v<${qualified(ns, iface)}, ${qualified(ns, implName)}>);`);
    }

    return [...actions, ...testActions(withTest, iface, implName ? `${implName}.h` : `${iface}.h`, checks, testIncludes)];
  },
};

export default interfaceGenerator;
