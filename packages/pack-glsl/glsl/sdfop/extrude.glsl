// @license MIT-0
// opExtrude · pack-glsl · MIT-0
// Turns a 2D shape into a 3D one: d is the 2D distance at p.xy, h the half
// depth along z. opExtrude(p, sdStar(p.xy, 1.0, 0.5, 5.0), 0.2)
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions/
float opExtrude(vec3 p, float d, float h) {
  vec2 w = vec2(d, abs(p.z) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}
