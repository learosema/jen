---
layout: doc
permalink: /glsl.html
title: jen — glsl pack recipes
description: "Every jen command in @codejen/pack-glsl: shader starters, a WebGL playground, noise, signed distance fields, raymarching, lighting and vertex displacement – with live previews."
eyebrow: "@codejen/pack-glsl"
mega: shaders
lede: Every generator, with the command, the output it prints, and the shader it makes – running live.
sub: GLSL starters and functions for WebGL2 and OpenGL. MIT-0, attributed where it's someone else's.
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
  - title: Starters
    links:
      - { title: "glsl:webgl", id: glsl-webgl }
      - { title: "glsl:frag", id: glsl-frag }
      - { title: "glsl:vert", id: glsl-vert }
      - { title: "glsl:port", id: glsl-port }
  - title: Functions
    links:
      - { title: How they get in, id: into }
      - { title: "glsl:noise", id: glsl-noise }
      - { title: "glsl:sdf", id: glsl-sdf }
      - { title: "glsl:raymarch", id: glsl-raymarch }
      - { title: "glsl:lighting", id: glsl-lighting }
      - { title: "glsl:displace", id: glsl-displace }
      - { title: "glsl:matrix", id: glsl-matrix }
      - { title: "glsl:util", id: glsl-util }
  - title: Finally
    links:
      - { title: Licenses and credits, id: credits }
---

## Install {#install}

Same three ways as every jen pack. The pack only writes text files: no build step, no runtime, nothing to link.

### Globally {#install-global}

{% include terminal.html id="glsl_install_global" %}

### Locally {#install-local}

{% include terminal.html id="glsl_install_local" %}

### Not at all {#install-npx}

Ask for a `glsl:` generator without the pack installed and jen fetches `@codejen/pack-glsl` into a throwaway directory, runs it once and removes it again (first-party `@codejen` scope only; `JEN_NO_FETCH=1` turns it off).

{% include terminal.html id="glsl_install_npx" %}

## Where files go {#where}

Generators write into the folder you run them in, or `--dir`: from the project root, `glsl:frag --name=Clouds --dir=shaders` writes `shaders/clouds.frag.glsl`. `--into` and `--file` are relative to the current directory. `glsl:webgl` makes a new project folder in the current directory instead, with the shader in `shaders/` inside it (`--shaderDir` renames that). The [home page]({{ '/#where' | relative_url }}) has the general rules.

## Starters {#starters}

Shaders default to WebGL2's GLSL ES 3.00, so you can prototype in the browser first. Everything compiles as desktop GLSL 3.30 and 4.10 core too: pass `--version=410`, or switch an existing shader with [`glsl:port`](#glsl-port). The starters use the uniforms every jen host feeds – `uTime`, `uResolution`, `uMouse` – so the same file runs in `<shader-canvas>` and in `cpp:sdl3-opengl`.

### `glsl:webgl` {#glsl-webgl}

