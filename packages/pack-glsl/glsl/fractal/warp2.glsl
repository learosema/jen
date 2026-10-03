// @requires fractal/fbm2
// @base value
// @license MIT-0
// valueWarp (2D) · pack-glsl · MIT-0
// Domain warping: fBm sampled at a position displaced by fBm, for marbled,
// flowing, organic patterns. `strength` is how far the domain is pushed
// (default 2.0). Range about [-1, 1]. The `period` overloads tile every
// `period` units (positive whole numbers).
// Works on any jen noise: `jen glsl:noise --kind=… --base=perlin|simplex|value|worley`
// renames value* to the chosen base.

float valueWarp(vec2 p, int octaves, float strength) {
  vec2 q = vec2(valueFbm(p, octaves), valueFbm(p + vec2(7.3, 2.9), octaves));
  return valueFbm(p + strength * q, octaves);
}

float valueWarp(vec2 p, int octaves) { return valueWarp(p, octaves, 2.0); }

float valueWarp(vec2 p, vec2 period, int octaves, float strength) {
  vec2 q = vec2(valueFbm(p, period, octaves), valueFbm(p + vec2(7.3, 2.9), period, octaves));
  return valueFbm(p + strength * q, period, octaves);
}

float valueWarp(vec2 p, vec2 period, int octaves) { return valueWarp(p, period, octaves, 2.0); }
