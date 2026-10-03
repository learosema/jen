// @requires util/hash
// @license MIT-0
// valueNoise (3D) · pack-glsl · MIT-0
// Random values on an integer lattice, smoothly (quintic) interpolated.
// Range [-1, 1]. The `period` overload tiles every `period` units (positive
// whole numbers); the plain one repeats only every 65536 units.
float valueNoise(vec3 p, vec3 period) {
  vec3 i = floor(p);
  vec3 f = p - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec3 i0 = mod(i, period);
  vec3 i1 = mod(i + 1.0, period);
  float a = hash31(i0);
  float b = hash31(vec3(i1.x, i0.y, i0.z));
  float c = hash31(vec3(i0.x, i1.y, i0.z));
  float d = hash31(vec3(i1.x, i1.y, i0.z));
  float e = hash31(vec3(i0.x, i0.y, i1.z));
  float f1 = hash31(vec3(i1.x, i0.y, i1.z));
  float g = hash31(vec3(i0.x, i1.y, i1.z));
  float h = hash31(i1);
  float lower = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  float upper = mix(mix(e, f1, u.x), mix(g, h, u.x), u.y);
  return mix(lower, upper, u.z) * 2.0 - 1.0;
}

float valueNoise(vec3 p) { return valueNoise(p, vec3(65536.0)); }
