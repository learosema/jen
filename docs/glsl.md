---
layout: doc
permalink: /glsl.html
title: jen — glsl pack recipes
description: "Every jen command in @codejen/pack-glsl: shader starters, a WebGL playground, noise, signed distance fields, raymarching, lighting, image filters and vertex displacement – with live previews."
eyebrow: "@codejen/pack-glsl"
mega: shaders
lede: Every generator, with the command, the output it prints, and the shader it makes – running live.
sub: GLSL for WebGL2 and OpenGL. MIT-0, MIT and public domain.
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
      - { title: "glsl:filter", id: glsl-filter }
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

WebGL2 by default, `--version=410` for desktop. Uniforms: `uTime`, `uResolution`, `uMouse`, and `uTexture0`–`uTexture3` from `texture0="photo.jpg"`, `"clip.mp4"` (both need a web server), `"camera"` or `"test-pattern"`; `uCubemap0` from `cubemap0="sky/{face}.jpg"`.

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
{% include shader.html src="raymarch-env-sky.frag.glsl" caption="<code>--lighting=pbr --materials --env=sky</code>" %}
{% include shader.html src="raymarch-env-cube.frag.glsl" cubemap="test-pattern" caption="<code>--env=cube</code> with <code>cubemap0='test-pattern'</code>" %}
</div>

{% include usage.html generator="glsl:raymarch" %}

{% include params.html generator="glsl:raymarch" %}

### `glsl:lighting` {#glsl-lighting}

{% include terminal.html id="glsl_lighting" %}

{% include usage.html generator="glsl:lighting" %}

{% include params.html generator="glsl:lighting" %}

### `glsl:filter` {#glsl-filter}

{% include terminal.html id="glsl_filter" %}

<div class="auto-grid shaders">
{% include shader.html src="filter-crt.frag.glsl" texture="test-pattern" caption="<code>--kinds=crt,vignette</code>" %}
{% include shader.html src="filter-sobel.frag.glsl" texture="test-pattern" caption="<code>--kinds=sobel</code>" %}
{% include shader.html src="filter-kuwahara.frag.glsl" texture="test-pattern" caption="<code>--kinds=kuwahara</code>" %}
{% include shader.html src="filter-pixelate.frag.glsl" texture="test-pattern" caption="<code>--kinds=pixelate,dither</code>" %}
{% include shader.html src="filter-sobel.frag.glsl" texture="camera" caption="<code>--kinds=sobel</code> on <code>texture0='camera'</code>" %}
{% include shader.html src="raymarch-terrain.frag.glsl" post="filter-post-crt.frag.glsl" caption="<code>--kinds=crt,vignette --post</code> over the terrain" %}
</div>

{% include usage.html generator="glsl:filter" %}

{% include params.html generator="glsl:filter" %}

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
- **[CRT shader](https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl)** by Timothy Lottes, public domain: `crt()` – curvature, scanlines, shadow mask.
- **[Inigo Quilez's articles](https://iquilezles.org/articles/)**, MIT: the [distance functions](https://iquilezles.org/articles/distfunctions/), [2D distance functions](https://iquilezles.org/articles/distfunctions2d/), [ray intersectors](https://iquilezles.org/articles/intersectors/), [smooth minimum](https://iquilezles.org/articles/smin/), [normals](https://iquilezles.org/articles/normalsSDF/) and [soft shadows](https://iquilezles.org/articles/rmshadows/).
- **Methods**, written for the pack after: John C. Hart's sphere tracing (1996); Alex Evans's ambient occlusion (2006); Quilez's [domain warping](https://iquilezles.org/articles/warp/); Ken Perlin's turbulence (1985); F. Kenton Musgrave's ridged multifractal (1994); Steven Worley's cellular noise (1996); Bridson, Hourihan and Nordenstam's curl noise (2007); James F. Blinn's highlights (1977); Brian Karis's "Real Shading in Unreal Engine 4" (2013); Sébastien Lagarde's rough Fresnel (2011); Reinhard et al.'s tone mapping (2002); Duff et al.'s orthonormal basis (2017); Mark Finch's Gerstner waves (2004); Kay and Kajiya's slab method (1986); Sobel and Feldman's edge detection (1968); Bryce Bayer's ordered dithering (1973); the Kuwahara filter (1976).

<script src="{{ '/glsl/shader-canvas.js' | relative_url }}" defer></script>
