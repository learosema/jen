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

## WebGL playground

```sh
jen glsl:webgl --name=Clouds            # index.html, shader-canvas.js, shaders/clouds.frag.glsl
jen glsl:webgl --name=Clouds --inline   # shader inside index.html – opens straight from disk
```

`<shader-canvas>` is a single dependency-free script. It feeds `uTime`, `uResolution` and `uMouse`, shows compile errors with the original line numbers over the canvas, and with `live` recompiles whenever the shader file changes (fetching files needs any static server, e.g. `npx serve`). It also draws `mesh="plane|sphere"` with a custom `vert` shader (drag with `orbit`), binds `texture0`…`texture3` to `uTexture0`…`uTexture3`, pauses offscreen and respects `prefers-reduced-motion`. Desktop shaders (`#version 410 core`) run unchanged, so the same file works in the browser and in `cpp:sdl3-opengl`. See [its README](web/shader-canvas/README.md) for all attributes, uniforms and events.

## Noise

```sh
jen glsl:noise --kind=fbm --into=shaders/clouds.frag.glsl                  # simplexFbm(p, octaves[, gain])
jen glsl:noise --kind=worley --dim=3 --into=shaders/cells.frag.glsl        # worleyNoise(vec3), worley(vec3) → F1, F2
jen glsl:noise --kind=warp --name=Marble --tile                             # preview shader, drawn 2×2 to show the seams
```

- **Base noises** (`--kind=value|perlin|simplex|worley`): `<kind>Noise(p)`, about [-1, 1]. Worley also has `worley(p)`, the distances to the nearest two feature points.
- **Fractals** (`--kind=fbm|turbulence|ridged|warp`): `<base>Fbm(p, octaves)` and friends, on any base noise via `--base` (default `simplex`). An optional `gain` (default 0.5) sets the roughness; warp takes a `strength` (default 2.0) instead. Different bases can share a shader: `perlinFbm` and `simplexFbm` don't clash.
- **Flow** (`--kind=curl`): `curlNoise(p, alpha)`, a divergence-free vector field for particles; animate `alpha` for swirling motion.

Everything comes in 2D and 3D (`--dim=2|3`), and every function has an overload with a `period` that tiles seamlessly, e.g. `simplexFbm(p, vec2(4.0), 6)`. It's the same trick as SVG feTurbulence's `stitchTiles`, but for any noise: each octave doubles the period along with the frequency. Periods are positive whole numbers; 2D simplex wants an even period along y, and 3D simplex periods are limited to 289.

## Signed distance fields and raymarching

```sh
jen glsl:raymarch --name=Scene                     # starter: scene(), orbiting camera, soft shadows, AO, fog
jen glsl:raymarch --name=Scene --minimal           # just march, normal and diffuse light
jen glsl:raymarch --name=Scene --materials         # sceneMaterial() also returns a material id per surface
jen glsl:sdf --dim=3 --shapes=box,torus --ops=smooth-union --into=shaders/scene.frag.glsl
jen glsl:sdf --shapes=star --effects=fill,stroke,glow --into=shaders/logo.frag.glsl
jen glsl:sdf --dim=3 --shapes=all --name=Shapes    # preview: every shape side by side
```

- **Shapes** (`--shapes`, previewed in the order given): 2D `circle`, `box`, `round-box`, `segment`, `polygon`, `star`; 3D `sphere`, `box`, `round-box`, `torus`, `capsule`, `cylinder`, `plane`. Named `sdCircle`, `sdBox`, … with overloads for 2D and 3D.
- **Operators** (`--ops`): `union`, `subtract`, `intersect` and their `smooth-` variants, `round`, `onion`, `repeat`, `repeat-limited`, and `extrude`/`revolve` to turn 2D shapes into 3D ones.
- **2D effects** (`--effects`): antialiased `fill` and `stroke`, `glow`, drop `shadow`, `inner-shadow` – masks in [0, 1] from a distance.
- **Raymarching helpers** (`glsl:raymarch --into`, pick with `--parts`): `raymarch`, `calcNormal`, `softShadow`, `calcAO`, `cameraMatrix`. They call your `float scene(vec3 p)`, which they declare up front, so it can live anywhere in the shader. For materials, keep that function returning the distance and look the material up once at the hit point, as the `--materials` starter does: `vec2 sceneMaterial(vec3 p)` returns distance and id, `scene()` returns its `.x`.

Each list also takes `all`. The formulas follow Inigo Quilez's articles on [distance functions](https://iquilezles.org/articles/distfunctions/), [2D distance functions](https://iquilezles.org/articles/distfunctions2d/), [smooth minimum](https://iquilezles.org/articles/smin/), [SDF normals](https://iquilezles.org/articles/normalsSDF/) and [soft shadows](https://iquilezles.org/articles/rmshadows/), credited in each function. The code itself is the pack's own (MIT-0).

## How functions get into your shader

GLSL has no `#include`, so functions ship as plain `.glsl` files under `glsl/`. With `--into=<shader>`, jen inserts the ones you pick – plus whatever they depend on – above a `// jen:functions` marker line. If your shader has none yet, the marker is added before its first function, so the inserted functions come before your own code that calls them (a raymarched `scene()`, say). Later runs add below what's already there. Anything already in the file is skipped, so running a generator twice, or two generators sharing a helper, never duplicates code. Without `--into`, each function is written as its own file under `<dir>/lib/` (default `shaders/lib/`) for setups with an include mechanism (vite-plugin-glsl, glslify, three.js, …).

Inserted code is matched by its exact text: if you edit an inserted function and run a generator needing it again, it gets inserted a second time.

`--into` needs jen 1.2 or newer (for inserting before the first function).

## Licenses

The pack's own code – starters and functions – is [MIT No Attribution](LICENSE) (MIT-0): do whatever you want with it, no notice required. (Not the Unlicense or CC0: German copyright law can't release code into the public domain, but it can grant every right unconditionally.)

Functions by other authors are included only under the MIT license, which does require their notice: when jen inserts such a function, the author's full notice goes into your shader with it, once per shader. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for all authors and sources.

## License

MIT-0 © Lea Rosema; third-party functions MIT © their authors
