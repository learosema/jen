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
      - { title: Files and the project root, id: where }
  - title: App starters
    links:
      - { title: "cpp:sdl3", id: cpp-sdl3 }
      - { title: "cpp:sdl3-opengl", id: cpp-sdl3-opengl }
      - { title: "cpp:app", id: cpp-app }
      - { title: "cpp:lib", id: cpp-lib }
      - { title: "cpp:module", id: cpp-module }
      - { title: Core library and markers, id: markers }
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
      - { title: "Virtual, variant or templates?", id: choosing }
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
      - { title: Putting it together, id: putting-it-together }
      - { title: C++ standard, id: cpp-standard }
---

## Install {#install}

Three ways to get the pack, depending on how much you want on your machine. The generators are the same in every case.

### Globally {#install-global}

One install, every project. jen finds globally installed packs next to itself, without listing them anywhere, so this also works in projects without a `package.json`, like most C++ repos.

{% include terminal.html id="install_global" %}

### Locally <span class="pill label">best for monorepos</span> {#install-local}

Add both as dev dependencies. jen reads packs straight from the project's `package.json`, so the generator versions are pinned with the repo: every contributor and every CI run gets the same ones, and there's nothing to set up on anyone's machine. In a monorepo, put them in the root.

{% include terminal.html id="install_local" %}

### Not at all {#install-npx}

Nothing to install but jen itself, or not even that with `npx`. When you ask for a prefixed generator like `cpp:sdl3` and the pack isn't installed, jen fetches `@codejen/pack-cpp` via npm into a throwaway directory, runs it once and removes it again: no `package.json` entry, no `node_modules` left behind.

{% include terminal.html id="install_npx" %}

That automatic fetch only ever pulls from the `@codejen` scope, so a mistyped name can't install someone else's package; set `JEN_NO_FETCH=1` to turn it off. For a pack from any other scope, or a Yeoman generator, be explicit with `--from`. Apart from these two, jen never touches the network.

{% include terminal.html id="install_from" %}

## Where files go {#where}

Generators write into the folder you run them in. Run at the project root, the type generators (`cpp:class`, `cpp:struct`, `cpp:enum`, …) use `src`, so `cpp:class --name=Foo` writes `src/Foo.h` without a `cd`. The app starters make a new project folder in the current directory instead; `--dir` names it. The [home page]({{ '/#where' | relative_url }}) has the general rules.

From `src/net/`, `cpp:class --name=Socket` writes `src/net/Socket.h` and wires `net/Socket.cpp` into the `CMakeLists.txt` that carries `# jen:sources`, which jen finds by walking up from where you are. Wiring is looked up by marker, never guessed:

- **`--dir`**: write somewhere else, relative to the current directory.
- **`--cmake`**: the `CMakeLists.txt` to wire into, if the nearest one with the marker is the wrong one; a file that doesn't exist is an error. `--cmake=none` skips wiring.
- **`--withTest`**: the test goes next to the `CMakeLists.txt` that carries `# jen:tests`, `tests/` if there is none yet.
- **No marker**: jen quits with a hint instead of leaving a file nothing builds.

The tooling generators (`cpp:warnings`, `cpp:tidy`, `cpp:doctest`, …) work on the project as a whole, so they find the project root from wherever you are.

## App starters {#app-starters}

Every starter creates a new project folder named after the app (`MyGame` becomes `my-game/`), so `cd` into it before running the other generators. All of them split the project into a `<name>-core` library that holds every source file and a thin `<name>` executable that holds only `main.cpp`, which is what makes the code linkable from tests.

### `cpp:sdl3` {#cpp-sdl3}

