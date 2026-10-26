// @requires noise/classic3
// Stefan Gustavson's cnoise/pnoise under jen's noise name; about [-1, 1]
float perlinNoise(vec3 p) { return cnoise(p); }
float perlinNoise(vec3 p, vec3 period) { return pnoise(p, period); }
