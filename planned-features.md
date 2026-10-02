# Planned features — @codejen/pack-cpp

Ideas for new generators and changes to existing ones, loosely guided by the
[C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines).
Guideline references are given in parentheses, e.g. (C.20).

Already covered today: `cpp:sdl3`, `cpp:sdl3-opengl`, `class`, `class --moveOnly`,
`cpp:handle`, `cpp:scopeexit`, `cpp:r0`, `cpp:shader`.

---

## 0. Prerequisites in the starters

These change the structure of what the starters generate. They should land first,
because retrofitting them later is hard to do idempotently.

- [ ] **Core library split.** Starters generate a `<name>-core` library target plus a
      thin executable containing only `main.cpp`. `# jen:sources` inserts into the
      library. This is what makes tests linkable (see `cpp:doctest`).
- [ ] **More markers.** Starters set up markers that later generators can hook into
      without `modify` regex gymnastics:
  - `# jen:tests` (CMake, tests directory)
  - `# jen:embed` (CMake, embedded resources)
  - `# jen:install` (CMake, install rules for CPack)
  - `// jen:frame-end` (end of `SDL_AppIterate`, for profiler frame marks)
  - `// jen:gl-init` (after the glad load, for GPU profiling)

---

## 1. Class & type generators

### `cpp:interface`

Polymorphic base class (C.35, C.67, C.128).

- virtual defaulted destructor
- copy/move protected or deleted to prevent slicing
- pure virtual methods from `--methods`
- `--impl=<Name>` also scaffolds a `final` derived class with all `override`s,
  inserted at `# jen:sources`

| Param       | Default | Description                                         |
| ----------- | ------- | --------------------------------------------------- |
| `name`      | —       | required; interface name                            |
| `methods`   | —       | e.g. `"void draw(), void resize(int w, int h)"`     |
| `impl`      | —       | optional; name of a concrete implementation class   |
| `namespace` | `''`    | wraps the classes in a namespace                    |

### `cpp:struct`

Aggregate variant next to `cpp:r0` (C.2, C.131): for plain data bundles without an
invariant (`Vertex`, `Config`), use a `struct` with public members, default member
initializers (C.48) and designated initializers (`Config{.width = 800}`) instead of
private members, a constructor and trivial getters.

| Param       | Default | Description                                  |
| ----------- | ------- | -------------------------------------------- |
| `name`      | —       | required                                     |
| `members`   | —       | e.g. `"int width = 800, int height = 600"`   |
| `compare`   | `false` | adds `auto operator<=>(const X&) const = default;` |
| `namespace` | `''`    |                                              |

- [ ] Also add `--compare` to `cpp:r0`.

### `cpp:strong`

Strong typedef (I.4). Explicit constructor, `<=>`, optional arithmetic.
Useful in graphics code: pixels vs. texels vs. world units.

```
$ jen cpp:strong --name=Pixels --underlying=int --ops=compare,arith
```

| Param        | Default   | Description                              |
| ------------ | --------- | ---------------------------------------- |
| `name`       | —         | required                                 |
| `underlying` | —         | required; wrapped type                   |
| `ops`        | `compare` | comma-separated: `compare`, `arith`, `hash` |
| `namespace`  | `''`      |                                          |

### `cpp:enum`

