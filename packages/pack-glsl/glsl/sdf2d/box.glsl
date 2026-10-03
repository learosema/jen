// @license MIT-0
// sdBox (2D) · pack-glsl · MIT-0
// Signed distance to an axis-aligned box; b is the half size.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions2d/
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
