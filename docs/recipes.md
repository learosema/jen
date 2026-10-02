---
layout: doc
permalink: /recipes.html
title: jen — cpp pack recipes
description: "Every jen command in @codejen/pack-cpp: classes, RAII wrappers, shaders, and SDL3 app starters."
eyebrow: "@codejen/pack-cpp"
mega: recipes
lede: Every generator, with the exact command and the <em>plan</em> it prints.
sub: Modern C++ scaffolding and app starters.
cta: { text: "Three ways to install ↓", url: "#install" }
toc:
  - title: Install
    links:
      - { title: Globally, id: install-global }
      - { title: Locally, id: install-local }
      - { title: Not at all, id: install-npx }
  - title: App starters
    links:
      - { title: "cpp:sdl3", id: cpp-sdl3 }
      - { title: "cpp:sdl3-opengl", id: cpp-sdl3-opengl }
  - title: Classes
    links:
      - { title: class, id: class }
      - { title: "class --moveOnly", id: class-moveonly }
      - { title: "cpp:handle", id: cpp-handle }
      - { title: "cpp:scopeexit", id: cpp-scopeexit }
      - { title: "cpp:r0", id: cpp-r0 }
  - title: Shaders
    links:
      - { title: "cpp:shader", id: cpp-shader }
  - title: Finally
    links:
      - { title: Putting it together, id: putting-it-together }
---

## Install {#install}

Three ways to get the pack, depending on how much you want on your machine. The generators are the same in every case.

### Globally {#install-global}

One install, every project. jen finds globally installed packs next to itself, without listing them anywhere, so this also works in projects without a `package.json`, like most C++ repos.

{% include terminal.html id="install_global" %}

### Locally <span class="badge">best for monorepos</span> {#install-local}

Add both as dev dependencies. jen reads packs straight from the project's `package.json`, so the generator versions are pinned with the repo: every contributor and every CI run gets the same ones, and there's nothing to set up on anyone's machine. In a monorepo, put them in the root.

{% include terminal.html id="install_local" %}

### Not at all {#install-npx}

Nothing to install but jen itself, or not even that with `npx`. When you ask for a prefixed generator like `cpp:sdl3` and the pack isn't installed, jen fetches `@codejen/pack-cpp` via npm into a throwaway directory, runs it once and removes it again: no `package.json` entry, no `node_modules` left behind.

{% include terminal.html id="install_npx" %}

That automatic fetch only ever pulls from the `@codejen` scope, so a mistyped name can't install someone else's package; set `JEN_NO_FETCH=1` to turn it off. For a pack from any other scope, or a Yeoman generator, be explicit with `--from`. Apart from these two, jen never touches the network.

{% include terminal.html id="install_from" %}

## App starters {#app-starters}

### `cpp:sdl3` {#cpp-sdl3}

