/**
 * jen pack for C++: modern RAII scaffolding (following my-cpp-snippets:
 * https://github.com/learosema/my-cpp-snippets) plus SDL3 app starters
 * (following https://github.com/learosema/learn-sdl).
 *
 * Additions write where jen puts files: the current directory, or --dir.
 * `cpp:class` wires new sources into the nearest CMakeLists.txt with a `# jen:sources`
 * marker, and `cpp:shader` embeds an existing GLSL file at `# jen:embed` – both
 * markers come from the starters below.
 *
 *   jen cpp:class      --name=Foo [--moveOnly] […]        header/source class, plain or move-only RAII (Rule of Five)
 *   jen cpp:handle     --name=Handle                       generic Handle<T, Deleter, Null> template (header-only)
 *   jen cpp:scopeexit  --name=ScopeExit                     scope-guard template (header-only)
 *   jen cpp:r0         --name=Foo --members="T a, U b"      Rule of Zero class from ctor params
 *   jen cpp:shader     --file=shaders/tonemap.frag.glsl     embed an existing GLSL file via cmake/embed-glsl.cmake
 *   jen cpp:sdl3       --name=MyGame                        SDL3 callbacks app starter (vendored FetchContent SDL3)
 *   jen cpp:sdl3-opengl --name=MyGame                       SDL3 + OpenGL (glad) app starter with a shader-quad demo
 *
 * Also: cpp:interface, cpp:struct, cpp:strong, cpp:enum, cpp:pimpl, cpp:variant (types, all with --withTest);
 * cpp:tidy, cpp:format, cpp:presets, cpp:warnings, cpp:compiler, cpp:doctest (tooling); cpp:tracy (profiling);
 * cpp:cpack, cpp:icon (packaging); cpp:embed (resources); cpp:app, cpp:lib, cpp:module (starters).
 * The starters' markers are documented in starter.ts.
 */
import type { Pack } from '@codejen/jen';
import appGenerator from './app.ts';
import classGenerator from './class.ts';
import compilerGenerator from './compiler.ts';
import handleGenerator from './handle.ts';
import r0Generator from './r0.ts';
import scopeExitGenerator from './scopeexit.ts';
import sdl3Generator from './sdl3.ts';
import sdl3OpenglGenerator from './sdl3-opengl.ts';
import shaderGenerator from './shader.ts';
import interfaceGenerator from './interface.ts';
import structGenerator from './struct.ts';
import strongGenerator from './strong.ts';
import enumGenerator from './enum.ts';
import pimplGenerator from './pimpl.ts';
import variantGenerator from './variant.ts';
import tidyGenerator from './tidy.ts';
import formatGenerator from './format.ts';
import presetsGenerator from './presets.ts';
import warningsGenerator from './warnings.ts';
import doctestGenerator from './doctest.ts';
import tracyGenerator from './tracy.ts';
import cpackGenerator from './cpack.ts';
import embedGenerator from './embed.ts';
import iconGenerator from './icon.ts';
import libGenerator from './lib.ts';
import moduleGenerator from './module.ts';

const pack: Pack = {
  class: classGenerator,
  handle: handleGenerator,
  scopeexit: scopeExitGenerator,
  r0: r0Generator,
  shader: shaderGenerator,
  sdl3: sdl3Generator,
  'sdl3-opengl': sdl3OpenglGenerator,
  interface: interfaceGenerator,
  struct: structGenerator,
  strong: strongGenerator,
  enum: enumGenerator,
  pimpl: pimplGenerator,
  variant: variantGenerator,
  tidy: tidyGenerator,
  format: formatGenerator,
  presets: presetsGenerator,
  warnings: warningsGenerator,
  compiler: compilerGenerator,
  doctest: doctestGenerator,
  tracy: tracyGenerator,
  cpack: cpackGenerator,
  embed: embedGenerator,
  icon: iconGenerator,
  app: appGenerator,
  lib: libGenerator,
  module: moduleGenerator,
};

export default pack;
