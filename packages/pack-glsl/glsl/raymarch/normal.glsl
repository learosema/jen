// @license iquilezles
// calcNormal · Inigo Quilez · https://iquilezles.org/articles/normalsSDF/
// yours, defined further down: the distance from p to the nearest surface
float scene(vec3 p);

vec3 calcNormal(vec3 p) {
  const float h = 0.0005;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * scene(p + k.xyy * h) +
                   k.yyx * scene(p + k.yyx * h) +
                   k.yxy * scene(p + k.yxy * h) +
                   k.xxx * scene(p + k.xxx * h));
}
