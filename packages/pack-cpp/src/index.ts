/**
 * jen pack for C++: modern RAII scaffolding (following my-cpp-snippets:
 * https://github.com/learosema/my-cpp-snippets) plus SDL3 app starters
 * (following https://github.com/learosema/learn-sdl).
 *
 * All generators write into `src/`. `class` wires new sources into
 * `src/CMakeLists.txt` at a `# jen:sources` marker, and `cpp:shader` wires
 * new shaders into the same file's `embed_glsl()` calls at a `# jen:shaders`
 * marker – both markers come from the `sdl3`/`sdl3-opengl` starters below.
 *
 *   jen class          --name=Foo [--moveOnly] […]        header/source class, plain or move-only RAII (Rule of Five)
 *   jen cpp:handle     --name=Handle                       generic Handle<T, Deleter, Null> template (header-only)
 *   jen cpp:scopeexit  --name=ScopeExit                     scope-guard template (header-only)
 *   jen cpp:r0         --name=Foo --members="T a, U b"      Rule of Zero class from ctor params
 *   jen cpp:shader     --name=Tonemap [--stage=vert|frag]   GLSL shader pair, embedded via cmake/embed-glsl.cmake
 *   jen cpp:sdl3       --name=MyGame                        SDL3 callbacks app starter (vendored FetchContent SDL3)
 *   jen cpp:sdl3-opengl --name=MyGame                       SDL3 + OpenGL (glad) app starter with a shader-quad demo
 */
import type { Pack } from '@codejen/jen';
import classGenerator from './class.ts';
import handleGenerator from './handle.ts';
import r0Generator from './r0.ts';
import scopeExitGenerator from './scopeexit.ts';
import sdl3Generator from './sdl3.ts';
import sdl3OpenglGenerator from './sdl3-opengl.ts';
import shaderGenerator from './shader.ts';

const pack: Pack = {
  class: classGenerator,
  handle: handleGenerator,
  scopeexit: scopeExitGenerator,
  r0: r0Generator,
  shader: shaderGenerator,
  sdl3: sdl3Generator,
  'sdl3-opengl': sdl3OpenglGenerator,
};

export default pack;
