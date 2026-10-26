// @license iquilezles
// raySphere · Inigo Quilez · https://iquilezles.org/articles/intersectors/
// t where the ray (rd normalized) enters and leaves the sphere; y < 0: missed, x < 0: ro is inside
vec2 raySphere(vec3 ro, vec3 rd, vec3 center, float r) {
  vec3 oc = ro - center;
  float b = dot(oc, rd);
  vec3 qc = oc - b * rd;  // a projection, not b * b: precise for spheres far away
  float h = r * r - dot(qc, qc);
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
