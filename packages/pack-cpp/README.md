# @codejen/pack-cpp

A [jen](https://github.com/learosema/jen) pack for modern C++: app starters (SDL3, SDL3 + OpenGL, console, library, modules), RAII and type generators following the [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines), and tooling for tests, linting, profiling and packaging.

**Documentation: <https://learosema.github.io/jen/recipes.html>** – every generator with its params and the plan it prints.

## Install

```sh
npm install --save-dev @codejen/pack-cpp   # or: npm install -g @codejen/jen @codejen/pack-cpp
```

jen picks the pack up automatically; see jen's own README for how pack discovery works.

```sh
jen cpp:sdl3 --name=MyGame
cd my-game
jen cpp:doctest
jen cpp:class --name=Camera --withTest
```

## Where files go

Generators that scaffold a file (`cpp:class`, `cpp:struct`, `cpp:interface`, …) write into the current directory, or `--dir`. From `src/net/`, `jen cpp:class --name=Socket` writes `src/net/Socket.h` and wires `net/Socket.cpp` into the nearest `CMakeLists.txt` that carries the `# jen:sources` marker; `jen cpp:class --name=Socket --dir=src/net` does the same from the project root.

Wiring is looked up by marker, not guessed:

- **`--withTest`**: the test goes next to the header and is wired into the `CMakeLists.txt` that carries `# jen:tests`.
- **No marker**: without a `CMakeLists.txt` that carries it, the plan shows the insert as skipped. Add the marker and run the generator again – files that already exist are left alone.

Tooling generators (`cpp:warnings`, `cpp:tidy`, `cpp:doctest`, …) work on the project as a whole: their files (`cmake/…`, `.clang-tidy`, `tests/`) go to the project root, from wherever you are.

The starters (`cpp:app`, `cpp:lib`, `cpp:module`, `cpp:sdl3`, `cpp:sdl3-opengl`) create a new project folder in the current directory; `--dir` names it.

## License

ISC © Lea Rosema
