// slab method after Kay and Kajiya, Ray Tracing Complex Scenes (SIGGRAPH 1986)
// t where the ray enters and leaves the box at center with half size b, or vec2(-1.0); n the normal where it enters
vec2 rayBox(vec3 ro, vec3 rd, vec3 center, vec3 b, out vec3 n) {
  vec3 m = 1.0 / rd;  // ±infinity along an axis keeps the slabs right
  vec3 ta = (center - b - ro) * m;
  vec3 tb = (center + b - ro) * m;
  vec3 t1 = min(ta, tb);
  vec3 t2 = max(ta, tb);
  float tNear = max(max(t1.x, t1.y), t1.z);
  float tFar = min(min(t2.x, t2.y), t2.z);
  n = vec3(0.0);
  if (tNear > tFar || tFar < 0.0) return vec2(-1.0);
  n = -sign(rd) * step(t1.yzx, t1.xyz) * step(t1.zxy, t1.xyz);
  return vec2(tNear, tFar);
}
