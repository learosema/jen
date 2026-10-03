// @requires fractal/fbm2
// @base value
// @license MIT-0
// valueWarp (2D) · pack-glsl · MIT-0
// Domain warping: fBm sampled at a position displaced by fBm, for marbled,
// flowing, organic patterns. Range about [-1, 1].
// Works on any jen noise: `jen glsl:noise --kind=warp --base=perlin|simplex|value|worley`
// renames value* to the chosen base.

float valueWarp(vec2 p, int octaves) {
  vec2 q = vec2(valueFbm(p, octaves), valueFbm(p + vec2(7.3, 2.9), octaves));
  return valueFbm(p + 2.0 * q, octaves);
}

// Tiles every `period` units (positive whole numbers).
float valueWarp(vec2 p, vec2 period, int octaves) {
  vec2 q = vec2(valueFbm(p, period, octaves), valueFbm(p + vec2(7.3, 2.9), period, octaves));
  return valueFbm(p + 2.0 * q, period, octaves);
}
