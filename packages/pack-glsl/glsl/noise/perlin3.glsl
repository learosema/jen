// @requires noise/classic3
// @license MIT-0
// perlinNoise (3D) · pack-glsl · MIT-0
// Classic Perlin noise in about [-1, 1]: Stefan Gustavson's cnoise/pnoise
// (webgl-noise, see its notice above) under the name all jen noises share.
// The `period` overload tiles every `period` units (positive whole numbers).
float perlinNoise(vec3 p) { return cnoise(p); }
float perlinNoise(vec3 p, vec3 period) { return pnoise(p, period); }
