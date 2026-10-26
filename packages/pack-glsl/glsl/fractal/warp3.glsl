// @requires fractal/fbm3
// @base value
// domain warping after Inigo Quilez · https://iquilezles.org/articles/warp/
// fBm at a position pushed by fBm; strength: how far (default 2.0); about [-1, 1]

float valueWarp(vec3 p, int octaves, float strength) {
  vec3 q = vec3(valueFbm(p, octaves), valueFbm(p + vec3(7.3, 2.9, 5.1), octaves), valueFbm(p + vec3(1.7, 9.2, 3.4), octaves));
  return valueFbm(p + strength * q, octaves);
}

float valueWarp(vec3 p, int octaves) { return valueWarp(p, octaves, 2.0); }

float valueWarp(vec3 p, vec3 period, int octaves, float strength) {
  vec3 q = vec3(valueFbm(p, period, octaves), valueFbm(p + vec3(7.3, 2.9, 5.1), period, octaves), valueFbm(p + vec3(1.7, 9.2, 3.4), period, octaves));
  return valueFbm(p + strength * q, period, octaves);
}

float valueWarp(vec3 p, vec3 period, int octaves) { return valueWarp(p, period, octaves, 2.0); }
