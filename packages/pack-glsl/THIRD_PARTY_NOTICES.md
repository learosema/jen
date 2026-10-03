# Third-party notices

pack-glsl's own code is MIT No Attribution (MIT-0, see [LICENSE](LICENSE)) and needs no notice. Code by other authors is only included under the MIT license.

Each `.glsl` chunk names its author and source in an attribution line and declares its license with `// @license <id>`:

- `MIT-0`: the pack's own code, no notice needed.
- `inline`: the chunk's own header is the notice, as its authors explicitly allow.
- Anything else: the id of a full notice in `glsl/licenses/<id>.glsl`. When jen inserts such a chunk into a shader, that notice is inserted with it, once per shader.

## Stefan Gustavson, Ashima Arts – webgl-noise

- Source: https://github.com/stegu/webgl-noise
- License: MIT (`glsl/licenses/webgl-noise.glsl`)
- Chunks: `noise/classic2`, `noise/classic3` (classic Perlin noise `cnoise`/`pnoise`, used by `perlinNoise`), `noise/gustavson-common`, `noise/gustavson-mod289-vec3`
- Changes: the helpers `mod289`, `permute` and `taylorInvSqrt` were moved out of `classicnoise2D.glsl`/`classicnoise3D.glsl` into their own chunks, so 2D and 3D noise can share one shader. The code is otherwise unchanged.

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
- License: MIT, using the authors' "brief license" (`inline`): their [src/README.md](https://github.com/stegu/psrdnoise/blob/main/src/README.md) permits replacing the full notice with a three-line header kept with the function.
- Chunks: `noise/psrdnoise2`, `noise/psrdnoise3` (tiling simplex noise with analytic gradients, used by `simplexNoise` and `curlNoise`)
- Changes: the full license comment was replaced by the brief header; in `psrdnoise3`, `permute()` was renamed to `psrdPermute()` so it can't clash with webgl-noise's `permute()`. The code is otherwise unchanged.

```
// psrdnoise (c) 2021 Stefan Gustavson and Ian McEwan
// Published under the MIT license.
// https://github.com/stegu/psrdnoise/
```

## Chris Wellons – hash-prospector (public domain)

- Source: https://github.com/skeeto/hash-prospector
- License: The Unlicense (public domain); no notice required.
- Used in: `util/hash`, which is pack-glsl's own code (MIT-0) built on the `lowbias32` constants, credited in its comment.