An SDL3 [callbacks](https://wiki.libsdl.org/SDL3/README/main-functions)-based app: root `CMakeLists.txt`, a `vendor/` that `FetchContent`s SDL3 (a local `find_package` is tried first, so nothing touches the network if SDL3 is already installed), and `src/main.cpp` clearing the window to an animated color.

{% include terminal.html id="sdl3" %}

<div class="params-wrap" markdown="1">

| Param | Default | Description |
| --- | --- | --- |
| `name` | — | required; project/target name, window title, app metadata id |
| `width` | `800` | initial window width |
| `height` | `600` | initial window height |
| `bundleId` | — | defaults to `com.example.<kebab-name>` |
| `folderCase` | `kebab` | `kebab` (`my-game/`) or `pascal` (`MyGame/`) for the new project folder |
| `dir` | — | explicit folder instead of one derived from `name`; `--dir=.` writes into the current directory |
| `sdlTag` | `release-3.4.14` | SDL3 git tag to fetch |
{: .params}

</div>

### `cpp:sdl3-opengl` {#cpp-sdl3-opengl}

The same starter with an OpenGL 4.1 core context instead: vendors a real, checked-in [glad](https://glad.dav1d.de) loader under `vendor/glad/`, adds `cmake/embed-glsl.cmake`, and scaffolds an app class that compiles a shader pair and draws an animated full-screen quad. Same params as `cpp:sdl3`.

{% include terminal.html id="sdl3_opengl" %}

This sets up the `src/CMakeLists.txt` markers `class` and `cpp:shader` look for, so scaffolding composes with it — see below.

## Classes {#classes}

### `class` {#class}

Plain header/source class in `src/`, wired into `src/CMakeLists.txt`'s sources list at a `# jen:sources` marker (that marker comes from the starters above). The insert is idempotent — running it again just reports "already present".

{% include terminal.html id="class" %}

### `class --moveOnly` {#class-moveonly}

A move-only RAII wrapper instead (Rule of Five): deleted copy, `noexcept` move via `release()`/`reset()`, `[[nodiscard]] get()`/`release()`, and an `explicit operator bool()`. Use it for C-APIs with a non-trivial destroy call (`raii` in my-cpp-snippets).

{% include terminal.html id="class_moveonly" %}

<div class="params-wrap" markdown="1">

| Param | Default | Description |
| --- | --- | --- |
| `name` | — | required; the class name |
| `namespace` | `''` | wraps the class in a namespace |
| `moveOnly` | `false` | scaffold a move-only RAII wrapper instead of a plain class |
| `resource` | `Resource*` | `--moveOnly` only: the handle's type |
| `nullValue` | `nullptr` | `--moveOnly` only: the value meaning "no resource" |
| `destroy` | `destroy` | `--moveOnly` only: the function that frees the resource |
{: .params}

</div>

### `cpp:handle` {#cpp-handle}

A generic, header-only `Handle<T, Deleter, Null>` template for non-pointer handles (`GLuint`, a file descriptor, …), constrained with `std::regular`/`std::invocable` (`raiit` in my-cpp-snippets).

{% include terminal.html id="handle" %}

### `cpp:scopeexit` {#cpp-scopeexit}

A header-only `ScopeExit` scope-guard template: runs a `noexcept`-checked callable on destruction unless `release()`d first (`scopeexit` in my-cpp-snippets).

{% include terminal.html id="scopeexit" %}

### `cpp:r0` {#cpp-r0}

A Rule of Zero class: no special member functions, one constructor generated from `--members`, private members set from the moved-from constructor params (`r0` in my-cpp-snippets).

{% include terminal.html id="r0" %}

<div class="params-wrap" markdown="1">

| Param | Default | Description |
| --- | --- | --- |
| `name` | — | required; the class name |
| `members` | — | required; comma-separated `Type name` pairs |
| `namespace` | `''` | wraps the class in a namespace |
{: .params}

</div>

## Shaders {#shaders}

### `cpp:shader` {#cpp-shader}

A GLSL vertex/fragment pair (or a single stage via `--stage=vert|frag`), embedded into a `<name>.<stage>.glsl.h` header at CMake-configure time by `cmake/embed-glsl.cmake` (added if missing). Wires `embed_glsl(...)` into `src/CMakeLists.txt` at a `# jen:shaders` marker — nothing jen writes needs regenerating when you edit the `.glsl` later, just re-run `cmake`.

{% include terminal.html id="shader" %}

Running it inside a fresh project (no `cmake/embed-glsl.cmake` yet) adds that helper too, instead of skipping it.

<div class="params-wrap" markdown="1">

| Param | Default | Description |
| --- | --- | --- |
| `name` | — | required; file names and embedded variable names |
| `stage` | `both` | `both`, `vert` or `frag` |
{: .params}

</div>

## Putting it together {#putting-it-together}

The starters set up the markers `class` and `cpp:shader` insert into, so a starter plus scaffolding is just a few commands:

{% include terminal.html id="together" %}
