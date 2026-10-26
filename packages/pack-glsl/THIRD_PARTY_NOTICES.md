# Third-party notices

pack-glsl's own code is MIT No Attribution (MIT-0, see [LICENSE](LICENSE)) and needs no notice. Code by other authors is only included under the MIT license.

Each `.glsl` chunk names its author and source in an attribution line and declares its license with `// @license <id>`:

- `MIT-0`: the pack's own code, no notice needed.
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

## Inigo Quilez – articles on distance functions and raymarching

- Source: https://iquilezles.org/articles/ – its index says: "all technical code snippets you'll find are under the MIT license so you can easily reuse them, but the mathematical/shader art is protected and requires a license for use." Only technical snippets are included, no shader art.
- License: MIT (`glsl/licenses/iquilezles.glsl`)
- Chunks: `sdf2d/box`, `sdf2d/circle`, `sdf2d/round-box`, `sdf2d/segment`, `sdf2d/vesica`, `sdf3d/box`, `sdf3d/capsule`, `sdf3d/cylinder`, `sdf3d/plane`, `sdf3d/round-box`, `sdf3d/sphere`, `sdf3d/torus`, `sdfop/extrude`, `sdfop/revolve`, `sdfop/smooth-union` (from [distance functions](https://iquilezles.org/articles/distfunctions/), [2D distance functions](https://iquilezles.org/articles/distfunctions2d/) and [smooth minimum](https://iquilezles.org/articles/smin/)), `raymarch/normal` ([normals for an SDF](https://iquilezles.org/articles/normalsSDF/)), `raymarch/soft-shadow` ([soft shadows](https://iquilezles.org/articles/rmshadows/)), `intersect/sphere` ([intersectors](https://iquilezles.org/articles/intersectors/))
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
