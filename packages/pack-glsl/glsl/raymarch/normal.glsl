// @license MIT-0
// calcNormal · pack-glsl · MIT-0
// Surface normal at p from four scene() samples on a tetrahedron, which is
// cheaper than central differences (six samples).
// Technique: Inigo Quilez, https://iquilezles.org/articles/normalsSDF/
// Your scene: the distance from p to the nearest surface, defined further down.
float scene(vec3 p);

vec3 calcNormal(vec3 p) {
  const float h = 0.0005;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * scene(p + k.xyy * h) +
                   k.yyx * scene(p + k.yyx * h) +
                   k.yxy * scene(p + k.yxy * h) +
                   k.xxx * scene(p + k.xxx * h));
}
