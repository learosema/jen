// @requires noise/psrdnoise2
// @license MIT-0
// simplexNoise (2D) · pack-glsl · MIT-0
// Simplex noise in [-1, 1]: psrdnoise by Stefan Gustavson and Ian McEwan
// (see its header above) under the name all jen noises share. The `period`
// overload tiles every `period` units: whole numbers, and even ones along y
// (an odd y period tiles at twice its length).
float simplexNoise(vec2 p) {
  vec2 gradient;
  return psrdnoise(p, vec2(0.0), 0.0, gradient);
}

float simplexNoise(vec2 p, vec2 period) {
  vec2 gradient;
  return psrdnoise(p, period, 0.0, gradient);
}
