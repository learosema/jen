// @license iquilezles
// opExtrude · Inigo Quilez · https://iquilezles.org/articles/distfunctions/
// d: the 2D distance at p.xy, h: the half depth along z
float opExtrude(vec3 p, float d, float h) {
  vec2 w = vec2(d, abs(p.z) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}