An SDL3 [callbacks](https://wiki.libsdl.org/SDL3/README/main-functions)-based app: root `CMakeLists.txt`, a `vendor/` that `FetchContent`s SDL3 (a local `find_package` is tried first, so nothing touches the network if SDL3 is already installed), and an app class in the core library clearing the window to an animated color.

{% include terminal.html id="sdl3" %}

{% capture rows %}
`name` | — | required; project/target name, window title, app metadata id
`width` | `800` | initial window width
`height` | `600` | initial window height
`bundleId` | — | defaults to `com.example.<kebab-name>`
`folderCase` | `kebab` | `kebab` (`my-game/`) or `pascal` (`MyGame/`) for the new project folder
`dir` | — | explicit folder instead of one derived from `name`; `--dir=.` writes into the current directory
`sdlTag` | `release-3.4.14` | SDL3 git tag to fetch
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `cpp:sdl3-opengl` {#cpp-sdl3-opengl}

The same starter with an OpenGL 4.1 core context instead: vendors a real, checked-in [glad](https://glad.dav1d.de) loader under `vendor/glad/`, adds `cmake/embed-glsl.cmake`, and scaffolds an app class that compiles a shader pair and draws an animated full-screen quad. Same params as `cpp:sdl3`.

{% include terminal.html id="sdl3_opengl" %}

### `cpp:app` {#cpp-app}

A console starter without SDL. `main(int argc, char** argv)` wraps the arguments in a `std::span` to avoid pointer arithmetic (bounds profile). Params: `name`, `folderCase`, `dir`.

{% include terminal.html id="app" %}

### `cpp:lib` {#cpp-lib}

A library starter: public headers in `include/<name>/`, `BUILD_INTERFACE`/`INSTALL_INTERFACE` include dirs, a generated export header, and install rules plus a CMake package config, so consumers can `find_package(my-lib)` and link `my-lib::my-lib`. The target is called `<name>-core` internally like in the other starters (so tests and `cpp:embed` find it) and is exported as `<name>::<name>`. Params: `name`, `folderCase`, `dir`.

{% include terminal.html id="lib" %}

### `cpp:module` {#cpp-module}

Experimental. A C++20 modules starter: a `.cppm` module interface in a `FILE_SET CXX_MODULES` of the core library, `import`ed by `main.cpp`. Needs CMake 3.28 or newer and a module-capable generator (`cmake -G Ninja`). Params: `name`, `folderCase`, `dir`.

{% include terminal.html id="module" %}

### Core library and markers {#markers}

The starters leave marker comments in the files they write, like `# jen:sources` in `src/CMakeLists.txt`. When you run another generator afterwards, say `cpp:class`, it inserts its new line at the matching marker instead of guessing where it belongs. If a project has no such marker (it wasn't made from a starter), the generator quits with a hint instead of leaving a file nothing builds: add the marker, point it at the right `CMakeLists.txt` with `--cmake=<file>`, or skip wiring with `--cmake=none`. Running it twice is safe: the second time it just reports "already present".

Each card below is one marker: the file it lives in, and the generators that insert there.

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

The tooling generators write a `cmake/<name>.cmake` and add an `include(...)` at `# jen:options`, and refer to the core library as `${PROJECT_NAME}-core`.

## Classes and types {#classes}

### `cpp:class` {#cpp-class}

Plain header/source class, wired into its `CMakeLists.txt`'s sources list at the `# jen:sources` marker.

{% include terminal.html id="class" %}

### `cpp:class --moveOnly` {#cpp-class-moveonly}

A move-only RAII wrapper instead (Rule of Five): deleted copy, `noexcept` move via `release()`/`reset()`, `[[nodiscard]] get()`/`release()`, and an `explicit operator bool()`. Use it for C-APIs with a non-trivial destroy call (`raii` in my-cpp-snippets).

{% include terminal.html id="class_moveonly" %}

{% capture rows %}
`name` | — | required; the class name
`namespace` | `''` | wraps the class in a namespace
`moveOnly` | `false` | scaffold a move-only RAII wrapper instead of a plain class
`resource` | `Resource*` | `--moveOnly` only: the handle's type
`nullValue` | `nullptr` | `--moveOnly` only: the value meaning "no resource"
`destroy` | `destroy` | `--moveOnly` only: the function that frees the resource
`withTest` | `false` | also scaffold a test, see [`--withTest`](#with-test)
`dir` | — | where the files go, relative to the current directory; else the current directory, or `src` at the project root
`cmake` | — | the `CMakeLists.txt` to wire into, if the nearest one with `# jen:sources` is the wrong one; `none` skips wiring
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `cpp:handle` {#cpp-handle}

A generic, header-only `Handle<T, Deleter, Null>` template for non-pointer handles (`GLuint`, a file descriptor, …), constrained with `std::regular`/`std::invocable` (`raiit` in my-cpp-snippets).

{% include terminal.html id="handle" %}

### `cpp:scopeexit` {#cpp-scopeexit}

A header-only `ScopeExit` scope-guard template: runs a `noexcept`-checked callable on destruction unless `release()`d first (`scopeexit` in my-cpp-snippets).

{% include terminal.html id="scopeexit" %}

### `cpp:r0` {#cpp-r0}

A Rule of Zero class: no special member functions, one constructor generated from `--members`, private members set from the moved-from constructor params (`r0` in my-cpp-snippets).

{% include terminal.html id="r0" %}

{% capture rows %}
`name` | — | required; the class name
`members` | — | required; comma-separated `Type name` pairs
`namespace` | `''` | wraps the class in a namespace
`compare` | `false` | adds `auto operator<=>(const X&) const = default;`
`withTest` | `false` | also scaffold a test
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `cpp:interface` {#cpp-interface}

A polymorphic base class (C.35, C.67, C.128): virtual defaulted destructor, protected copy/move to prevent slicing, pure virtual methods from `--methods`. With `--impl` it also scaffolds a `final` derived class with all the `override`s, stub bodies in a `.cpp` wired in at `# jen:sources`. Not sure it's the right tool? See [virtual, variant or templates?](#choosing).

{% include terminal.html id="interface" %}

{% capture rows %}
`name` | — | required; interface name
`methods` | `''` | e.g. `"void draw(), void resize(int w, int h)"`
`impl` | `''` | name of a concrete implementation class
`namespace` | `''` | wraps the classes in a namespace
`withTest` | `false` | also scaffold a test
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `cpp:struct` {#cpp-struct}

An aggregate for plain data bundles without an invariant (C.2, C.131): public members with default member initializers (C.48), so designated initializers work (`Config{.width = 800}`). Members without an initializer get `{}`.

{% include terminal.html id="struct" %}

{% capture rows %}
`name` | — | required
`members` | — | required; e.g. `"int width = 800, int height = 600"`
`compare` | `false` | adds `auto operator<=>(const X&) const = default;`
`namespace` | `''` | 
`withTest` | `false` | also scaffold a test
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `cpp:strong` {#cpp-strong}

A strong typedef (I.4): explicit constructor, `value()`, and optional operators. Keeps pixels, texels and world units apart.

{% include terminal.html id="strong" %}

{% capture rows %}
`name` | — | required
`underlying` | — | required; the wrapped type
`ops` | `compare` | comma-separated: `compare` (`<=>`), `arith` (`+ - * /`, scalar for `* /`), `hash` (`std::hash`)
`namespace` | `''` | 
`withTest` | `false` | also scaffold a test
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `cpp:enum` {#cpp-enum}

An `enum class` with `to_string()` and a `std::formatter` specialization (Enum.3), so `std::print("{}", GameState::Playing)` just works. The `switch` has no `default` on purpose: `-Wswitch` then warns when a value is added but `to_string` isn't updated. Header-only.

{% include terminal.html id="enum" %}

{% capture rows %}
`name` | — | required
`values` | — | required; e.g. `"idle, running, paused"`
`namespace` | `''` | 
`std` | `23` | `20` uses `std::abort()` instead of `std::unreachable()`
`withTest` | `false` | also scaffold a test
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `cpp:pimpl` {#cpp-pimpl}

A pimpl class (I.27): `std::unique_ptr<Impl>`, with the destructor and move operations defaulted in the `.cpp` so `Impl` can stay incomplete in the header. Easy to get wrong by hand. Params: `name`, `namespace`, `withTest`.

{% include terminal.html id="pimpl" %}

### `cpp:variant` {#cpp-variant}

A `std::variant` of small case structs plus the `overloaded` visitor helper (in its own `src/overloaded.h`, shared between variants): a modern alternative to a class hierarchy, e.g. for events or render commands. Often the better pick when the set of cases is closed, see [virtual, variant or templates?](#choosing).

{% include terminal.html id="variant" %}

{% capture rows %}
`name` | — | required; name of the variant alias
`cases` | — | required; e.g. `"KeyDown, KeyUp, Resize"`
`namespace` | `''` | 
`withTest` | `false` | also scaffold a test
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `--withTest` {#with-test}

`cpp:class`, `cpp:r0`, `cpp:struct`, `cpp:strong`, `cpp:enum`, `cpp:pimpl`, `cpp:variant` and `cpp:interface` take `--withTest`. It scaffolds `<Name>_test.cpp` next to the `CMakeLists.txt` that carries `# jen:tests` (`tests/` if there is none yet) with a doctest case checking what the generator promises (move-only, aggregate, abstract, …), and adds it at that marker. The checks describe the class as generated, so update them when you change the design: give a class a constructor with arguments and the default-constructible check has to go. Run [`cpp:doctest`](#cpp-doctest) first, otherwise only the test file is written and the insert is reported as skipped.

{% include terminal.html id="class_withtest" %}

### Virtual, variant or templates? {#choosing}

Polymorphism is still good practice, but it isn't the default. Pick by asking who can add new types:

{% capture rows %}
open: plugins, drivers, code you haven't written yet | virtual functions | `cpp:interface`
closed: events, render commands, AST nodes | `std::variant` + `std::visit` | `cpp:variant`
known at compile time | templates and concepts | `cpp:handle`, `cpp:scopeexit` show the style
just one operation | `std::function` / `std::move_only_function` | —
{% endcapture %}
{% include cards.html rows=rows label="use" icon="fork" %}

**What does `virtual` cost in a game loop?** A single virtual call is cheap: one indirect jump, well predicted when the same type shows up repeatedly. The expensive parts are around it:

- the call can't be **inlined**, so the compiler can't optimize across it or vectorize the loop;
- objects live behind **pointers**, usually scattered on the heap, so iterating them is a cache miss per element;
- with **mixed types** in one container, the indirect branch is hard to predict.

It rarely matters for a handful of objects per frame, and it matters a lot for the inner loop over thousands of particles or entities. Measure before you rewrite, then:

- keep **hot loops free of virtual calls**: store plain structs by value in contiguous containers, one container per type, and loop over each;
- call virtual **once per batch** (`renderer.draw(span_of_sprites)`), not once per element;
- mark leaf classes **`final`**, which lets the compiler devirtualize calls it can see (`cpp:interface --impl` already generates a `final` class);
- use `std::variant` where it fits: values in a `std::vector`, no heap, no pointer chasing, and a missing case is a compile error.

**Patterns are a vocabulary, not a rule book.** A pattern name describes a solution that worked in a particular context; it doesn't say your code needs it. Before reaching for one, ask:

- *What changes here, and who changes it?* If nothing varies, nothing needs the indirection.
- *Is there a second implementation yet?* Turning a plain struct into an interface later is easy. Removing an abstraction nobody uses is not.
- *What does it cost, and where?* Runtime (the list above), compile time (templates), and reading time (every layer is one more file to open).

The Core Guidelines back the plain option more often than you might expect: use a `struct` for data without an invariant (C.2, `cpp:struct`), prefer concrete types over class hierarchies (C.10), and use a hierarchy only for concepts with inherent hierarchical structure (C.120). They are a neutral reference to point at in a design discussion, and they apply to patterns the same way they apply to everything else: "can you justify this?" is a fair question for a Factory and for a free function alike.

This is the core of the "clean code vs. performance" debate: hiding every decision behind small polymorphic objects reads nicely, but costs real throughput once it's in the hot path. Use virtual at the architectural seams (rendering backend, audio device, plugin boundary) and plain data in the loops.

## Tooling {#tooling}

These work on an existing project made from a starter.

### `cpp:doctest` {#cpp-doctest}

Sets up [doctest](https://github.com/doctest/doctest) via `FetchContent`: `enable_testing()`, a `tests/` directory with a `DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN` main, a `tests` target linked against `${PROJECT_NAME}-core`, `doctest_discover_tests()`, and the `# jen:tests` marker for [`--withTest`](#with-test). Param: `doctestTag` (default `v2.4.12`).

{% include terminal.html id="doctest" %}

doctest also supports inline tests in the `.cpp` files with `DOCTEST_CONFIG_DISABLE` in release builds. That's charming for small projects but scales worse, so it isn't scaffolded.

### `cpp:tidy` {#cpp-tidy}

A `.clang-tidy` enabling `cppcoreguidelines-*`, `modernize-*`, `bugprone-*` and `performance-*`, with the checks that are noisy in graphics/SDL code (magic numbers, pointer arithmetic, varargs, …) switched off and explained in a comment. It also adds `cmake/tidy.cmake`, an opt-in `-DCLANG_TIDY=ON` that runs it during the build; `--cmake=false` skips that part.

{% include terminal.html id="tidy" %}

### `cpp:format` {#cpp-format}

A `.clang-format` matching the style the generators emit. Params: `basedOn` (`Google`), `indent` (`2`), `columnLimit` (`120`); keep them in line with your `.editorconfig`.

{% include terminal.html id="format" %}

### `cpp:presets` {#cpp-presets}

A `CMakePresets.json` with `debug`, `release`, `asan` and `ubsan` configure, build and test presets (`cmake --preset asan`). The sanitizer presets are for GCC and Clang.

{% include terminal.html id="presets" %}

### `cpp:warnings` {#cpp-warnings}

A `project_warnings` INTERFACE target with `-Wall -Wextra -Wpedantic -Wconversion -Wshadow` (`/W4 /permissive-` on MSVC), linked privately into the core library so vendored code isn't affected. `--werror` adds `-Werror` / `/WX`.

{% include terminal.html id="warnings" %}

### `cpp:compiler` {#cpp-compiler}

Compiler settings that nudge the build towards the Core Guidelines, complementing `cpp:warnings` (general warnings) and `cpp:tidy` (static analysis). `cmake/compiler.cmake` sets build-wide conventions: `CMAKE_CXX_EXTENSIONS OFF` (`-std=c++23`, not `gnu++23`, P.2), `CMAKE_CXX_STANDARD_REQUIRED`, and `compile_commands.json` for clangd and clang-tidy. It also defines a `project_options` INTERFACE target, linked privately into the core library, with:

- **guideline warnings**, each commented with its rule: `-Wnon-virtual-dtor` (C.35), `-Woverloaded-virtual` (C.138), `-Wsuggest-override` (C.128), `-Wold-style-cast` (ES.49), `-Wcast-align` (ES.48), `-Wdouble-promotion` (ES.46), `-Wformat=2` (ES.34), `-Wimplicit-fallthrough` (ES.78), `-Wnull-dereference` (ES.65) and `-Werror=return-type`; `/utf-8 /Zc:__cplusplus /Zc:inline /EHsc` on MSVC
- **hardening**: bounds-checked `operator[]` in Debug via `_GLIBCXX_ASSERTIONS` (and libc++'s hardening modes), `-fstack-protector-strong`, `_FORTIFY_SOURCE=2` outside Debug, stack-clash protection and CET on Linux x86, `/GS /guard:cf /sdl` on MSVC. `--hardening=false` leaves these out.

`-Wuseless-cast` is deliberately not enabled: it fires inside SDL's own macros. Note that the Debug-only bounds checks are inactive without a build type, so use the `debug` preset or `-DCMAKE_BUILD_TYPE=Debug`.

{% include terminal.html id="compiler" %}

## Profiling {#profiling}

### `cpp:tracy` {#cpp-tracy}

The [Tracy](https://github.com/wolfpld/tracy) profiler via `FetchContent`, linked into the core library. A `PROFILING` CMake option (default `OFF`) drives `TRACY_ENABLE`; Tracy's macros compile to nothing without it, so no wrapper header is needed. Inserts `FrameMark;` at `// jen:frame-end`. `--gpu` (OpenGL starter) also adds `TracyGpuContext;` at `// jen:gl-init` and `TracyGpuCollect;` before the frame mark.

{% include terminal.html id="tracy" %}

{% capture rows %}
`gpu` | `false` | OpenGL GPU zones
`file` | `src/app.cpp` | the file the markers are in
`tracyTag` | `v0.11.1` | Tracy git tag to fetch
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

Then `cmake -S . -B build -DPROFILING=ON`.

## Packaging {#packaging}

### `cpp:cpack` {#cpp-cpack}

`install()` rules and CPack packaging, at `# jen:install` and `# jen:cpack`: the executable, an assets directory (skipped if it doesn't exist), `CPACK_GENERATOR` per platform (Windows `ZIP;NSIS`, macOS `DragNDrop`, Linux `TGZ;DEB`), an `$ORIGIN` RPATH so the unpacked binary finds its libraries, and a macOS `.app` bundle with `cmake/Info.plist.in`.

A shared SDL3 is shipped next to the executable (`IMPORTED_RUNTIME_ARTIFACTS` for an installed SDL3, `install(TARGETS SDL3-shared)` for a fetched one). `--staticSdl` builds SDL3 statically instead, often the simpler choice for games. The NSIS generator needs NSIS installed; `cpack -G ZIP` works without it.

{% include terminal.html id="cpack" %}

{% capture rows %}
`assets` | `assets` | directory installed next to the binary
`staticSdl` | `false` | build SDL3 statically instead of shipping the shared library
`bundleId` | — | macOS bundle id, defaults to `com.example.${PROJECT_NAME}`
`maintainer` | — | vendor and Debian maintainer, defaults to `${PROJECT_NAME} maintainers`
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `cpp:icon` {#cpp-icon}

Platform app resources, separate from embedding: a Windows `resources/app.rc` that attaches an icon to the executable, and a macOS `.icns` copied into the bundle's `Resources`, both wired in at `# jen:app`. jen only writes text, so drop your own `resources/app.ico` and `resources/app.icns` in (`--ico` and `--icns` change the paths). Pairs with `cpp:cpack`.

{% include terminal.html id="icon" %}

## Resources {#resources}

### `cpp:shader` {#cpp-shader}

Embeds a GLSL file you already have: write it with [`glsl:frag`]({{ '/glsl.html#glsl-frag' | relative_url }}) from the glsl pack, or by hand. `cpp:shader` turns it into a `<file>.h` header holding the source as a C string at CMake-configure time, using `cmake/embed-glsl.cmake` (added if missing). It writes no GLSL of its own; it only wires `embed_glsl(...)` in at the `# jen:embed` marker, with the shader's path relative to that `CMakeLists.txt`. Edit the `.glsl` later and just re-run `cmake`.

{% include terminal.html id="shader" %}

If the file doesn't exist yet, jen says so and points at `glsl:frag`.

{% capture rows %}
`file` | — | required; the shader to embed, relative to the current directory
`name` | derived | the C++ variable: `vignette.frag.glsl` becomes `vignetteFragmentShader`, `blur.glsl` becomes `blurShader`
`cmake` | — | the `CMakeLists.txt` to wire into; `none` only adds the helper
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `cpp:embed` {#cpp-embed}

Cross-platform binary embedding. `#embed` isn't portable yet (C only in Clang/GCC 15, C++26 for C++, no MSVC), so the byte array is generated at **build time** with `add_custom_command`: assets are re-embedded when they change, without re-running `cmake`. Then `#include "tilesPng.h"` and use `SDL_IOFromConstMem(tilesPng.data(), tilesPng.size())`.

{% include terminal.html id="embed" %}

{% capture rows %}
`file` | — | required; path relative to the project's source dir
`name` | — | required; the C++ variable and header name
`target` | `${PROJECT_NAME}-core` | the target to add it to
`method` | `cmake` | only `cmake` for now
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

CMake's regex gets noticeably slow for assets in the tens of MB, and each generated header should be included from exactly one `.cpp`, since large `constexpr` arrays cost compile time in every translation unit.

## Putting it together {#putting-it-together}

The starters set up the markers the other generators insert into, so a starter plus scaffolding is just a few commands:

{% include terminal.html id="together" %}

And with the tooling on top:

{% include terminal.html id="together_tooling" %}

### C++ standard {#cpp-standard}

The starters build as C++23 (`cxx_std_23`), which `cpp:enum`'s `std::unreachable()` and `std::format` formatter rely on. `cpp:enum --std=20` is there for projects that stay on C++20.
