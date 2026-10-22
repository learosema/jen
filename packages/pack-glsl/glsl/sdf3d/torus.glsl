// @license iquilezles
// sdTorus · Inigo Quilez · MIT
// Torus in the xz plane: t.x is the ring radius, t.y the tube radius.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions/
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}
