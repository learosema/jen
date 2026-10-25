// @license iquilezles
// sdTorus · Inigo Quilez · https://iquilezles.org/articles/distfunctions/
// in the xz plane: t.x the ring radius, t.y the tube radius
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}
