// @license MIT-0
// sdBox (3D) · pack-glsl · MIT-0
// Signed distance to an axis-aligned box; b is the half size.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions/
float sdBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}
