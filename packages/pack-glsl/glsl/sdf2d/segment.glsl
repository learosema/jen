// @license MIT-0
// sdSegment (2D) · pack-glsl · MIT-0
// Distance to the line segment from a to b (unsigned; subtract a radius for a capsule).
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions2d/
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
