# Third-party notices

pack-glsl's own code is MIT No Attribution (MIT-0, see [LICENSE](LICENSE)) and needs no notice. Code by other authors is only included under the MIT license or when its author released it into the public domain. Methods and formulas the pack's own code follows are credited too, at the end.

Each `.glsl` chunk names its author and source in a one-line credit and declares a third-party license with `// @license <id>`:

- None: the pack's own code (MIT-0), no notice needed.
- `inline`: the chunk's own header is the notice, where its authors explicitly allow that.
- Anything else: the id of a full notice in `glsl/licenses/<id>.glsl`. When jen inserts such a chunk into a shader, it writes that notice into a `THIRD_PARTY_NOTICES.md` next to the shader, once.

## Stefan Gustavson, Ashima Arts – webgl-noise

- Source: https://github.com/stegu/webgl-noise
- License: MIT (`glsl/licenses/webgl-noise.glsl`)
- Chunks: `noise/classic2`, `noise/classic3` (classic Perlin noise `cnoise`/`pnoise`, used by `perlinNoise`), `noise/gustavson-common`, `noise/gustavson-mod289-vec3`
- Changes: the helpers `mod289`, `permute` and `taylorInvSqrt` were moved out of `classicnoise2D.glsl`/`classicnoise3D.glsl` into their own chunks, so 2D and 3D noise can share one shader, and the header comments became a credit line (the full notice ships in `THIRD_PARTY_NOTICES.md`). The code is otherwise unchanged.

