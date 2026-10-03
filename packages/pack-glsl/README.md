# @codejen/pack-glsl

A [jen](https://github.com/learosema/jen) pack for GLSL: fragment and vertex shader starters, plus functions you can drop into any shader. WebGL2's GLSL ES 3.00 is the default; everything also compiles as desktop GLSL 3.30 / 4.10 core, and `glsl:port` switches a shader's header when you move a prototype from the browser to C++/OpenGL.

**Documentation: <https://learosema.github.io/jen/recipes.html>**

## Install

```sh
npm install --save-dev @codejen/pack-glsl   # or: npm install -g @codejen/jen @codejen/pack-glsl
```

```sh
jen glsl:frag --name=Clouds                                    # shaders/clouds.frag.glsl
jen glsl:util --fns=rot2,remap --into=shaders/clouds.frag.glsl # insert helpers before main()
jen glsl:port --file=shaders/clouds.frag.glsl --to=410         # ready for cpp:sdl3-opengl
```

## How functions get into your shader

GLSL has no `#include`, so functions ship as plain `.glsl` files under `glsl/`. With `--into=<shader>`, jen inserts the ones you pick – plus whatever they depend on – right above `void main(`. Anything already in the file is skipped, so running a generator twice, or two generators sharing a helper, never duplicates code. Without `--into`, each function is written as its own file under `<dir>/lib/` (default `shaders/lib/`) for setups with an include mechanism (vite-plugin-glsl, glslify, three.js, …).

Inserted code is matched by its exact text: if you edit an inserted function and run a generator needing it again, it gets inserted a second time.

## Licenses

The pack's own code – starters and functions – is [MIT No Attribution](LICENSE) (MIT-0): do whatever you want with it, no notice required. (Not the Unlicense or CC0: German copyright law can't release code into the public domain, but it can grant every right unconditionally.)

Functions by other authors are included only under the MIT license, which does require their notice: when jen inserts such a function, the author's full notice goes into your shader with it, once per shader. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for all authors and sources.

## License

MIT-0 © Lea Rosema; third-party functions MIT © their authors
