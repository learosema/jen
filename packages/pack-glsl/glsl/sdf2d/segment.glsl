// @license iquilezles
// sdSegment (2D) · Inigo Quilez · https://iquilezles.org/articles/distfunctions2d/
// unsigned; subtract a radius for a capsule
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