```
Copyright (C) 2011 by Ashima Arts (Simplex noise)
Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Stefan Gustavson, Ian McEwan – psrdnoise

- Source: https://github.com/stegu/psrdnoise
- License: MIT (`glsl/licenses/psrdnoise.glsl`, from their [src/README.md](https://github.com/stegu/psrdnoise/blob/main/src/README.md))
- Chunks: `noise/psrdnoise2`, `noise/psrdnoise3` (tiling simplex noise with analytic gradients, used by `simplexNoise` and `curlNoise`)
- Changes: the comments before the functions became a credit line and one line on the parameters; in `psrdnoise3`, `permute()` was renamed to `psrdPermute()` so it can't clash with webgl-noise's `permute()`. The code is otherwise unchanged.

```
Copyright 2021, Stefan Gustavson and Ian MacEwan
(stefan.gustavson@gmail.com, ijm567@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

```

## MJP, David Neubelt, Stephen Hill – BakingLab

- Source: https://github.com/TheRealMJP/BakingLab (`BakingLab/ACES.hlsl`)
- License: MIT (`glsl/licenses/bakinglab.glsl`)
- Chunks: `color/aces` (`tonemapAces`, Stephen Hill's fit of the ACES RRT + ODT)
- Changes: ported from HLSL to GLSL. The matrices keep their original row layout and are applied as `color * M`, which equals HLSL's `mul(M, color)`; `saturate()` became `clamp()`.

```
MIT License

Copyright (c) 2016 MJP

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Chris Wellons – hash-prospector (public domain)

- Source: https://github.com/skeeto/hash-prospector
- License: The Unlicense (public domain); no notice required.
- Used in: `util/hash`, which is pack-glsl's own code (MIT-0) built on the `lowbias32` constants, credited in its comment.

## Timothy Lottes – CRT shader (public domain)

- Source: https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl – its header: "PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER by Timothy Lottes … Please take and use, change, or whatever."
- License: public domain; no notice required (`glsl/licenses/lottes-crt.glsl`).
- Used in: `filter/crt` – the warp, the Gaussian scanlines and the stretched-VGA shadow mask, condensed (3-tap lines, no bloom).

## Inigo Quilez – articles on distance functions and raymarching

- Source: https://iquilezles.org/articles/ – its index says: "all technical code snippets you'll find are under the MIT license so you can easily reuse them, but the mathematical/shader art is protected and requires a license for use." Only technical snippets are included, no shader art.
- License: MIT (`glsl/licenses/iquilezles.glsl`)
- Chunks: `sdf2d/box`, `sdf2d/circle`, `sdf2d/round-box`, `sdf2d/segment`, `sdf2d/vesica`, `sdf3d/box`, `sdf3d/capsule`, `sdf3d/cylinder`, `sdf3d/plane`, `sdf3d/round-box`, `sdf3d/sphere`, `sdf3d/torus`, `sdfop/extrude`, `sdfop/revolve`, `sdfop/onion`, `sdfop/round`, `sdfop/repeat`, `sdfop/repeat-limited`, `sdfop/smooth-union`, `sdfop/smooth-subtract`, `sdfop/smooth-intersect` (from [distance functions](https://iquilezles.org/articles/distfunctions/), [2D distance functions](https://iquilezles.org/articles/distfunctions2d/) and [smooth minimum](https://iquilezles.org/articles/smin/)), `raymarch/normal` ([normals for an SDF](https://iquilezles.org/articles/normalsSDF/)), `raymarch/soft-shadow` ([soft shadows](https://iquilezles.org/articles/rmshadows/)), `intersect/sphere` ([intersectors](https://iquilezles.org/articles/intersectors/))
- Changes: names and parameters adapted to the pack's conventions, comments added; `raymarch/normal` and `raymarch/soft-shadow` call the scene through a forward-declared `scene()`.

```
Copyright (c) Inigo Quilez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Methods and formulas

The pack's own code (MIT-0) that follows a published method credits it in one line:

- **John C. Hart**, "Sphere Tracing" (The Visual Computer, 1996): `raymarch/march`
- **Alex Evans**, "Fast Approximations for Global Illumination on Dynamic Scenes" (SIGGRAPH 2006): `raymarch/ao`
- **Inigo Quilez**, [domain warping](https://iquilezles.org/articles/warp/): `fractal/warp2`, `fractal/warp3`
- **F. Kenton Musgrave**, ridged multifractal (Texturing and Modeling, 1994): `fractal/ridged2`, `fractal/ridged3`
- **Ken Perlin**, "An Image Synthesizer" (SIGGRAPH 1985): `fractal/turbulence2`, `fractal/turbulence3`
- **Steven Worley**, "A Cellular Texture Basis Function" (SIGGRAPH 1996): `noise/worley2`, `noise/worley3`
- **Robert Bridson, Jim Hourihan, Marcus Nordenstam**, "Curl-Noise for Procedural Fluid Flow" (SIGGRAPH 2007): `noise/curl2`, `noise/curl3`
- **James F. Blinn**, "Models of Light Reflection for Computer Synthesized Pictures" (SIGGRAPH 1977): `lighting/blinn`
- **Brian Karis**, ["Real Shading in Unreal Engine 4"](https://blog.selfshadow.com/publications/s2013-shading-course/) (SIGGRAPH 2013): `lighting/pbr`, `lights/point`
- **Sébastien Lagarde**, Fresnel with roughness (2011): `lighting/pbr-ambient`
- **Erik Reinhard et al.**, "Photographic Tone Reproduction for Digital Images" (SIGGRAPH 2002): `color/reinhard`
- **Tom Duff et al.**, "Building an Orthonormal Basis, Revisited" (JCGT 2017): `vertex/basis`
- **Mark Finch**, Gerstner waves (GPU Gems, 2004, chapter 1): `vertex/gerstner`
- **Timothy L. Kay and James T. Kajiya**, slab method, "Ray Tracing Complex Scenes" (SIGGRAPH 1986): `intersect/box`
- **Bryce Bayer**, ordered dithering (1973): `filter/dither`
- **Irwin Sobel and Gary Feldman**, edge detection (1968): `filter/sobel`
- **Michiyoshi Kuwahara et al.**, the Kuwahara filter (1976): `filter/kuwahara`
