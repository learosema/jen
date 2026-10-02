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
jen class --name=Camera --withTest
```

## License

ISC © Lea Rosema
