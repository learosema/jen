---
layout: doc
permalink: /glsl.html
title: jen — glsl pack recipes
description: "Every jen command in @codejen/pack-glsl: shader starters, a WebGL playground, noise, signed distance fields, raymarching, lighting and vertex displacement – with live previews."
eyebrow: "@codejen/pack-glsl"
mega: shaders
lede: Every generator, with the command, the output it prints, and the shader it makes – running live.
sub: GLSL for WebGL2 and OpenGL. MIT-0.
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

It writes plain text: nothing to build or link.

### Globally {#install-global}

{% include terminal.html id="glsl_install_global" %}

### Locally {#install-local}

{% include terminal.html id="glsl_install_local" %}

### Not at all {#install-npx}

Any `glsl:` generator without the pack fetches it for one run (`JEN_NO_FETCH=1` turns that off).

{% include terminal.html id="glsl_install_npx" %}

## Where files go {#where}

Into the current folder, or `--dir`: `glsl:frag --name=Clouds --dir=shaders` writes `shaders/clouds.frag.glsl`. `--into` and `--file` are relative to where you are. `glsl:webgl` makes a new project folder.

## Starters {#starters}

GLSL ES 3.00 (WebGL2) by default; `--version=410` or [`glsl:port`](#glsl-port) for desktop. The uniforms `uTime`, `uResolution` and `uMouse` work in both `<shader-canvas>` and `cpp:sdl3-opengl`.

### `glsl:webgl` {#glsl-webgl}

A no-build playground: `index.html` and a [`<shader-canvas>`](https://github.com/learosema/jen/tree/main/packages/pack-glsl/web/shader-canvas) that recompiles on save – like every preview here.

{% include terminal.html id="glsl_webgl" %}

<div class="auto-grid shaders wide">
{% include shader.html src="starter.frag.glsl" caption="<code>shaders/clouds.frag.glsl</code>, as generated" %}
</div>

{% include params.html generator="glsl:webgl" %}

### `glsl:frag` {#glsl-frag}

A full-screen fragment shader with centered, aspect-correct coordinates.

{% include terminal.html id="glsl_frag" %}

{% include params.html generator="glsl:frag" %}

### `glsl:vert` {#glsl-vert}

A vertex shader: `--kind=quad` (as in `cpp:sdl3-opengl`), `triangle` (no buffer), or `mesh` with model/view/projection.

{% include terminal.html id="glsl_vert" %}

{% include params.html generator="glsl:vert" %}

### `glsl:port` {#glsl-port}

Rewrites a shader's `#version` and precisions, from WebGL to desktop and back. To embed it in C++, use [`cpp:shader`]({{ '/recipes.html#cpp-shader' | relative_url }}).

{% include terminal.html id="glsl_port" %}

{% include params.html generator="glsl:port" %}

## Functions {#functions}

### How they get into your shader {#into}

GLSL has no `#include`. `--into=<shader>` inserts the functions you pick, plus dependencies, above `// jen:functions` (added before your first function). Nothing is duplicated.

Without `--into`, each function gets its own file in `lib/`, for vite-plugin-glsl, glslify or three.js. `--name` writes a preview shader.

### `glsl:noise` {#glsl-noise}

Value, Perlin, simplex and Worley noise; fBm, turbulence, ridged and warped fractals; curl noise. 2D and 3D, each with a `period` overload that **tiles seamlessly** – the previews are tiled 2×2.

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

Fractals are named by base (`simplexFbm`, `perlinFbm`) and take a `gain`; warp takes a `strength`.

{% include params.html generator="glsl:noise" %}

### `glsl:sdf` {#glsl-sdf}

Signed distance shapes, operators, and 2D effects. Pick with `--shapes`, `--ops` and `--effects`, or `all`.

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

{% include params.html generator="glsl:sdf" %}

### `glsl:raymarch` {#glsl-raymarch}

A raymarcher: `scene()`, orbiting camera, soft shadows, AO and fog, lit by [`glsl:lighting`](#glsl-lighting). `--materials` adds material ids, `--minimal` drops the extras. `--into` gives just the helpers for your own `scene()`.

{% include terminal.html id="glsl_raymarch" %}

<div class="auto-grid shaders">
{% include shader.html src="raymarch-lambert.frag.glsl" caption="<code>--lighting=lambert</code>" %}
{% include shader.html src="raymarch-toon.frag.glsl" caption="<code>--lighting=toon</code>" %}
{% include shader.html src="raymarch-materials.frag.glsl" caption="<code>--lighting=pbr --materials</code>" %}
</div>

{% include params.html generator="glsl:raymarch" %}

### `glsl:lighting` {#glsl-lighting}

Interchangeable shading models: `lambert`, `blinnPhong`, `toon` and `pbr` (Cook-Torrance, metallic/roughness). Plus ACES and Reinhard tonemapping and sRGB.

{% include terminal.html id="glsl_lighting" %}

{% include params.html generator="glsl:lighting" %}

### `glsl:displace` {#glsl-displace}

Vertex displacement with correct normals: `displace()` by your `displacement(p)`, or `gerstnerWave()` oceans. Drag the previews to turn them.

{% include terminal.html id="glsl_displace" %}

<div class="auto-grid shaders wide">
{% include shader.html src="displace-noise.frag.glsl" vert="displace-noise.vert.glsl" mesh="sphere" detail="96" caption="<code>--kind=noise</code> on <code>mesh=&quot;sphere&quot;</code>" %}
{% include shader.html src="displace-waves.frag.glsl" vert="displace-waves.vert.glsl" mesh="plane" detail="128" caption="<code>--kind=waves</code> on <code>mesh=&quot;plane&quot;</code>" %}
</div>

{% include params.html generator="glsl:displace" %}

### `glsl:matrix` {#glsl-matrix}

OpenGL-style matrices: `rotateX/Y/Z`, `rotateAxis`, `perspective`, `lookAt`, `translate`, `scale`, `transform`.

{% include terminal.html id="glsl_matrix" %}

{% include params.html generator="glsl:matrix" %}

### `glsl:util` {#glsl-util}

`PI`/`TAU`, `rot2`, `remap`, `saturate` and integer hashes.

{% include terminal.html id="glsl_util" %}

{% include params.html generator="glsl:util" %}

## Licenses and credits {#credits}

The pack's own code is [MIT-0](https://github.com/learosema/jen/blob/main/packages/pack-glsl/LICENSE). Others' code is MIT and inserted with its notice.

- **[webgl-noise](https://github.com/stegu/webgl-noise)** by Stefan Gustavson and Ashima Arts, MIT: classic Perlin noise.
- **[psrdnoise](https://github.com/stegu/psrdnoise)** by Stefan Gustavson and Ian McEwan, MIT: tiling simplex noise and its gradients, behind `simplexNoise` and `curlNoise`.
- **[BakingLab](https://github.com/TheRealMJP/BakingLab)** by MJP and David Neubelt, MIT: Stephen Hill's ACES fit, `tonemapAces`.
- **[hash-prospector](https://github.com/skeeto/hash-prospector)** by Chris Wellons, public domain: the `lowbias32` hash constants.
- **Formulas** from Inigo Quilez's articles on [distance functions](https://iquilezles.org/articles/distfunctions/), [smooth minimum](https://iquilezles.org/articles/smin/), [normals](https://iquilezles.org/articles/normalsSDF/) and [soft shadows](https://iquilezles.org/articles/rmshadows/); Brian Karis's "Real Shading in Unreal Engine 4"; Duff et al.'s orthonormal basis (JCGT 2017); Mark Finch's Gerstner waves (GPU Gems).

The full notices: [THIRD_PARTY_NOTICES.md](https://github.com/learosema/jen/blob/main/packages/pack-glsl/THIRD_PARTY_NOTICES.md).

<script src="{{ '/glsl/shader-canvas.js' | relative_url }}" defer></script>
