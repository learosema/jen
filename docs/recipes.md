---
layout: doc
permalink: /recipes.html
title: jen — cpp pack recipes
description: "Every jen command in @codejen/pack-cpp: app starters, classes and types, tooling, profiling, packaging and resources."
eyebrow: "@codejen/pack-cpp"
mega: recipes
lede: Every generator, with the exact command and the output it prints.
sub: Modern C++ scaffolding and app starters.
cta: { text: "Three ways to install ↓", url: "#install" }
toc:
  - title: Install
    links:
      - { title: Globally, id: install-global }
      - { title: Locally, id: install-local }
      - { title: Not at all, id: install-npx }
  - title: Where files go
    links:
      - { title: Project root, id: where }
  - title: App starters
    links:
      - { title: "cpp:sdl3", id: cpp-sdl3 }
      - { title: "cpp:sdl3-opengl", id: cpp-sdl3-opengl }
      - { title: "cpp:app", id: cpp-app }
      - { title: "cpp:lib", id: cpp-lib }
      - { title: "cpp:module", id: cpp-module }
      - { title: Markers, id: markers }
  - title: Classes and types
    links:
      - { title: "cpp:class", id: cpp-class }
      - { title: "cpp:class --moveOnly", id: cpp-class-moveonly }
      - { title: "cpp:handle", id: cpp-handle }
      - { title: "cpp:scopeexit", id: cpp-scopeexit }
      - { title: "cpp:r0", id: cpp-r0 }
      - { title: "cpp:interface", id: cpp-interface }
      - { title: "cpp:struct", id: cpp-struct }
      - { title: "cpp:strong", id: cpp-strong }
      - { title: "cpp:enum", id: cpp-enum }
      - { title: "cpp:pimpl", id: cpp-pimpl }
      - { title: "cpp:variant", id: cpp-variant }
      - { title: "--withTest", id: with-test }
      - { title: Choosing, id: choosing }
  - title: Tooling
    links:
      - { title: "cpp:doctest", id: cpp-doctest }
      - { title: "cpp:tidy", id: cpp-tidy }
      - { title: "cpp:format", id: cpp-format }
      - { title: "cpp:presets", id: cpp-presets }
      - { title: "cpp:warnings", id: cpp-warnings }
      - { title: "cpp:compiler", id: cpp-compiler }
  - title: Profiling
    links:
      - { title: "cpp:tracy", id: cpp-tracy }
  - title: Packaging
    links:
      - { title: "cpp:cpack", id: cpp-cpack }
      - { title: "cpp:icon", id: cpp-icon }
  - title: Resources
    links:
      - { title: "cpp:shader", id: cpp-shader }
      - { title: "cpp:embed", id: cpp-embed }
  - title: Finally
    links:
      - { title: Full example, id: putting-it-together }
      - { title: C++ standard, id: cpp-standard }
---

## Install {#install}

### Globally {#install-global}

One install for every project – no `package.json` needed.

{% include terminal.html id="install_global" %}

### Locally <span class="pill label">best for monorepos</span> {#install-local}

Dev dependencies pin the generator versions with the repo, for every contributor and CI run. In a monorepo, use the root.

{% include terminal.html id="install_local" %}

### Not at all {#install-npx}

`cpp:sdl3` without the pack fetches `@codejen/pack-cpp` for one run and leaves nothing behind.

{% include terminal.html id="install_npx" %}

This only works for `@codejen` packs (`JEN_NO_FETCH=1` turns it off). Anything else needs `--from`.

{% include terminal.html id="install_from" %}

## Where files go {#where}

Into the current folder, or `--dir` ([general rules]({{ '/#where' | relative_url }})). App starters make a new project folder; `--dir` names it.

From `src/net/`, `cpp:class --name=Socket` writes `src/net/Socket.h` and adds `net/Socket.cpp` to the nearest `CMakeLists.txt` above with `# jen:sources`. `--withTest` wires tests at `# jen:tests`. No marker: the insert is skipped.

Tooling generators (`cpp:warnings`, `cpp:tidy`, …) always write to the project root.

## App starters {#app-starters}

Each starter makes a folder named after the app (`MyGame` → `my-game/`); `cd` into it for the other generators. Sources go into a `<name>-core` library, so tests can link them; the `<name>` executable holds only `main.cpp`.

### `cpp:sdl3` {#cpp-sdl3}

