# @codejen/pack-cpp

A [jen](https://github.com/learosema/jen) pack for C++: class/shader scaffolding following [my-cpp-snippets](https://github.com/learosema/my-cpp-snippets)' RAII conventions, plus SDL3 app starters following [learn-sdl](https://github.com/learosema/learn-sdl).

Every generator except the app starters writes into `src/` of the current directory; the starters (`sdl3`, `sdl3-opengl`) create a new project folder named after the app (`MyGame` → `my-game/`, or `MyGame/` with `--folderCase=pascal`), so `cd` into it before running the other generators. `class` wires new sources into `src/CMakeLists.txt`'s sources list at a `# jen:sources` marker, and `cpp:shader` wires new shaders into that file's `embed_glsl()` calls at a `# jen:shaders` marker – both markers are set up by the `sdl3`/`sdl3-opengl` starters below, so scaffolding composes with them (see the walkthrough at the end).

| Generator          | Produces                                                                    |
| ------------------- | ---------------------------------------------------------------------------- |
| `class`            | plain class, or with `--moveOnly` a move-only RAII wrapper (Rule of Five); header + source |
| `cpp:handle`       | generic `Handle<T, Deleter, Null>` RAII template, header-only              |
| `cpp:scopeexit`    | `ScopeExit` scope-guard template, header-only                              |
| `cpp:r0`           | Rule of Zero class with members generated from constructor params, header-only |
| `cpp:shader`       | GLSL vertex/fragment shader pair (or one stage), embedded via `cmake/embed-glsl.cmake` |
| `cpp:sdl3`         | SDL3 callbacks app starter: CMakeLists.txt + vendored FetchContent SDL3 + src/main.cpp |
| `cpp:sdl3-opengl`  | SDL3 + OpenGL (4.1 core) app starter with a vendored [glad](https://glad.dav1d.de) loader and a shader-quad demo |

## Install

```sh
npm install --save-dev @codejen/pack-cpp
```

jen picks it up automatically once it's a dependency in your project's (or user directory's) `package.json` – see jen's own README for how pack discovery works.

## `class`

```sh
jen class --name=rigid_body
```

```
class (pack @codejen/pack-cpp) – create a C++ class in src/ (header + source), wired into src/CMakeLists.txt; --moveOnly for a Rule-of-Five RAII wrapper

  + src/RigidBody.h
  + src/RigidBody.cpp
  ~ src/CMakeLists.txt  + RigidBody.cpp

✓ 3 written
```

`src/RigidBody.h`:

```cpp
#ifndef RIGID_BODY_H
#define RIGID_BODY_H

class RigidBody {
 public:
  RigidBody();
  ~RigidBody();
};

#endif  // RIGID_BODY_H
```

The `src/CMakeLists.txt` update is an insert, not a rewrite: it only fires if that file already has a line containing `# jen:sources` (the app-starter generators below set this up), and it's idempotent – running the same generator again just reports "already present".

Pass `--namespace=<name>` to wrap the class in a namespace:

```sh
jen class --name=RigidBody --namespace=physics
```

Pass `--moveOnly` for a move-only RAII wrapper instead, following the Rule of Five: deleted copy, `noexcept` move via `release()`/`reset()`, `[[nodiscard]] get()`/`release()`, and an `explicit operator bool()`. Use it for C-APIs with a non-trivial destroy call (`raii` in my-cpp-snippets):

```sh
jen class --name=Texture --moveOnly --resource=GLuint --nullValue=0 --destroy=glDeleteTextures
```

### Params

| Param       | Default        | Description                                          |
| ----------- | -------------- | ----------------------------------------------------- |
| `name`      | —              | required; the class name                             |
| `namespace` | `''`           | wraps the class in a namespace                       |
| `moveOnly`  | `false`        | scaffold a move-only RAII wrapper instead of a plain class |
| `resource`  | `'Resource*'`  | (`--moveOnly` only) the handle's type                 |
| `nullValue` | `'nullptr'`    | (`--moveOnly` only) the value meaning "no resource"   |
| `destroy`   | `'destroy'`    | (`--moveOnly` only) the function called to free the resource |

## `cpp:handle`

A generic, header-only `Handle<T, Deleter, Null>` template for non-pointer handles (`GLuint`, a file descriptor, …), constrained with `std::regular`/`std::invocable` (`raiit` in my-cpp-snippets). Instantiate it with a lambda deleter at the use site, e.g. `using Program = Handle<GLuint, [](GLuint h) noexcept { glDeleteProgram(h); }>;`.

```sh
jen cpp:handle --name=Handle
```

### Params

| Param       | Default | Description                    |
| ----------- | ------- | ------------------------------ |
| `name`      | —       | required; the template's name  |
| `namespace` | `''`    | wraps the template in a namespace |

## `cpp:scopeexit`

A header-only `ScopeExit` scope-guard template: runs a `noexcept`-checked callable on destruction unless `release()`d first (`scopeexit` in my-cpp-snippets).

```sh
jen cpp:scopeexit --name=ScopeExit
```

### Params

| Param       | Default | Description                       |
| ----------- | ------- | ---------------------------------- |
| `name`      | —       | required; the class name           |
| `namespace` | `''`    | wraps the class in a namespace     |

## `cpp:r0`

A Rule of Zero class: no special member functions, one constructor generated from `--members`, private members set from the (moved-from) constructor params (`r0` in my-cpp-snippets).

```sh
jen cpp:r0 --name=Person --members="std::string name, int age"
```

### Params

| Param       | Default | Description                                         |
| ----------- | ------- | ---------------------------------------------------- |
| `name`      | —       | required; the class name                             |
| `members`   | —       | required; comma-separated `Type name` pairs          |
| `namespace` | `''`    | wraps the class in a namespace                       |

## `cpp:sdl3`

An SDL3 [callbacks](https://wiki.libsdl.org/SDL3/README/main-functions)-based app starter: a root `CMakeLists.txt`, a `vendor/CMakeLists.txt` that `FetchContent`s SDL3 (preferring a local `find_package(SDL3 CONFIG)` first, so it never touches the network if SDL3 is already installed), and `src/CMakeLists.txt` + `src/main.cpp` clearing the window to an animated color. Follows the pattern in [learn-sdl](https://github.com/learosema/learn-sdl).

Everything is written into a new folder named after the app: kebab-case by default (`my-game/`), PascalCase with `--folderCase=pascal` (`MyGame/`). Use `--dir=<folder>` to pick the folder yourself, or `--dir=.` to scaffold into the current directory (e.g. an existing repo).

```sh
jen cpp:sdl3 --name=MyGame   # creates ./my-game/
cd my-game
cmake -S . -B build && cmake --build build
```

### Params

| Param       | Default              | Description                              |
| ----------- | --------------------- | ----------------------------------------- |
| `name`      | —                     | required; used for the project/target name, window title, and (unless `--bundleId` is given) the app metadata id |
| `width`     | `'800'`               | initial window width                      |
| `height`    | `'600'`               | initial window height                     |
| `bundleId`  | `''`                  | app metadata id; defaults to `com.example.<kebab-name>` |
| `folderCase` | `'kebab'`            | case of the new project folder: `kebab` (`my-game/`) or `pascal` (`MyGame/`) |
| `dir`       | `''`                  | explicit folder instead of one derived from `name`; `--dir=.` writes into the current directory |
| `sdlTag`    | `'release-3.4.14'`    | the SDL3 git tag to fetch                 |

## `cpp:sdl3-opengl`

The same starter, but with an OpenGL 4.1 core context instead of the 2D renderer: it vendors a [glad](https://glad.dav1d.de) loader under `vendor/glad/` (checked-in generated source, like any hand-vendored GL loader – jen never fetches or generates it), adds `cmake/embed-glsl.cmake` (turns a `.glsl` file into an inline C string header at CMake configure time), and scaffolds an app class that compiles/links a shader pair and draws an animated full-screen quad. Same params as `cpp:sdl3`, including the new project folder (`--folderCase`, `--dir`).

```sh
jen cpp:sdl3-opengl --name=MyGame   # creates ./my-game/
cd my-game
cmake -S . -B build && cmake --build build
```

This sets up both markers `class` and `cpp:shader` look for, so scaffolding composes with the starter:

```sh
jen cpp:sdl3-opengl --name=MyGame
cd my-game
jen cpp:shader --name=Vignette   # adds src/vignette.{vert,frag}.glsl + wires embed_glsl() into src/CMakeLists.txt
jen class --name=Camera          # adds src/Camera.{h,cpp} + wires Camera.cpp into src/CMakeLists.txt
cmake -S . -B build && cmake --build build
```

## `cpp:shader`

A GLSL vertex/fragment shader pair (or a single stage via `--stage=vert|frag`), embedded into a `<name>.<stage>.glsl.h` header at CMake configure time by `cmake/embed-glsl.cmake` (added if missing) – no dependency on any file jen writes at generation time, so editing the `.glsl` later and re-running `cmake` is enough to pick it up. Wires `embed_glsl(...)` calls into `src/CMakeLists.txt` at a `# jen:shaders` marker.

```sh
jen cpp:shader --name=Tonemap
```

### Params

| Param    | Default  | Description                                |
| -------- | -------- | -------------------------------------------- |
| `name`   | —        | required; used for the file names and the embedded variable names |
| `stage`  | `'both'` | `'both'`, `'vert'` or `'frag'`               |

## License

ISC © Lea Rosema
