// @requires fractal/fbm2
// @base value
// domain warping after Inigo Quilez · https://iquilezles.org/articles/warp/
// fBm at a position pushed by fBm; strength: how far (default 2.0); about [-1, 1]

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