An SDL3 app using [callbacks](https://wiki.libsdl.org/SDL3/README/main-functions). SDL3 comes from `find_package`, else `FetchContent`. The app class clears the window to an animated color.

{% include terminal.html id="sdl3" %}

{% include params.html generator="cpp:sdl3" %}

### `cpp:sdl3-opengl` {#cpp-sdl3-opengl}

The same with an OpenGL 4.1 core context: a vendored [glad](https://glad.dav1d.de) loader, `cmake/embed-glsl.cmake`, and an animated full-screen shader quad.

{% include terminal.html id="sdl3_opengl" %}

{% include params.html generator="cpp:sdl3-opengl" %}

### `cpp:app` {#cpp-app}

A console app. `main` wraps `argv` in a `std::span` (bounds profile).

{% include terminal.html id="app" %}

{% include params.html generator="cpp:app" %}

### `cpp:lib` {#cpp-lib}

A library: headers in `include/<name>/`, an export header, install rules and a package config, so consumers can `find_package(my-lib)` and link `my-lib::my-lib`. Internally the target is `<name>-core`, like in the other starters.

{% include terminal.html id="lib" %}

{% include params.html generator="cpp:lib" %}

### `cpp:module` {#cpp-module}

Experimental. C++20 modules: a `.cppm` interface in the core library, `import`ed by `main.cpp`. Needs CMake 3.28+ and `cmake -G Ninja`.

{% include terminal.html id="module" %}

{% include params.html generator="cpp:module" %}

### Core library and markers {#markers}

Starters leave marker comments, like `# jen:sources`, where later generators insert their lines. jen uses the nearest file with the marker, so subfolders can have their own `CMakeLists.txt`. No marker: a `warning:`; add it and rerun. Reruns are safe.

{% capture rows %}
`# jen:sources` | `src/CMakeLists.txt` | `cpp:class`, `cpp:interface --impl`, `cpp:pimpl`
`# jen:embed` | `src/CMakeLists.txt` | `cpp:embed`, `cpp:shader`
`# jen:link` | `src/CMakeLists.txt` | `cpp:warnings`, `cpp:compiler`, `cpp:tracy`
`# jen:app` | `src/CMakeLists.txt` | `cpp:icon` (settings for the executable only)
`# jen:options` | `CMakeLists.txt` | `cpp:tidy`, `cpp:warnings`, `cpp:compiler`, `cpp:tracy`, `cpp:cpack --staticSdl`
`# jen:subdirs` | `CMakeLists.txt` | `cpp:doctest`
`# jen:install`, `# jen:cpack` | `CMakeLists.txt` | `cpp:cpack` (CPack settings come last, after every `install()`)
`# jen:tests` | `tests/CMakeLists.txt` | `--withTest` (set up by `cpp:doctest`)
`// jen:includes` | `src/app.cpp` | `cpp:tracy`
`// jen:frame-end` | `src/app.cpp`, end of `SDL_AppIterate` | `cpp:tracy`
`// jen:gl-init` | `src/app.cpp`, after the glad load (OpenGL starter) | `cpp:tracy --gpu`
{% endcapture %}
{% include cards.html rows=rows label="in" icon="pin" heading="Markers" %}

Tooling generators write `cmake/<name>.cmake`, included at `# jen:options`.

## Classes and types {#classes}

### `cpp:class` {#cpp-class}

Header and source, added at `# jen:sources`.

{% include terminal.html id="class" %}

### `cpp:class --moveOnly` {#cpp-class-moveonly}

A move-only RAII wrapper (Rule of Five) for C APIs with a destroy call: no copy, `noexcept` move, `[[nodiscard]] get()`/`release()`, `explicit operator bool()` (`raii` in my-cpp-snippets).

{% include terminal.html id="class_moveonly" %}

{% include params.html generator="cpp:class" %}

`--help` shows the params in the terminal:

{% include terminal.html id="class_help" %}

### `cpp:handle` {#cpp-handle}

A header-only `Handle<T, Deleter, Null>` for non-pointer handles like `GLuint` or file descriptors (`raiit` in my-cpp-snippets).

{% include terminal.html id="handle" %}

{% include params.html generator="cpp:handle" %}

### `cpp:scopeexit` {#cpp-scopeexit}

A header-only scope guard: runs a callable on destruction unless `release()`d (`scopeexit` in my-cpp-snippets).

{% include terminal.html id="scopeexit" %}

{% include params.html generator="cpp:scopeexit" %}

### `cpp:r0` {#cpp-r0}

A Rule of Zero class with a constructor from `--members` (`r0` in my-cpp-snippets).

{% include terminal.html id="r0" %}

{% include params.html generator="cpp:r0" %}

### `cpp:interface` {#cpp-interface}

A polymorphic base (C.35, C.67, C.128): virtual destructor, protected copy/move against slicing, pure virtuals from `--methods`. `--impl` adds a `final` implementation with stubs. See also [virtual, variant or templates?](#choosing).

{% include terminal.html id="interface" %}

{% include params.html generator="cpp:interface" %}

### `cpp:struct` {#cpp-struct}

An aggregate for data without an invariant (C.2, C.131), with default member initializers (C.48), so `Config{.width = 800}` works.

{% include terminal.html id="struct" %}

{% include params.html generator="cpp:struct" %}

### `cpp:strong` {#cpp-strong}

A strong typedef (I.4) to keep pixels, texels and world units apart.

{% include terminal.html id="strong" %}

{% include params.html generator="cpp:strong" %}

### `cpp:enum` {#cpp-enum}

An `enum class` with `to_string()` and a `std::formatter` (Enum.3): `std::print("{}", GameState::Playing)` works. No `default` in the `switch`, so `-Wswitch` catches new values.

{% include terminal.html id="enum" %}

{% include params.html generator="cpp:enum" %}

### `cpp:pimpl` {#cpp-pimpl}

A pimpl class (I.27), with destructor and moves defaulted in the `.cpp` so `Impl` stays incomplete.

{% include terminal.html id="pimpl" %}

{% include params.html generator="cpp:pimpl" %}

### `cpp:variant` {#cpp-variant}

A `std::variant` of case structs, plus a shared `overloaded` visitor helper. For closed sets like events or render commands – see [virtual, variant or templates?](#choosing).

{% include terminal.html id="variant" %}

{% include params.html generator="cpp:variant" %}

### `--withTest` {#with-test}

`cpp:class`, `r0`, `struct`, `strong`, `enum`, `pimpl`, `variant` and `interface` take `--withTest`: a doctest `<Name>_test.cpp` checking what the generator promises (move-only, aggregate, …), added at `# jen:tests`. Update the checks as the design changes. Needs [`cpp:doctest`](#cpp-doctest) first.

{% include terminal.html id="class_withtest" %}

### Virtual, variant or templates? {#choosing}

Ask who can add new types:

{% capture rows %}
open: plugins, drivers, code you haven't written yet | virtual functions | `cpp:interface`
closed: events, render commands, AST nodes | `std::variant` + `std::visit` | `cpp:variant`
known at compile time | templates and concepts | `cpp:handle`, `cpp:scopeexit` show the style
just one operation | `std::function` / `std::move_only_function` | —
{% endcapture %}
{% include cards.html rows=rows label="use" icon="fork" %}

**The cost of `virtual`** isn't the call – it's no **inlining** or vectorizing, objects scattered behind **pointers** (cache misses), and **mixed types** defeating branch prediction. Irrelevant for a few objects, big for thousands of particles. Measure, then:

- keep **hot loops virtual-free**: plain structs by value, one container per type;
- call virtual **once per batch** (`renderer.draw(span_of_sprites)`);
- mark leaves **`final`** so calls devirtualize (`cpp:interface --impl` does);
- use `std::variant`: no heap, no pointer chasing, missing cases fail to compile.

**Patterns are vocabulary, not rules.** Before adding one, ask: what varies here? Is there a second implementation yet? What does it cost at runtime, compile time and reading time?

The Core Guidelines often favor the plain option: `struct` for data (C.2), concrete types over hierarchies (C.10), hierarchies only for hierarchical concepts (C.120). Virtual belongs at the seams – rendering backend, audio device, plugins – plain data in the loops.

## Tooling {#tooling}

For projects made from a starter.

### `cpp:doctest` {#cpp-doctest}

[doctest](https://github.com/doctest/doctest) via `FetchContent`: a `tests/` target linked to the core library, `doctest_discover_tests()`, and the `# jen:tests` marker for [`--withTest`](#with-test).

{% include terminal.html id="doctest" %}

{% include params.html generator="cpp:doctest" %}

### `cpp:tidy` {#cpp-tidy}

A `.clang-tidy` with `cppcoreguidelines-*`, `modernize-*`, `bugprone-*` and `performance-*`, minus checks noisy in graphics code (each explained). `cmake/tidy.cmake` adds opt-in `-DCLANG_TIDY=ON`; `--cmake=false` skips it.

{% include terminal.html id="tidy" %}

{% include params.html generator="cpp:tidy" %}

### `cpp:format` {#cpp-format}

A `.clang-format` matching the generated code. Keep `--indent` and `--columnLimit` in line with `.editorconfig`.

{% include terminal.html id="format" %}

{% include params.html generator="cpp:format" %}

### `cpp:presets` {#cpp-presets}

`CMakePresets.json` with `debug`, `release`, `asan` and `ubsan` presets (sanitizers on GCC and Clang).

{% include terminal.html id="presets" %}

### `cpp:warnings` {#cpp-warnings}

`-Wall -Wextra -Wpedantic -Wconversion -Wshadow` (`/W4 /permissive-` on MSVC) for the core library only, not vendored code. `--werror` adds `-Werror`/`/WX`.

{% include terminal.html id="warnings" %}

{% include params.html generator="cpp:warnings" %}

### `cpp:compiler` {#cpp-compiler}

Settings towards the Core Guidelines: no compiler extensions (P.2), `compile_commands.json`, and for the core library:

- **guideline warnings**, each commented with its rule: `-Wnon-virtual-dtor` (C.35), `-Woverloaded-virtual` (C.138), `-Wsuggest-override` (C.128), `-Wold-style-cast` (ES.49), `-Wcast-align` (ES.48), `-Wdouble-promotion` (ES.46), `-Wformat=2` (ES.34), `-Wimplicit-fallthrough` (ES.78), `-Wnull-dereference` (ES.65), `-Werror=return-type`; MSVC equivalents
- **hardening**: bounds-checked `operator[]` in Debug, stack protector, `_FORTIFY_SOURCE=2`, stack-clash and CET on Linux x86, `/GS /guard:cf /sdl` on MSVC. `--hardening=false` leaves it out.

Bounds checks need a Debug build (`debug` preset). `-Wuseless-cast` is off: SDL's macros trip it.

{% include terminal.html id="compiler" %}

{% include params.html generator="cpp:compiler" %}

## Profiling {#profiling}

### `cpp:tracy` {#cpp-tracy}

The [Tracy](https://github.com/wolfpld/tracy) profiler behind a `PROFILING` option (off: zero cost). Adds `FrameMark;` at `// jen:frame-end`; `--gpu` (OpenGL starter) adds GPU zones too.

{% include terminal.html id="tracy" %}

{% include params.html generator="cpp:tracy" %}

Enable: `cmake -S . -B build -DPROFILING=ON`.

## Packaging {#packaging}

### `cpp:cpack` {#cpp-cpack}

`install()` rules and CPack: the executable, assets, per-platform packages (Windows `ZIP;NSIS`, macOS `DragNDrop` `.app`, Linux `TGZ;DEB`) and an `$ORIGIN` RPATH. A shared SDL3 ships alongside; `--staticSdl` links it statically. NSIS must be installed (`cpack -G ZIP` works without).

{% include terminal.html id="cpack" %}

{% include params.html generator="cpp:cpack" %}

### `cpp:icon` {#cpp-icon}

App icons: a Windows `app.rc` and a macOS `.icns` in the bundle, at `# jen:app`. Bring your own `resources/app.ico` and `app.icns` (or `--ico`, `--icns`). Pairs with `cpp:cpack`.

{% include terminal.html id="icon" %}

{% include params.html generator="cpp:icon" %}

## Resources {#resources}

### `cpp:shader` {#cpp-shader}

Embeds an existing GLSL file (e.g. from [`glsl:frag`]({{ '/glsl.html#glsl-frag' | relative_url }})) as a C string header at configure time, via `embed_glsl(...)` at `# jen:embed`. Edit the `.glsl`, rerun `cmake`.

{% include terminal.html id="shader" %}

A missing file points you to `glsl:frag`.

{% include params.html generator="cpp:shader" %}

### `cpp:embed` {#cpp-embed}

Portable binary embedding until `#embed` is everywhere. Arrays are generated at **build time**, so changed assets re-embed on their own. Then `#include "tilesPng.h"` and `SDL_IOFromConstMem(tilesPng.data(), tilesPng.size())`.

{% include terminal.html id="embed" %}

{% include params.html generator="cpp:embed" %}

Slow for assets in the tens of MB. Include each header from one `.cpp` only.

## Putting it together {#putting-it-together}

A starter plus scaffolding:

{% include terminal.html id="together" %}

With tooling:

{% include terminal.html id="together_tooling" %}

### C++ standard {#cpp-standard}

Starters use C++23. For C++20 projects, use `cpp:enum --std=20`.
