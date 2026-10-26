---
layout: doc
permalink: /glsl.html
title: jen — glsl pack recipes
description: "Every jen command in @codejen/pack-glsl: shader starters, a WebGL playground, noise, signed distance fields, raymarching, lighting and vertex displacement – with live previews."
eyebrow: "@codejen/pack-glsl"
mega: shaders
lede: Every generator, with the command, the output it prints, and the shader it makes – running live.
sub: GLSL for WebGL2 and OpenGL. MIT-0 and MIT.
cta: { text: "Three ways to install ↓", url: "#install" }
toc:
  - title: Install
    links:
      - { title: Globally, id: install-global }
      - { title: Locally, id: install-local }
      - { title: Not at all, id: install-npx }
  - title: Where files go
    links:
      - { title: Project root, id: where }
  - title: Starters
    links:
      - { title: "glsl:webgl", id: glsl-webgl }
      - { title: "glsl:frag", id: glsl-frag }
      - { title: "glsl:vert", id: glsl-vert }
      - { title: "glsl:port", id: glsl-port }
  - title: Functions
    links:
      - { title: Including, id: into }
      - { title: "glsl:noise", id: glsl-noise }
      - { title: "glsl:sdf", id: glsl-sdf }
      - { title: "glsl:raymarch", id: glsl-raymarch }
      - { title: "glsl:lighting", id: glsl-lighting }
      - { title: "glsl:displace", id: glsl-displace }
      - { title: "glsl:matrix", id: glsl-matrix }
      - { title: "glsl:util", id: glsl-util }
  - title: Finally
    links:
      - { title: Credits, id: credits }
---

## Install {#install}

### Globally {#install-global}

{% include terminal.html id="glsl_install_global" %}

### Locally {#install-local}

{% include terminal.html id="glsl_install_local" %}

### Not at all {#install-npx}

{% include terminal.html id="glsl_install_npx" %}

## Where files go {#where}

Into the current folder, or `--dir`.

## Starters {#starters}

WebGL2 by default, `--version=410` for desktop. Uniforms: `uTime`, `uResolution`, `uMouse`.

### `glsl:webgl` {#glsl-webgl}

