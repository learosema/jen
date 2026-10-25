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

{% include terminal.html id="install_global" %}

### Locally <span class="pill label">best for monorepos</span> {#install-local}

{% include terminal.html id="install_local" %}

### Not at all {#install-npx}

{% include terminal.html id="install_npx" %}

{% include terminal.html id="install_from" %}

## Where files go {#where}

Into the current folder, or `--dir`. App starters make a project folder; tooling writes to the project root.

## App starters {#app-starters}

### `cpp:sdl3` {#cpp-sdl3}

{% include terminal.html id="sdl3" %}

{% include params.html generator="cpp:sdl3" %}

### `cpp:sdl3-opengl` {#cpp-sdl3-opengl}

OpenGL 4.1 core, [glad](https://glad.dav1d.de) and a shader quad.

{% include terminal.html id="sdl3_opengl" %}

{% include params.html generator="cpp:sdl3-opengl" %}

### `cpp:app` {#cpp-app}

{% include terminal.html id="app" %}

{% include params.html generator="cpp:app" %}

### `cpp:lib` {#cpp-lib}

{% include terminal.html id="lib" %}

{% include params.html generator="cpp:lib" %}

### `cpp:module` {#cpp-module}

Experimental; CMake 3.28+ and Ninja.

{% include terminal.html id="module" %}

{% include params.html generator="cpp:module" %}

### Core library and markers {#markers}

Generators insert at these comments, in the nearest file that has one.

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

## Classes and types {#classes}

### `cpp:class` {#cpp-class}

{% include terminal.html id="class" %}

### `cpp:class --moveOnly` {#cpp-class-moveonly}

{% include terminal.html id="class_moveonly" %}

{% include params.html generator="cpp:class" %}

### `cpp:handle` {#cpp-handle}

{% include terminal.html id="handle" %}

{% include params.html generator="cpp:handle" %}

### `cpp:scopeexit` {#cpp-scopeexit}

{% include terminal.html id="scopeexit" %}

{% include params.html generator="cpp:scopeexit" %}

### `cpp:r0` {#cpp-r0}

{% include terminal.html id="r0" %}

{% include params.html generator="cpp:r0" %}

### `cpp:interface` {#cpp-interface}

{% include terminal.html id="interface" %}

{% include params.html generator="cpp:interface" %}

### `cpp:struct` {#cpp-struct}

{% include terminal.html id="struct" %}

{% include params.html generator="cpp:struct" %}

### `cpp:strong` {#cpp-strong}

{% include terminal.html id="strong" %}

{% include params.html generator="cpp:strong" %}

### `cpp:enum` {#cpp-enum}

{% include terminal.html id="enum" %}

{% include params.html generator="cpp:enum" %}

### `cpp:pimpl` {#cpp-pimpl}

{% include terminal.html id="pimpl" %}

{% include params.html generator="cpp:pimpl" %}

### `cpp:variant` {#cpp-variant}

{% include terminal.html id="variant" %}

{% include params.html generator="cpp:variant" %}

### `--withTest` {#with-test}

A doctest case at `# jen:tests`; needs [`cpp:doctest`](#cpp-doctest).

{% include terminal.html id="class_withtest" %}

### Virtual, variant or templates? {#choosing}

{% capture rows %}
open: plugins, drivers, code you haven't written yet | virtual functions | `cpp:interface`
closed: events, render commands, AST nodes | `std::variant` + `std::visit` | `cpp:variant`
known at compile time | templates and concepts | `cpp:handle`, `cpp:scopeexit` show the style
just one operation | `std::function` / `std::move_only_function` | —
{% endcapture %}
{% include cards.html rows=rows label="use" icon="fork" %}

## Tooling {#tooling}

### `cpp:doctest` {#cpp-doctest}

{% include terminal.html id="doctest" %}

{% include params.html generator="cpp:doctest" %}

### `cpp:tidy` {#cpp-tidy}

{% include terminal.html id="tidy" %}

{% include params.html generator="cpp:tidy" %}

### `cpp:format` {#cpp-format}

{% include terminal.html id="format" %}

{% include params.html generator="cpp:format" %}

### `cpp:presets` {#cpp-presets}

{% include terminal.html id="presets" %}

### `cpp:warnings` {#cpp-warnings}

{% include terminal.html id="warnings" %}

{% include params.html generator="cpp:warnings" %}

### `cpp:compiler` {#cpp-compiler}

Core Guidelines warnings and hardening.

{% include terminal.html id="compiler" %}

{% include params.html generator="cpp:compiler" %}

## Profiling {#profiling}

### `cpp:tracy` {#cpp-tracy}

[Tracy](https://github.com/wolfpld/tracy), on with `-DPROFILING=ON`.

{% include terminal.html id="tracy" %}

{% include params.html generator="cpp:tracy" %}

## Packaging {#packaging}

### `cpp:cpack` {#cpp-cpack}

{% include terminal.html id="cpack" %}

{% include params.html generator="cpp:cpack" %}

### `cpp:icon` {#cpp-icon}

Bring your own `resources/app.ico` and `app.icns`.

{% include terminal.html id="icon" %}

{% include params.html generator="cpp:icon" %}

## Resources {#resources}

### `cpp:shader` {#cpp-shader}

Embeds a GLSL file, e.g. from [`glsl:frag`]({{ '/glsl.html#glsl-frag' | relative_url }}).

{% include terminal.html id="shader" %}

{% include params.html generator="cpp:shader" %}

### `cpp:embed` {#cpp-embed}

{% include terminal.html id="embed" %}

{% include params.html generator="cpp:embed" %}

## Putting it together {#putting-it-together}

{% include terminal.html id="together" %}

{% include terminal.html id="together_tooling" %}

### C++ standard {#cpp-standard}

C++23; `cpp:enum --std=20` for C++20.
