// @requires noise/classic2
// Stefan Gustavson's cnoise/pnoise under jen's noise name; about [-1, 1]
float perlinNoise(vec2 p) { return cnoise(p); }
float perlinNoise(vec2 p, vec2 period) { return pnoise(p, period); }