A playground without a build step: an `index.html`, the [`<shader-canvas>`](https://github.com/learosema/jen/tree/main/packages/pack-glsl/web/shader-canvas) element and a fragment shader it draws full-screen, recompiling whenever you save. Every preview on this page is a `<shader-canvas>`.

{% include terminal.html id="glsl_webgl" %}

<div class="auto-grid shaders wide">
{% include shader.html src="starter.frag.glsl" caption="<code>shaders/clouds.frag.glsl</code>, as generated" %}
</div>

{% capture rows %}
`name` | — | required; the shader's name (`Clouds` becomes `shaders/clouds.frag.glsl`)
`inline` | `false` | put the shader into the page instead, so it opens straight from disk without a server
`tag` | `shader-canvas` | another element name, if `shader-canvas` collides with something
`dir` | `.` | the new project folder, inside the current directory
`shaderDir` | `shaders` | the shader's folder inside it
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `glsl:frag` {#glsl-frag}

A full-screen fragment shader: centered, aspect-correct coordinates from `gl_FragCoord`, and the jen uniforms.

{% include terminal.html id="glsl_frag" %}

### `glsl:vert` {#glsl-vert}

A vertex shader: `--kind=quad` (default) takes a full-screen quad at attribute location 0 like `cpp:sdl3-opengl`, `triangle` covers the screen from `gl_VertexID` without any buffer, and `mesh` has position, normal and UV attributes with `uModel`/`uView`/`uProjection`.

{% include terminal.html id="glsl_vert" %}

{% capture rows %}
`name` | — | required
`kind` | `quad` | `vert` only: `quad`, `triangle` or `mesh`
`version` | `300es` | `300es`, `330` or `410`
`dir` | — | where the shader goes, relative to the current directory; else the current directory
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `glsl:port` {#glsl-port}

Switches a shader between dialects by rewriting only its header: the `#version` line and the default precisions. For moving a WebGL prototype into `cpp:sdl3-opengl`, and back. To compile such a shader into a C++ build, `cpp:shader --file=shaders/clouds.frag.glsl` from the [cpp pack]({{ '/recipes.html#cpp-shader' | relative_url }}) embeds it as a C string.

{% include terminal.html id="glsl_port" %}

## Functions {#functions}

### How they get into your shader {#into}

GLSL has no `#include`, so the pack ships its functions as plain, attributed `.glsl` files. With `--into=<shader>`, jen inserts the ones you pick, plus everything they need, above a `// jen:functions` marker. If the shader has none yet, the marker goes in before its first function, so your own code below can call them. Anything already in the file is skipped: run a generator twice, or two generators sharing a helper, and nothing is duplicated.

Without `--into`, every function becomes its own file under `lib/` where the files go (`shaders/lib/` with `--dir=shaders`), for setups with an include mechanism (vite-plugin-glsl, glslify, three.js). Most generators also take `--name` for a ready-to-run preview shader.

### `glsl:noise` {#glsl-noise}

Value, Perlin, simplex and Worley noise; fBm, turbulence, ridged and domain-warped fractals on any of them; curl noise for flow fields. In 2D and 3D, and every function has a `period` overload that **tiles seamlessly** – SVG feTurbulence's `stitchTiles`, for any noise. The previews below are tiled 2×2: a seam would show as a cross in the middle.

{% include terminal.html id="glsl_noise" %}

<div class="auto-grid shaders">
{% include shader.html src="noise-value.frag.glsl" caption="<code>--kind=value</code>" %}
{% include shader.html src="noise-perlin.frag.glsl" caption="<code>--kind=perlin</code>" %}
{% include shader.html src="noise-simplex.frag.glsl" caption="<code>--kind=simplex</code>" %}
{% include shader.html src="noise-worley.frag.glsl" caption="<code>--kind=worley</code>" %}
{% include shader.html src="noise-fbm.frag.glsl" caption="<code>--kind=fbm</code>" %}
{% include shader.html src="noise-turbulence.frag.glsl" caption="<code>--kind=turbulence</code>" %}
{% include shader.html src="noise-ridged.frag.glsl" caption="<code>--kind=ridged</code>" %}
{% include shader.html src="noise-warp.frag.glsl" caption="<code>--kind=warp</code>" %}
{% include shader.html src="noise-curl.frag.glsl" caption="<code>--kind=curl</code>: flow direction as color" %}
</div>

{% include terminal.html id="glsl_noise_tile" %}

Fractals are written once and renamed for the base you pick – `simplexFbm`, `perlinFbm` – so several can share a shader. They take an optional `gain` for roughness; warp takes a `strength` instead.

{% capture rows %}
`kind` | — | required: `value`, `perlin`, `simplex`, `worley`, `fbm`, `turbulence`, `ridged`, `warp` or `curl`
`base` | `simplex` | the noise under a fractal
`dim` | `2` | `2` or `3`
`tile` | `false` | `--name` only: draw the period 2×2
`into` | — | the shader to insert into, relative to the current directory; else files in `lib/` next to where the shaders go
`name` | — | instead: a preview shader
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

### `glsl:sdf` {#glsl-sdf}

Signed distance functions: shapes, operators to combine them, and – in 2D – antialiased masks for fill, stroke, glow and shadows. Pick with `--shapes`, `--ops` and `--effects`, each also takes `all`.

{% include terminal.html id="glsl_sdf" %}

<div class="auto-grid shaders wide">
{% include shader.html src="sdf-2d.frag.glsl" caption="<code>--shapes=all --name=…</code>: circle, box, round-box, segment, polygon, star" %}
{% include shader.html src="sdf-3d.frag.glsl" caption="<code>--dim=3 --shapes=all --name=…</code>: sphere, box, round-box, torus, capsule, cylinder" %}
</div>

{% capture rows %}
`shapes` | 2D | `circle`, `box`, `round-box`, `segment`, `polygon`, `star`
`shapes` | 3D | `sphere`, `box`, `round-box`, `torus`, `capsule`, `cylinder`, `plane`
`ops` | 2D + 3D | `union`, `subtract`, `intersect`, their `smooth-` variants, `round`, `onion`, `repeat`, `repeat-limited`, `extrude`, `revolve`
`effects` | 2D | `fill`, `stroke`, `glow`, `shadow`, `inner-shadow`
{% endcapture %}
{% include cards.html rows=rows label="—" icon="list" heading="What to pick" %}

### `glsl:raymarch` {#glsl-raymarch}

A raymarching starter: a `scene()` distance function, an orbiting camera, soft shadows, ambient occlusion and fog, lit with any model from [`glsl:lighting`](#glsl-lighting). `--materials` gives every surface a material id; `--minimal` leaves out shadows, AO and fog. With `--into`, you get just the helpers – `raymarch`, `calcNormal`, `softShadow`, `calcAO`, `cameraMatrix` – for your own `float scene(vec3 p)`.

{% include terminal.html id="glsl_raymarch" %}

<div class="auto-grid shaders">
{% include shader.html src="raymarch-lambert.frag.glsl" caption="<code>--lighting=lambert</code>" %}
{% include shader.html src="raymarch-toon.frag.glsl" caption="<code>--lighting=toon</code>" %}
{% include shader.html src="raymarch-materials.frag.glsl" caption="<code>--lighting=pbr --materials</code>" %}
</div>

### `glsl:lighting` {#glsl-lighting}

Shading models with one signature – normal, view and light direction, then the material – so you can swap them: `lambert`, `blinnPhong`, `toon` with a rim light, and `pbr` (Cook-Torrance: GGX, Smith-Schlick, Schlick Fresnel, metallic/roughness) with an ambient light that needs no environment map. Plus color output: ACES and Reinhard tonemapping, and the exact sRGB curve.

{% include terminal.html id="glsl_lighting" %}

### `glsl:displace` {#glsl-displace}

Moves surfaces in the vertex shader and keeps the normals right, so the lighting follows: `displace()` pushes vertices along their normal by your `displacement(p)`, `gerstnerWave()` sums up ocean waves with exact normals. `--name` writes a vertex/fragment pair for `<shader-canvas mesh="sphere">` – drag the previews to turn them.

{% include terminal.html id="glsl_displace" %}

<div class="auto-grid shaders wide">
{% include shader.html src="displace-noise.frag.glsl" vert="displace-noise.vert.glsl" mesh="sphere" detail="96" caption="<code>--kind=noise</code> on <code>mesh=&quot;sphere&quot;</code>" %}
{% include shader.html src="displace-waves.frag.glsl" vert="displace-waves.vert.glsl" mesh="plane" detail="128" caption="<code>--kind=waves</code> on <code>mesh=&quot;plane&quot;</code>" %}
</div>

### `glsl:matrix` {#glsl-matrix}

Matrices for GPU-side transforms, following OpenGL conventions: `rotateX/Y/Z` and `rotateAxis`, `perspective`, `lookAt`, `translate`, `scale`, and `transform` to lift a `mat3` into a `mat4`.

{% include terminal.html id="glsl_matrix" %}

### `glsl:util` {#glsl-util}

Small helpers the other functions build on: `PI`/`TAU`, `rot2`, `remap`, `saturate`, and integer hashes for lattice cells.

{% include terminal.html id="glsl_util" %}

## Licenses and credits {#credits}

The pack's own code is [MIT-0](https://github.com/learosema/jen/blob/main/packages/pack-glsl/LICENSE): use it however you like, no attribution required. Code by others is only included under the MIT license, and when jen inserts it into your shader, the author's notice goes in with it – once per shader. Formulas the pack reimplements are credited in each function.

- **[webgl-noise](https://github.com/stegu/webgl-noise)** by Stefan Gustavson and Ashima Arts, MIT: classic Perlin noise.
- **[psrdnoise](https://github.com/stegu/psrdnoise)** by Stefan Gustavson and Ian McEwan, MIT: tiling simplex noise and its gradients, behind `simplexNoise` and `curlNoise`.
- **[BakingLab](https://github.com/TheRealMJP/BakingLab)** by MJP and David Neubelt, MIT: Stephen Hill's ACES fit, `tonemapAces`.
- **[hash-prospector](https://github.com/skeeto/hash-prospector)** by Chris Wellons, public domain: the `lowbias32` hash constants.
- **Formulas** from Inigo Quilez's articles on [distance functions](https://iquilezles.org/articles/distfunctions/), [smooth minimum](https://iquilezles.org/articles/smin/), [normals](https://iquilezles.org/articles/normalsSDF/) and [soft shadows](https://iquilezles.org/articles/rmshadows/); Brian Karis's "Real Shading in Unreal Engine 4"; Duff et al.'s orthonormal basis (JCGT 2017); Mark Finch's Gerstner waves (GPU Gems).

The full notices: [THIRD_PARTY_NOTICES.md](https://github.com/learosema/jen/blob/main/packages/pack-glsl/THIRD_PARTY_NOTICES.md).

<script src="{{ '/glsl/shader-canvas.js' | relative_url }}" defer></script>
