// @requires noise/psrdnoise3
// @license MIT-0
// simplexNoise (3D) · pack-glsl · MIT-0
// Simplex noise in [-1, 1]: psrdnoise by Stefan Gustavson and Ian McEwan
// (see its header above) under the name all jen noises share. The `period`
// overload tiles every `period` units (whole numbers up to 289).
float simplexNoise(vec3 p) {
  vec3 gradient;
  return psrdnoise(p, vec3(0.0), 0.0, gradient);
}

float simplexNoise(vec3 p, vec3 period) {
  vec3 gradient;
  return psrdnoise(p, period, 0.0, gradient);
}
