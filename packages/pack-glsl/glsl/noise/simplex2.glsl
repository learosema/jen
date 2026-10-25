// @requires noise/psrdnoise2
// @license MIT-0
// psrdnoise under jen's noise name; [-1, 1]; period: whole numbers, even along y
float simplexNoise(vec2 p) {
  vec2 gradient;
  return psrdnoise(p, vec2(0.0), 0.0, gradient);
}

float simplexNoise(vec2 p, vec2 period) {
  vec2 gradient;
  return psrdnoise(p, period, 0.0, gradient);
}
