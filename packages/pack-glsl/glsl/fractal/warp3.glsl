// @requires fractal/fbm3
// @base value
// @license MIT-0
// valueWarp (3D) · pack-glsl · MIT-0
// Domain warping: fBm sampled at a position displaced by fBm, for marbled,
// flowing, organic patterns. Range about [-1, 1].
// Works on any jen noise: `jen glsl:noise --kind=warp --base=perlin|simplex|value|worley`
// renames value* to the chosen base.

float valueWarp(vec3 p, int octaves) {
  vec3 q = vec3(valueFbm(p, octaves), valueFbm(p + vec3(7.3, 2.9, 5.1), octaves), valueFbm(p + vec3(1.7, 9.2, 3.4), octaves));
  return valueFbm(p + 2.0 * q, octaves);
}

// Tiles every `period` units (positive whole numbers).
float valueWarp(vec3 p, vec3 period, int octaves) {
  vec3 q = vec3(valueFbm(p, period, octaves), valueFbm(p + vec3(7.3, 2.9, 5.1), period, octaves), valueFbm(p + vec3(1.7, 9.2, 3.4), period, octaves));
  return valueFbm(p + 2.0 * q, period, octaves);
}
