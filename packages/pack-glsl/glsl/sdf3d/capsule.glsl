// @license MIT-0
// sdCapsule · pack-glsl · MIT-0
// Capsule from a to b with radius r.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions/
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
