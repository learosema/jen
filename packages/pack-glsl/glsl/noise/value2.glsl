// @requires util/hash
// @license MIT-0
// valueNoise (2D) · pack-glsl · MIT-0
// Random values on an integer lattice, smoothly (quintic) interpolated.
// Range [-1, 1]. The `period` overload tiles every `period` units (positive
// whole numbers); the plain one repeats only every 65536 units.
float valueNoise(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 i0 = mod(i, period);
  vec2 i1 = mod(i + 1.0, period);
  float a = hash21(i0);
  float b = hash21(vec2(i1.x, i0.y));
  float c = hash21(vec2(i0.x, i1.y));
  float d = hash21(i1);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}

float valueNoise(vec2 p) { return valueNoise(p, vec2(65536.0)); }