`enum class` with `to_string()` and a `std::formatter` specialization (Enum.3), so
`std::print("{}", GameState::Running)` just works. Header-only. The `switch` has no
`default` on purpose, so `-Wswitch` warns when a value is added but `to_string` isn't
updated. Draft implementation in [Appendix A](#appendix-a-cppenum-draft).

| Param       | Default | Description                               |
| ----------- | ------- | ----------------------------------------- |
| `name`      | —       | required                                  |
| `values`    | —       | required; e.g. `"idle, running, paused"`  |
| `namespace` | `''`    |                                           |
| `std`       | `23`    | `20` replaces `std::unreachable()`        |

### `cpp:pimpl`

Pimpl class (I.27): `std::unique_ptr<Impl>`, destructor and move operations defaulted
in the `.cpp` so `Impl` can stay incomplete in the header. Easy to get wrong by hand.

### `cpp:variant`

`std::variant` plus the `overloaded` visitor pattern as a modern alternative to a class
hierarchy, e.g. for events or render commands.

| Param   | Default | Description                                 |
| ------- | ------- | ------------------------------------------- |
| `name`  | —       | required; name of the variant alias         |
| `cases` | —       | required; e.g. `"KeyDown, KeyUp, Resize"`   |

### Cross-cutting

- [ ] `--withTest` on `class`, `cpp:r0`, `cpp:struct`, … — scaffolds
      `tests/<Name>_test.cpp` and inserts it at `# jen:tests`
      (`...(withTest ? [...] : [])`). Requires `cpp:doctest`.

---

## 2. Tooling generators (retrofit existing projects)

### `cpp:tidy`

`.clang-tidy` enabling `cppcoreguidelines-*`, `modernize-*`, `bugprone-*`,
`performance-*`, with the usual noisy checks (e.g.
`cppcoreguidelines-avoid-magic-numbers`) disabled and commented. Optional
`CMAKE_CXX_CLANG_TIDY` toggle in `CMakeLists.txt`. Makes tooling enforce the
guidelines instead of only demonstrating them in templates.

### `cpp:format`

`.clang-format`, aligned with `.editorconfig` where possible.

### `cpp:presets`

`CMakePresets.json` with `debug`, `release`, `asan`, `ubsan` presets.

### `cpp:warnings`

`INTERFACE` target with `-Wall -Wextra -Wpedantic -Wconversion -Wshadow` resp.
`/W4 /permissive-`, linked into targets via a marker.

### `cpp:doctest`

- doctest via `FetchContent`
- `enable_testing()`
- `tests/main.cpp` with `DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN`
- `doctest_discover_tests()` from doctest's `scripts/cmake/doctest.cmake`
- `tests` target links against `<name>-core` (see section 0)
- sets up the `# jen:tests` marker

Alternative to document, not scaffold by default: doctest's inline tests in `.cpp`
files with `DOCTEST_CONFIG_DISABLE` in release builds. Charming for small projects,
scales worse.

---

## 3. Profiling

### `cpp:tracy`

- Tracy via `FetchContent`
- CMake option `PROFILING` (default `OFF`) that sets `TRACY_ENABLE`
- links `Tracy::TracyClient`
- no wrapper header needed: Tracy macros are no-ops without `TRACY_ENABLE`
- inserts `FrameMark` at `// jen:frame-end` (end of `SDL_AppIterate`)
- `--gpu` (OpenGL starter): `TracyOpenGL.hpp`, `TracyGpuContext` at `// jen:gl-init`,
  `TracyGpuCollect` after the swap

---

## 4. Packaging

### `cpp:cpack`

- `install(TARGETS ...)`, assets via `install(DIRECTORY ...)`, at `# jen:install`
- `CPACK_GENERATOR` per platform:
  - Windows: `ZIP`, `NSIS` (or `WIX`)
  - macOS: `DragNDrop`
  - Linux: `TGZ`, `DEB`
- **SDL3 runtime dependency:** when SDL is built shared, ship it via
  `install(IMPORTED_RUNTIME_ARTIFACTS SDL3::SDL3)`
- `--staticSdl` sets `SDL_STATIC ON` in `vendor/` — often the simpler choice for games
- Linux: RPATH `$ORIGIN` so the unpacked binary finds its libs
- macOS: `MACOSX_BUNDLE` + `Info.plist`, reusing the starters' existing `bundleId` param

---

## 5. Resources

### `cpp:embed`

Cross-platform binary embedding. `#embed` is not portable yet (C only in Clang/GCC 15,
C++26 for C++, no MSVC), so: generalize `embed-glsl.cmake` to binary data, but generate
at **build time** via `add_custom_command` instead of configure time, so assets are
re-embedded when they change without re-running `cmake`. Draft in
[Appendix B](#appendix-b-cppembed-draft).

```
$ jen cpp:embed --file=assets/tiles.png --name=tilesPng
```

Inserts `embed_file(...)` at `# jen:embed`. Usage:
`SDL_IOFromConstMem(tilesPng.data(), tilesPng.size())`.

| Param    | Default | Description                                    |
| -------- | ------- | ---------------------------------------------- |
| `file`   | —       | required; path relative to the CMake source dir |
| `name`   | —       | required; C++ variable / header name           |
| `target` | —       | defaults to the core library target            |
| `method` | `cmake` | later: `embed` to use `#embed` where supported |

Caveats to document:

- CMake's regex gets noticeably slow for assets in the tens of MB
- include each generated header in exactly one `.cpp` — large `constexpr` arrays cost
  compile time in every TU

### `cpp:icon`

Platform app resources, separate from embedding: Windows `.rc` with icon, macOS
`.icns` in the bundle. Pairs with `cpp:cpack`.

---

## 6. Starters

### `cpp:app`

Console starter without SDL. `main(int argc, char** argv)` wraps arguments in
`std::span{argv, static_cast<std::size_t>(argc)}` to avoid pointer arithmetic
(bounds profile). Same core-library split as the other starters.

### `cpp:lib`

Library target with `include/<name>/`, `BUILD_INTERFACE`/`INSTALL_INTERFACE`,
export header, install + package config.

### `cpp:module` (experimental)

C++20 modules: `.cppm`, `FILE_SET CXX_MODULES`, requires CMake ≥ 3.28.

---

## Suggested order

1. Section 0 (core library split, markers)
2. `cpp:doctest`, `cpp:tidy` — the others build on them
3. `--withTest`, `cpp:enum`, `cpp:strong`, `cpp:struct`
4. `cpp:embed`, `cpp:tracy`
5. `cpp:cpack`, `cpp:icon`
6. Remaining class generators and starters

---

## Appendix A: `cpp:enum` draft

```js
// cpp-enum.mjs
export const params = {
  name: {},                       // required
  values: {},                     // required, e.g. "idle, running, paused"
  namespace: { default: "" },
  dir: { default: "src" },
};

export const actions = ({ name, values, namespace, dir }, { pascal }) => {
  const type = pascal(name);
  const items = values.split(",").map((v) => pascal(v.trim())).filter(Boolean);
  const qualified = namespace ? `${namespace}::${type}` : type;

  const body = `enum class ${type} {
${items.map((i) => `    ${i},`).join("\n")}
};

[[nodiscard]] constexpr std::string_view to_string(${type} v) noexcept {
    switch (v) {
${items.map((i) => `        case ${type}::${i}: return "${i}";`).join("\n")}
    }
    std::unreachable();
}
`;

  const wrapped = namespace
    ? `namespace ${namespace} {\n\n${body}\n} // namespace ${namespace}\n`
    : body;

  return [
    {
      add: `${dir}/${type}.h`,
      template: `#pragma once
#include <format>
#include <string_view>
#include <utility>

${wrapped}
template <>
struct std::formatter<${qualified}> : std::formatter<std::string_view> {
    auto format(${qualified} v, std::format_context& ctx) const {
        return std::formatter<std::string_view>::format(to_string(v), ctx);
    }
};
`,
    },
  ];
};
```

## Appendix B: `cpp:embed` draft

```cmake
# cmake/embed-file.cmake — script mode: cmake -DIN=... -DOUT=... -DNAME=... -P embed-file.cmake
file(READ "${IN}" hex HEX)
string(LENGTH "${hex}" len)
math(EXPR size "${len} / 2")
string(REGEX REPLACE "([0-9a-f][0-9a-f])" "0x\\1," bytes "${hex}")
file(WRITE "${OUT}"
  "#pragma once\n#include <array>\n\n"
  "inline constexpr std::array<unsigned char, ${size}> ${NAME} = {${bytes}};\n")
```

```cmake
# cmake/embed.cmake
function(embed_file target file name)
  set(out "${CMAKE_CURRENT_BINARY_DIR}/embedded/${name}.h")
  set(script "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/embed-file.cmake")
  add_custom_command(
    OUTPUT "${out}"
    COMMAND ${CMAKE_COMMAND} -DIN=${CMAKE_CURRENT_SOURCE_DIR}/${file} -DOUT=${out} -DNAME=${name} -P ${script}
    DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/${file}" "${script}"
    VERBATIM)
  target_sources(${target} PRIVATE "${out}")
  target_include_directories(${target} PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/embedded")
endfunction()
```
