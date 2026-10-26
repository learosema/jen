// @requires noise/psrdnoise3
// psrdnoise under jen's noise name; [-1, 1]; period: whole numbers up to 289
float simplexNoise(vec3 p) {
  vec3 gradient;
  return psrdnoise(p, vec3(0.0), 0.0, gradient);
}

float simplexNoise(vec3 p, vec3 period) {
  vec3 gradient;
  return psrdnoise(p, period, 0.0, gradient);
}