A no-build playground with [`<shader-canvas>`](https://github.com/learosema/jen/tree/main/packages/pack-glsl/web/shader-canvas).

{% include terminal.html id="glsl_webgl" %}

<div class="auto-grid shaders wide">
{% include shader.html src="starter.frag.glsl" caption="<code>shaders/clouds.frag.glsl</code>, as generated" %}
</div>

{% include params.html generator="glsl:webgl" %}

### `glsl:frag` {#glsl-frag}

{% include terminal.html id="glsl_frag" %}

{% include params.html generator="glsl:frag" %}

### `glsl:vert` {#glsl-vert}

{% include terminal.html id="glsl_vert" %}

{% include params.html generator="glsl:vert" %}

### `glsl:port` {#glsl-port}

WebGL ↔ desktop.

{% include terminal.html id="glsl_port" %}

{% include params.html generator="glsl:port" %}

## Functions {#functions}

### How they get into your shader {#into}

`--into=<shader>` inserts the functions and their dependencies, once each – also into an `--inline` page; without it, one file each in `lib/`.

{% include terminal.html id="glsl_into_page" %}

### `glsl:noise` {#glsl-noise}

Every noise tiles with its `period` overload.

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

{% include usage.html generator="glsl:noise" %}

{% include params.html generator="glsl:noise" %}

### `glsl:sdf` {#glsl-sdf}

{% include terminal.html id="glsl_sdf" %}

<div class="auto-grid shaders wide">
{% include shader.html src="sdf-2d.frag.glsl" caption="<code>--shapes=all --name=…</code>: circle, box, round-box, segment, polygon, star, vesica, arch" %}
{% include shader.html src="sdf-3d.frag.glsl" caption="<code>--dim=3 --shapes=all --name=…</code>: sphere, box, round-box, torus, capsule, cylinder" %}
</div>

{% capture rows %}
`shapes` | 2D | `circle`, `box`, `round-box`, `segment`, `polygon`, `star`, `vesica`, `arch`
`shapes` | 3D | `sphere`, `box`, `round-box`, `torus`, `capsule`, `cylinder`, `plane`
`ops` | 2D + 3D | `union`, `subtract`, `intersect`, their `smooth-` variants, `round`, `onion`, `repeat`, `repeat-limited`, `extrude`, `revolve`
`effects` | 2D | `fill`, `stroke`, `glow`, `shadow`, `inner-shadow`
{% endcapture %}
{% include cards.html rows=rows label="—" icon="list" heading="What to pick" %}

{% include params.html generator="glsl:sdf" %}

### `glsl:raymarch` {#glsl-raymarch}

{% include terminal.html id="glsl_raymarch" %}

<div class="auto-grid shaders">
{% include shader.html src="raymarch-lambert.frag.glsl" caption="<code>--lighting=lambert</code>" %}
{% include shader.html src="raymarch-toon.frag.glsl" caption="<code>--lighting=toon</code>" %}
{% include shader.html src="raymarch-cube.frag.glsl" caption="<code>--scene=cube</code>" %}
{% include shader.html src="raymarch-materials.frag.glsl" caption="<code>--lighting=pbr --materials</code>" %}
{% include shader.html src="raymarch-terrain.frag.glsl" caption="<code>--scene=terrain --water</code>" %}
</div>

{% include usage.html generator="glsl:raymarch" %}

{% include params.html generator="glsl:raymarch" %}

### `glsl:lighting` {#glsl-lighting}

{% include terminal.html id="glsl_lighting" %}

{% include usage.html generator="glsl:lighting" %}

{% include params.html generator="glsl:lighting" %}

### `glsl:displace` {#glsl-displace}

Drag the previews to turn them.

{% include terminal.html id="glsl_displace" %}

<div class="auto-grid shaders wide">
{% include shader.html src="displace-noise.frag.glsl" vert="displace-noise.vert.glsl" mesh="sphere" detail="96" caption="<code>--kind=noise</code> on <code>mesh=&quot;sphere&quot;</code>" %}
{% include shader.html src="displace-waves.frag.glsl" vert="displace-waves.vert.glsl" mesh="plane" detail="128" caption="<code>--kind=waves</code> on <code>mesh=&quot;plane&quot;</code>" %}
</div>

{% include usage.html generator="glsl:displace" %}

{% include params.html generator="glsl:displace" %}

### `glsl:matrix` {#glsl-matrix}

{% include terminal.html id="glsl_matrix" %}

{% include usage.html generator="glsl:matrix" %}

{% include params.html generator="glsl:matrix" %}

### `glsl:util` {#glsl-util}

{% include terminal.html id="glsl_util" %}

{% include params.html generator="glsl:util" %}

## Licenses and credits {#credits}

Keep the `THIRD_PARTY_NOTICES.md` jen writes next to your shaders.

- **[webgl-noise](https://github.com/stegu/webgl-noise)** by Stefan Gustavson and Ashima Arts, MIT: classic Perlin noise.
- **[psrdnoise](https://github.com/stegu/psrdnoise)** by Stefan Gustavson and Ian McEwan, MIT: tiling simplex noise and its gradients, behind `simplexNoise` and `curlNoise`.
- **[BakingLab](https://github.com/TheRealMJP/BakingLab)** by MJP and David Neubelt, MIT: Stephen Hill's ACES fit, `tonemapAces`.
- **[hash-prospector](https://github.com/skeeto/hash-prospector)** by Chris Wellons, public domain: the `lowbias32` hash constants.
- **[Inigo Quilez's articles](https://iquilezles.org/articles/)**, MIT: the [distance functions](https://iquilezles.org/articles/distfunctions/), [2D distance functions](https://iquilezles.org/articles/distfunctions2d/), [ray intersectors](https://iquilezles.org/articles/intersectors/), [smooth minimum](https://iquilezles.org/articles/smin/), [normals](https://iquilezles.org/articles/normalsSDF/) and [soft shadows](https://iquilezles.org/articles/rmshadows/).
- **Formulas** from Brian Karis's "Real Shading in Unreal Engine 4"; Duff et al.'s orthonormal basis (JCGT 2017); Mark Finch's Gerstner waves (GPU Gems); Kay and Kajiya's slab method for ray–box hits (SIGGRAPH 1986).

<script src="{{ '/glsl/shader-canvas.js' | relative_url }}" defer></script>
